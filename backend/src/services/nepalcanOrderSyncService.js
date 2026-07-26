const NepalcanOrder = require('../models/NepalcanOrder');
const NepalcanSyncLog = require('../models/NepalcanSyncLog');
const Lead = require('../models/Lead');
const axios = require('axios');
const { loginToNepalcan, getDefaultSyncUser } = require('./nepalcanAuthService');

const API_BASE = 'https://commerce.thecanbrand.com/api';
const LOGISTICS_API = 'https://can-logistic-prod-84pie.ondigitalocean.app/api/public/marketplace-tracker';

const STATUS_RANK = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'];
const TRACKING_STATUS_MAP = {
  'returned': 'Returned',
  'delivered': 'Delivered',
  'delivery failed': 'Delivered',
  'shipped': 'Shipped',
  'processing': 'Processing',
};

const deriveStatusFromTracking = (marketplaceProcesses) => {
  if (!marketplaceProcesses || !Array.isArray(marketplaceProcesses)) return null;
  const hasReturned = marketplaceProcesses.some(p => p.process && p.process.toLowerCase() === 'returned');
  if (hasReturned) return 'Returned';
  const statuses = marketplaceProcesses.map(p => p.process?.toLowerCase()).filter(Boolean);
  const highest = statuses.reduce((best, s) => {
    const rank = STATUS_RANK.indexOf(TRACKING_STATUS_MAP[s] || 'Pending');
    return rank > STATUS_RANK.indexOf(TRACKING_STATUS_MAP[best] || 'Pending') ? s : best;
  }, 'pending');
  return TRACKING_STATUS_MAP[highest] || null;
};

const extractStatusTimeline = (marketplaceProcesses) => {
  if (!marketplaceProcesses || !Array.isArray(marketplaceProcesses)) return [];
  const timeline = [];
  const statuses = [
    { process: 'processing', status: 'Processing' },
    { process: 'shipped', status: 'Shipped' },
    { process: 'delivered', status: 'Delivered' },
    { process: 'delivery failed', status: 'Delivered' },
    { process: 'returned', status: 'Returned' },
  ];
  for (const proc of marketplaceProcesses) {
    const match = statuses.find(s => s.process === (proc.process || '').toLowerCase());
    if (match) {
      timeline.push({ status: match.status, timestamp: new Date(proc.createdAt || Date.now()) });
    }
  }
  return timeline.sort((a, b) => a.timestamp - b.timestamp);
};

const resolveStatus = (dbStatus, newStatus, statusSource) => {
  if (!newStatus) return { status: dbStatus || 'Pending', source: 'commerce_api' };
  if (!dbStatus) return { status: newStatus, source: statusSource || 'commerce_api' };
  if (statusSource === 'logistics_api') return { status: newStatus, source: 'logistics_api' };
  const dbRank = STATUS_RANK.indexOf(dbStatus);
  const newRank = STATUS_RANK.indexOf(newStatus);
  if (newRank > dbRank) return { status: newStatus, source: statusSource || 'commerce_api' };
  return { status: dbStatus, source: 'commerce_api' };
};

const LOGISTICS_API_BASE = LOGISTICS_API;

const batchFetchTracking = async (orderIds, batchSize = 10) => {
  const results = new Map();
  for (let i = 0; i < orderIds.length; i += batchSize) {
    const batch = orderIds.slice(i, i + batchSize);
    const settled = await Promise.allSettled(
      batch.map(async (orderId) => {
        const res = await axios.get(`${LOGISTICS_API_BASE}/${orderId}`, { timeout: 10000 });
        return { orderId, data: res.data };
      })
    );
    for (const r of settled) {
      if (r.status === 'fulfilled' && r.value) {
        results.set(r.value.orderId, r.value.data);
      }
    }
    if (i + batchSize < orderIds.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  return results;
};

const retryWithBackoff = async (fn, attempts = 3) => {
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (err) {
      if (i === attempts - 1) throw err;
      const isTransient = err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.response?.status >= 500;
      if (!isTransient) throw err;
      const delay = Math.pow(3, i) * 1000;
      console.log(`[Retry] Attempt ${i + 1} failed, retrying in ${delay}ms: ${err.message}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
};

const fetchApiOrders = async (authToken) => {
  const headers = {
    'Content-Type': 'application/json',
    'Origin': 'https://commerce.thecanbrand.com',
    'Referer': 'https://commerce.thecanbrand.com/'
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await retryWithBackoff(() => axios.get(
    `${API_BASE}/vendor/orders/super-admin/list`,
    {
      params: { tab: 'marketplace', page: 1, limit: 500, unattendedOrders: '', status: 'Active' },
      headers, timeout: 30000
    }
  ));

  const responseData = response.data;
  let ordersList = [];

  if (responseData?.data?.orders && Array.isArray(responseData.data.orders)) {
    ordersList = responseData.data.orders;
  } else if (responseData?.orders && Array.isArray(responseData.orders)) {
    ordersList = responseData.orders;
  } else if (Array.isArray(responseData)) {
    ordersList = responseData;
  } else if (responseData?.data && Array.isArray(responseData.data)) {
    ordersList = responseData.data;
  }

  const totalPages = Math.min(10, Math.ceil((responseData?.data?.total || 1000) / 500));
  if (totalPages >= 2) {
    const pagePromises = [];
    for (let p = 2; p <= totalPages; p++) {
      pagePromises.push(
        retryWithBackoff(() => axios.get(`${API_BASE}/vendor/orders/super-admin/list`, {
          params: { tab: 'marketplace', page: p, limit: 500, unattendedOrders: '', status: 'Active' },
          headers, timeout: 30000
        }).then(r => r.data)).catch(err => {
          console.error(`[Nepalcan Sync] Error fetching page ${p}:`, err.message);
          return null;
        })
      );
    }
    const pageResults = await Promise.all(pagePromises);
    for (const nextPageData of pageResults) {
      if (!nextPageData) continue;
      let nextOrders = [];
      if (nextPageData?.data?.orders && Array.isArray(nextPageData.data.orders)) {
        nextOrders = nextPageData.data.orders;
      } else if (nextPageData?.orders && Array.isArray(nextPageData.orders)) {
        nextOrders = nextPageData.orders;
      }
      if (nextOrders.length === 0) continue;
      for (const o of nextOrders) ordersList.push(o);
      if (ordersList.length >= (responseData?.data?.total || 1000)) break;
    }
  }

  return { ordersList, apiResponse: { status: response.status, statusText: response.statusText, dataCount: ordersList.length } };
};

const buildOrderUpdate = (orderData, trackingData, existingOrder) => {
  const orderId = orderData.orderId || orderData._id;
  const hasTracking = trackingData?.marketplaceProcesses?.length > 0;

  const trackingStatus = hasTracking ? deriveStatusFromTracking(trackingData.marketplaceProcesses) : null;
  const commerceStatus = orderData.orderStatus || 'Pending';
  let newStatus, statusSource;
  if (trackingStatus) {
    newStatus = trackingStatus;
    statusSource = 'logistics_api';
  } else {
    newStatus = commerceStatus;
    statusSource = 'commerce_api';
  }

  if (existingOrder) {
    const resolved = resolveStatus(existingOrder.orderStatus, newStatus, statusSource);
    newStatus = resolved.status;
    statusSource = resolved.source;
  }

  let timeline = [];
  if (hasTracking) {
    timeline = extractStatusTimeline(trackingData.marketplaceProcesses);
  }
  if (timeline.length === 0 && orderData.createdAt) {
    timeline.push({ status: 'Pending', timestamp: new Date(orderData.createdAt) });
    timeline.push({ status: newStatus, timestamp: new Date(orderData.updatedAt || Date.now()) });
  } else if (timeline.length === 0) {
    timeline.push({ status: newStatus, timestamp: new Date() });
  }

  const apiUpdatedAt = orderData.updatedAt ? new Date(orderData.updatedAt) : new Date();
  const now = new Date();

  if (existingOrder) {
    const statusChanged = existingOrder.orderStatus !== newStatus;
    const setFields = { orderStatus: newStatus, statusSource, apiUpdatedAt, lastSyncedAt: now };

    if (statusChanged) {
      setFields.statusHistory = timeline;
    }

    if (hasTracking && trackingData) {
      if (!existingOrder.rawData) existingOrder.rawData = {};
      setFields['rawData.trackingProcesses'] = trackingData.marketplaceProcesses;
    }

    return { filter: { _id: existingOrder._id }, update: { $set: setFields }, isNew: false };
  }

  let vendorLeadId = null;
  if (orderData.vendor) {
    // Will be resolved in a batch pass after the main write, or left null
  }

  const doc = {
    orderId,
    nepalcanId: orderData._id,
    customer: orderData.customer || 'Unknown',
    vendor: orderData.vendor,
    orderStatus: newStatus,
    statusSource,
    paymentStatus: orderData.paymentStatus,
    totalAmount: orderData.totalAmount || 0,
    shippingAmount: orderData.shippingAmount || 0,
    createdAt: orderData.createdAt ? new Date(orderData.createdAt) : new Date(),
    apiUpdatedAt,
    statusHistory: timeline,
    rawData: orderData,
    lastSyncedAt: now
  };
  if (hasTracking && trackingData) {
    doc.rawData = { ...orderData, trackingProcesses: trackingData.marketplaceProcesses };
  }

  return { filter: { orderId }, update: { $setOnInsert: doc }, isNew: true };
};

const syncNepalcanOrders = async (token = null) => {
  const startTime = Date.now();
  let errorMessage = null;
  let apiResponse = null;
  let newCount = 0, updatedCount = 0, skippedCount = 0;

  let authToken = token;
  if (!authToken) {
    try {
      console.log('[Nepalcan Sync] No token provided, logging in...');
      authToken = await loginToNepalcan();
    } catch (loginErr) {
      errorMessage = 'Failed to login to Nepalcan: ' + (loginErr.response?.data?.message || loginErr.message);
      console.log(`[Nepalcan Sync] ${errorMessage}`);
      await NepalcanSyncLog.create({
        success: false, ordersSynced: 0, newOrders: 0, updatedOrders: 0, skippedOrders: 0,
        errorMessage, durationMs: Date.now() - startTime
      });
      return { synced: 0, newOrders: 0, updatedOrders: 0, skippedOrders: 0, message: errorMessage };
    }
  }

  try {
    const { ordersList, apiResponse: apiResp } = await fetchApiOrders(authToken);
    apiResponse = apiResp;

    if (ordersList.length === 0) {
      console.log('[Nepalcan Sync] No orders returned from API');
      const durationMs = Date.now() - startTime;
      await NepalcanSyncLog.create({
        success: true, ordersSynced: 0, newOrders: 0, updatedOrders: 0, skippedOrders: 0,
        apiResponse, durationMs
      });
      return { synced: 0, newOrders: 0, updatedOrders: 0, skippedOrders: 0, message: 'No orders to sync' };
    }

    // Load existing DB orders into map for O(1) delta comparison
    const existingOrders = await NepalcanOrder.find({})
      .select('orderId apiUpdatedAt orderStatus customer vendor totalAmount paymentStatus')
      .lean();
    const existingMap = new Map(existingOrders.map(o => [o.orderId, o]));

    // Split into new / changed / skipped based on apiUpdatedAt
    const newOrderData = [];
    const changedOrderData = [];

    for (const orderData of ordersList) {
      const orderId = orderData.orderId || orderData._id;
      if (!orderId) continue;

      const existing = existingMap.get(orderId);
      if (!existing) {
        newOrderData.push(orderData);
        continue;
      }

      const apiTimestamp = orderData.updatedAt ? new Date(orderData.updatedAt).getTime() : 0;
      const stored = existing.apiUpdatedAt;
      const storedTimestamp = stored && typeof stored.getTime === 'function' ? stored.getTime() : 0;

      if (apiTimestamp > 0 && storedTimestamp > 0 && apiTimestamp === storedTimestamp) {
        skippedCount++;
      } else {
        changedOrderData.push(orderData);
      }
    }

    console.log(`[Nepalcan Sync] Delta: ${newOrderData.length} new, ${changedOrderData.length} changed, ${skippedCount} skipped (of ${ordersList.length} total)`);

    // Batch-fetch tracking ONLY for orders that changed
    const changedIds = [
      ...newOrderData.map(o => o.orderId || o._id),
      ...changedOrderData.map(o => o.orderId || o._id)
    ].filter(Boolean);

    const trackingMap = changedIds.length > 0 ? await batchFetchTracking(changedIds) : new Map();

    // Resolve vendor_lead_id for all changed orders in batch
    const vendorNames = [...newOrderData, ...changedOrderData]
      .map(o => o.vendor).filter(Boolean);
    const uniqueVendorNames = [...new Set(vendorNames)];
    const vendorLeads = uniqueVendorNames.length > 0
      ? await Lead.find({
          $or: [
            { business_name: { $in: uniqueVendorNames } },
            { nepalcanId: { $in: uniqueVendorNames } }
          ]
        }).select('_id business_name nepalcanId').lean()
      : [];
    const vendorLeadMap = new Map();
    for (const vl of vendorLeads) {
      vendorLeadMap.set(vl.business_name?.toLowerCase(), vl._id);
      if (vl.nepalcanId) vendorLeadMap.set(vl.nepalcanId, vl._id);
    }

    // Build bulk operations
    const upsertOps = [];

    for (const orderData of newOrderData) {
      const orderId = orderData.orderId || orderData._id;
      const trackingData = trackingMap.get(orderId);
      const vendorLeadId = orderData.vendor
        ? (vendorLeadMap.get(orderData.vendor.toLowerCase()) || vendorLeadMap.get(orderData.vendor))
        : null;
      const update = buildOrderUpdate(orderData, trackingData, null);
      update.update.$setOnInsert.vendor_lead_id = vendorLeadId;
      upsertOps.push({ updateOne: { ...update, upsert: true } });
      newCount++;
    }

    for (const orderData of changedOrderData) {
      const orderId = orderData.orderId || orderData._id;
      const existing = existingMap.get(orderId);
      const trackingData = trackingMap.get(orderId);
      const vendorLeadId = orderData.vendor
        ? (vendorLeadMap.get(orderData.vendor.toLowerCase()) || vendorLeadMap.get(orderData.vendor))
        : null;
      const update = buildOrderUpdate(orderData, trackingData, existing);
      if (vendorLeadId) {
        update.update.$set.vendor_lead_id = vendorLeadId;
      }
      upsertOps.push({ updateOne: update });
      updatedCount++;
    }

    // Execute writes
    if (upsertOps.length > 0) {
      await NepalcanOrder.bulkWrite(upsertOps, { ordered: false });
    }

    console.log(`[Nepalcan Sync] Written ${upsertOps.length} orders to DB`);

    // Update Lead metrics only if orders changed
    if (newCount + updatedCount > 0) {
      console.log('[Nepalcan Sync] Updating lead metrics...');

      const deliveredOrdersAgg = await NepalcanOrder.aggregate([
        { $match: { orderStatus: 'Delivered', vendor_lead_id: { $ne: null } } },
        { $group: {
          _id: '$vendor_lead_id',
          deliveredCount: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          lastOrderDate: { $max: '$updatedAt' }
        } }
      ]);

      for (const vendorData of deliveredOrdersAgg) {
        const { _id: vendorLeadId, deliveredCount, totalAmount, lastOrderDate } = vendorData;
        if (!vendorLeadId) continue;
        const leadToUpdate = await Lead.findById(vendorLeadId);
        if (leadToUpdate) {
          const previousNepalcanStatus = leadToUpdate.last_nepalcan_status;
          leadToUpdate.delivered_order_count = deliveredCount;
          leadToUpdate.active_seller = deliveredCount > 0;
          leadToUpdate.last_order_date = lastOrderDate;
          leadToUpdate.total_revenue = totalAmount;
          leadToUpdate.lead_status = 'Active Seller';
          leadToUpdate.last_nepalcan_status = 'Active Seller';
          if (!leadToUpdate.converted_at) leadToUpdate.converted_at = new Date();
          await leadToUpdate.save();

          if (previousNepalcanStatus && previousNepalcanStatus !== 'Active Seller') {
            const Activity = require('../models/Activity');
            const syncUserId = (await getDefaultSyncUser())?._id;
            if (syncUserId) {
              await Activity.create({
                lead_id: leadToUpdate._id,
                user_id: syncUserId,
                activity_type: 'status_change',
                description: `Pipeline changed (sync): ${previousNepalcanStatus} → Active Seller`,
                status: 'completed'
              });
            }
          }
          console.log(`[Nepalcan Sync] Updated lead ${leadToUpdate.business_name}: ${deliveredCount} delivered orders`);
        }
      }

      // Fix orders with null vendor_lead_id
      const ordersToFix = await NepalcanOrder.find({
        orderStatus: 'Delivered',
        vendor_lead_id: null,
        vendor: { $exists: true, $ne: null }
      });

      if (ordersToFix.length > 0) {
        console.log(`[Nepalcan Sync] Fixing ${ordersToFix.length} orders with missing vendor_lead_id`);
        for (const order of ordersToFix) {
          const vl = vendorLeadMap.get(order.vendor?.toLowerCase()) || vendorLeadMap.get(order.vendor);
          if (vl) {
            order.vendor_lead_id = vl;
            await order.save();
            console.log(`[Nepalcan Sync] Fixed order ${order.orderId}`);
          }
        }

        const fixedAgg = await NepalcanOrder.aggregate([
          { $match: { orderStatus: 'Delivered', vendor_lead_id: { $ne: null } } },
          { $group: {
            _id: '$vendor_lead_id',
            deliveredCount: { $sum: 1 },
            totalAmount: { $sum: '$totalAmount' },
            lastOrderDate: { $max: '$updatedAt' }
          } }
        ]);

        for (const vendorData of fixedAgg) {
          const { _id: vendorLeadId, deliveredCount, totalAmount, lastOrderDate } = vendorData;
          if (!vendorLeadId) continue;
          const leadToUpdate = await Lead.findById(vendorLeadId);
          if (leadToUpdate) {
            leadToUpdate.delivered_order_count = deliveredCount;
            leadToUpdate.active_seller = deliveredCount > 0;
            leadToUpdate.last_order_date = lastOrderDate;
            leadToUpdate.total_revenue = totalAmount;
            leadToUpdate.lead_status = 'Active Seller';
            leadToUpdate.last_nepalcan_status = 'Active Seller';
            if (!leadToUpdate.converted_at) leadToUpdate.converted_at = new Date();
            await leadToUpdate.save();

            if (leadToUpdate.last_nepalcan_status && leadToUpdate.last_nepalcan_status !== 'Active Seller') {
              const Activity = require('../models/Activity');
              const syncUserId = (await getDefaultSyncUser())?._id;
              if (syncUserId) {
                await Activity.create({
                  lead_id: leadToUpdate._id,
                  user_id: syncUserId,
                  activity_type: 'status_change',
                  description: `Pipeline changed (sync): ${leadToUpdate.last_nepalcan_status} → Active Seller`,
                  status: 'completed'
                });
              }
            }
          }
        }
      }
    } else {
      console.log('[Nepalcan Sync] No changes — skipping lead metrics update');
    }
  } catch (error) {
    errorMessage = error.response?.data?.message || error.message || 'Unknown error';
    apiResponse = {
      status: error.response?.status,
      statusText: error.response?.statusText,
      errorMessage: error.message
    };
    console.error('[Nepalcan Sync] Error:', errorMessage);
  }

  const durationMs = Date.now() - startTime;
  const synced = newCount + updatedCount;

  await NepalcanSyncLog.create({
    success: !errorMessage,
    ordersSynced: synced,
    newOrders: newCount,
    updatedOrders: updatedCount,
    skippedOrders: skippedCount,
    errorMessage,
    apiResponse,
    durationMs
  });

  console.log(`[Nepalcan Sync] Done in ${durationMs}ms — ${synced} synced (${newCount} new, ${updatedCount} updated, ${skippedCount} skipped)`);

  return {
    synced,
    newOrders: newCount,
    updatedOrders: updatedCount,
    skippedOrders: skippedCount,
    message: errorMessage || `Synced ${synced} orders (${newCount} new, ${updatedCount} updated, ${skippedCount} skipped)`,
    apiResponse
  };
};

const enrichOrdersWithTracking = async () => {
  try {
    const activeOrders = await NepalcanOrder.find({
      orderStatus: { $in: ['Pending', 'Processing', 'Shipped', 'Delivered'] }
    });
    if (activeOrders.length === 0) {
      console.log('[Tracking Enrichment] No active orders to check');
      return 0;
    }
    console.log(`[Tracking Enrichment] Enriching ${activeOrders.length} active orders with tracking data...`);
    const orderIds = activeOrders.map(o => o.orderId);
    const trackingMap = await batchFetchTracking(orderIds);
    let updated = 0;
    const bulkOps = [];
    for (const order of activeOrders) {
      const trackingData = trackingMap.get(order.orderId);
      if (!trackingData?.marketplaceProcesses) continue;
      const newStatus = deriveStatusFromTracking(trackingData.marketplaceProcesses);
      const resolved = resolveStatus(order.orderStatus, newStatus, 'logistics_api');
      if (resolved.status === order.orderStatus) continue;
      const timeline = extractStatusTimeline(trackingData.marketplaceProcesses);
      if (!order.rawData) order.rawData = {};
      order.rawData.trackingProcesses = trackingData.marketplaceProcesses;
      bulkOps.push({
        updateOne: {
          filter: { _id: order._id },
          update: {
            $set: {
              orderStatus: resolved.status,
              statusSource: resolved.source,
              statusHistory: timeline.length > 0 ? timeline : order.statusHistory,
              rawData: order.rawData,
              lastSyncedAt: new Date()
            }
          }
        }
      });
      updated++;
    }
    if (bulkOps.length > 0) {
      await NepalcanOrder.bulkWrite(bulkOps, { ordered: false });
    }
    console.log(`[Tracking Enrichment] Updated ${updated} orders`);
    return updated;
  } catch (error) {
    console.error('[Tracking Enrichment] Error:', error.message);
    return 0;
  }
};

const getLastSyncLog = async () => {
  return await NepalcanSyncLog.findOne().sort({ createdAt: -1 });
};

const getRecentSyncLogs = async (limit = 10) => {
  return await NepalcanSyncLog.find().sort({ createdAt: -1 }).limit(limit);
};

module.exports = {
  syncNepalcanOrders,
  enrichOrdersWithTracking,
  getLastSyncLog,
  getRecentSyncLogs,
  deriveStatusFromTracking,
  extractStatusTimeline,
  resolveStatus,
  batchFetchTracking
};