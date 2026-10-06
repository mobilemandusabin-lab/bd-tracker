const NepalcanOrder = require('../models/NepalcanOrder');
const NepalcanSyncLog = require('../models/NepalcanSyncLog');
const Lead = require('../models/Lead');
const axios = require('axios');
const { loginToNepalcan, getDefaultSyncUser } = require('./nepalcanAuthService');
const { lifecycleFields, mergeStatusHistory, statusDateExpression, trackingEvents } = require('../utils/orderLifecycle');
const {
  ORDERS_API_URL, buildOrderRequestParams, isLastOrderPage, parseOrderResponse
} = require('./nepalcanOrderWindow');

const LOGISTICS_API = 'https://can-logistic-prod-84pie.ondigitalocean.app/api/public/marketplace-tracker';

const STATUS_RANK = ['Pending', 'Hold', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'];
const TRACKING_STATUS_MAP = {
  'returned': 'Returned',
  'delivered': 'Delivered',
  'delivery failed': 'Delivered',
  'shipped': 'Shipped',
  'processing': 'Processing',
};

// ponytail: explicit return set — initiated/declined are keepers (still Delivered), not returns
const RETURNED_PROCESSES = new Set(['returned', 'return processing', 'return delivered', 'return in progress', 'return dispatched']);
const RETURN_KEEPER_PROCESSES = new Set(['return initiated', 'return declined']);
const normProcess = (s) => typeof s === 'string' ? s.trim().toLowerCase() : '';
const isReturnProcess = (s) => RETURNED_PROCESSES.has(normProcess(s));
const isReturnKeeper = (s) => RETURN_KEEPER_PROCESSES.has(normProcess(s));
// ponytail: collapse commerce/tracking variants to enum-safe status; keepers stay Delivered
const normalizeReturnStatus = (raw, fallback = 'Pending') => {
  if (isReturnProcess(raw)) return 'Returned';
  if (isReturnKeeper(raw)) return 'Delivered';
  return fallback;
};

const deriveStatusFromTracking = (marketplaceProcesses, trackingData) => {
  if (marketplaceProcesses && Array.isArray(marketplaceProcesses) && marketplaceProcesses.length > 0) {
    const hasReturned = marketplaceProcesses.some(p => p.process && isReturnProcess(p.process));
    if (hasReturned) return 'Returned';
    const statuses = marketplaceProcesses.map(p => p.process?.toLowerCase()).filter(Boolean);
    const statusOf = (s) => isReturnKeeper(s) ? 'Delivered' : TRACKING_STATUS_MAP[s];
    const known = statuses.filter(s => statusOf(s));
    if (known.length > 0) {
      const highest = known.reduce((best, s) => {
        const rank = STATUS_RANK.indexOf(statusOf(s));
        return rank > STATUS_RANK.indexOf(statusOf(best)) ? s : best;
      }, known[0]);
      if (statusOf(highest)) return statusOf(highest);
    }
  }
  const timelineStatuses = trackingEvents(trackingData).map(event => event.status);
  if (timelineStatuses.length > 0) {
    return timelineStatuses.reduce((best, status) =>
      STATUS_RANK.indexOf(status) > STATUS_RANK.indexOf(best) ? status : best
    );
  }
  // ponytail: procs almost always empty — fall back to logistics header fields, same response
  return deriveFromLogisticsFields(trackingData);
};

// ponytail: logistics truth beyond marketplaceProcesses — orderStatus/ext fields carry Delivered/returns
const LOGISTICS_ORDER_STATUS_MAP = {
  delivered: 'Delivered',
  shipped: 'Shipped',
  processing: 'Processing',
  confirmed: 'Processing',
  pending: 'Pending',
};
const deriveFromLogisticsFields = (td) => {
  if (!td || typeof td !== 'object') return null;
  const out = [];
  for (const raw of [td.orderStatus, td.externalDeliveryStatus]) {
    const s = normProcess(raw);
    if (!s) continue;
    if (isReturnKeeper(s)) out.push('Delivered');
    else if (isReturnProcess(s)) out.push('Returned');
    else if (LOGISTICS_ORDER_STATUS_MAP[s]) out.push(LOGISTICS_ORDER_STATUS_MAP[s]);
  }
  if (normProcess(td.externalDeliveryEvent) === 'delivery_completed') out.push('Delivered');
  if (out.length === 0) return null;
  // ponytail: highest rank wins — a stale header can still lose to commerce in the rank merge below
  return out.reduce((a, b) => (STATUS_RANK.indexOf(b) > STATUS_RANK.indexOf(a) ? b : a));
};

const extractStatusTimeline = (trackingData) => {
  return trackingEvents(trackingData);
};

const resolveStatus = (dbStatus, newStatus, statusSource) => {
  if (!newStatus) return { status: dbStatus || 'Pending', source: 'commerce_api' };
  if (!dbStatus) return { status: newStatus, source: statusSource || 'commerce_api' };
  // ponytail: rank rule for both sources — stale tracking must not demote Delivered to Shipped
  // ponytail: backfill heal — broad 'return' match falsely Returned initiated/declined, allow commerce demote to Delivered
  if (dbStatus === 'Returned' && newStatus === 'Delivered') return { status: 'Delivered', source: statusSource || 'commerce_api' };
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
        const res = await axios.get(`${LOGISTICS_API_BASE}/${orderId}`, { timeout: 5000 });
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
      const status = err.response?.status;
      const isTransient = err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' ||
        status >= 500 || status === 429;
      if (!isTransient) throw err;
      // ponytail: 429 honors Retry-After header, else exponential backoff
      const retryAfter = parseInt(err.response?.headers?.['retry-after'], 10);
      const delay = Number.isFinite(retryAfter) ? retryAfter * 1000 : Math.pow(3, i) * 1000;
      console.log(`[Retry] Attempt ${i + 1} failed (${status || err.code}), retrying in ${delay}ms: ${err.message}`);
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

  const limit = 50;
  const ordersList = [];
  let page = 1;
  let totalCount = 0;
  let firstResponse = null;

  // Fetch the date-filtered endpoint page by page.  There is intentionally no
  // all-time fallback: orders older than the status-sync window must not have
  // their status rewritten during routine sync.
  while (page <= 1000) {
    const response = await retryWithBackoff(() => axios.get(ORDERS_API_URL, {
      params: buildOrderRequestParams(page, limit),
      headers, timeout: 30000
    }));
    if (!firstResponse) firstResponse = response;
    const { orders: nextOrders, total } = parseOrderResponse(response);
    totalCount = total;
    if (nextOrders.length === 0) break;
    ordersList.push(...nextOrders);
    if (isLastOrderPage({ page, limit, count: nextOrders.length, total: totalCount })) break;
    page += 1;
  }

  const { fromDate, toDate } = buildOrderRequestParams(1, limit);

  return {
    ordersList,
    apiResponse: {
      status: firstResponse?.status,
      statusText: firstResponse?.statusText,
      dataCount: ordersList.length,
      totalCount,
      fromDate,
      toDate,
      pages: page
    }
  };
};

const buildOrderUpdate = (orderData, trackingData, existingOrder) => {
  const orderId = orderData.orderId || orderData._id;
  const hasTracking = Boolean(trackingData && (
    trackingData.marketplaceProcesses?.length > 0 ||
    trackingData.processHistory?.length > 0 ||
    trackingData.deliveryDate ||
    trackingData.externalDeliveryStatus ||
    trackingData.externalDeliveryEvent
  ));

  const trackingStatus = hasTracking ? deriveStatusFromTracking(trackingData.marketplaceProcesses, trackingData) : deriveFromLogisticsFields(trackingData);
  // ponytail: commerce return variants collapse to enum-safe status; initiated/declined stay Delivered
  const rawCommerce = orderData.orderStatus || 'Pending';
  const commerceStatus = normalizeReturnStatus(rawCommerce, rawCommerce);
  // ponytail: take higher rank of commerce vs tracking — stale tracking must not bury commerce Delivered
  let newStatus, statusSource;
  if (trackingStatus && STATUS_RANK.indexOf(trackingStatus) >= STATUS_RANK.indexOf(commerceStatus)) {
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
  const apiUpdatedAt = orderData.updatedAt ? new Date(orderData.updatedAt) : new Date();
  const now = new Date();
  const statusChanged = !existingOrder || existingOrder.orderStatus !== newStatus;
  const observedTimeline = [];
  if (orderData.createdAt) {
    observedTimeline.push({ status: 'Pending', timestamp: new Date(orderData.createdAt), source: 'commerce_api', accuracy: 'exact' });
  }
  if (hasTracking) observedTimeline.push(...extractStatusTimeline(trackingData));
  if (statusChanged && !observedTimeline.some(event => event.status === newStatus)) {
    observedTimeline.push({
      status: newStatus,
      timestamp: orderData.updatedAt ? new Date(orderData.updatedAt) : now,
      source: orderData.updatedAt ? 'commerce_api' : 'observed',
      accuracy: 'estimated'
    });
  }
  const timeline = mergeStatusHistory(existingOrder?.statusHistory || [], observedTimeline);
  const lifecycle = lifecycleFields({ ...existingOrder, statusHistory: timeline, trackingData });

  if (existingOrder) {
    // ponytail: API is truth for contact fields too — renames/payment changes must not freeze at insert
    // ponytail: keep stored statusSource when status unchanged — no-info sync must not flip provenance
    const setFields = { orderStatus: newStatus, apiUpdatedAt, lastSyncedAt: now,
      customer: orderData.customer || existingOrder.customer,
      vendor: orderData.vendor ?? existingOrder.vendor,
      paymentStatus: orderData.paymentStatus ?? existingOrder.paymentStatus,
      paymentMethod: orderData.paymentMethod ?? existingOrder.paymentMethod,
      source: orderData.source ?? existingOrder.source,
      totalAmount: orderData.totalAmount ?? existingOrder.totalAmount,
      shippingAmount: orderData.shippingAmount ?? existingOrder.shippingAmount };

    if (statusChanged || hasTracking) {
      setFields.statusHistory = timeline;
      setFields.statusSource = statusSource;
    }
    for (const field of ['processingAt', 'shippedAt', 'deliveredAt', 'cancelledAt', 'returnedAt']) {
      if (lifecycle[field]) setFields[field] = lifecycle[field];
    }

    if (hasTracking && trackingData) {
      if (!existingOrder.rawData) existingOrder.rawData = {};
      setFields['rawData.trackingProcesses'] = trackingData.marketplaceProcesses;
      setFields.trackingData = trackingData;
    }

    // ponytail: keep commerce snapshot fresh — audit views read rawData, stale lies
    if (orderData.orderStatus !== undefined) setFields['rawData.orderStatus'] = orderData.orderStatus;
    if (orderData.paymentStatus !== undefined) setFields['rawData.paymentStatus'] = orderData.paymentStatus;
    if (orderData.updatedAt !== undefined) setFields['rawData.updatedAt'] = orderData.updatedAt;

    const priceChanges = [];
    const newTotal = orderData.totalAmount || 0;
    if (existingOrder.totalAmount !== undefined && Number(existingOrder.totalAmount) !== Number(newTotal)) {
      priceChanges.push({ field: 'totalAmount', oldValue: existingOrder.totalAmount, newValue: newTotal, source: 'sync', timestamp: now });
    }
    const newShipping = orderData.shippingAmount || 0;
    if (existingOrder.shippingAmount !== undefined && Number(existingOrder.shippingAmount) !== Number(newShipping)) {
      priceChanges.push({ field: 'shippingAmount', oldValue: existingOrder.shippingAmount, newValue: newShipping, source: 'sync', timestamp: now });
    }
    if (priceChanges.length > 0) {
      setFields.priceHistory = [...(existingOrder.priceHistory || []), ...priceChanges];
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
    paymentMethod: orderData.paymentMethod,
    source: orderData.source,
    totalAmount: orderData.totalAmount || 0,
    shippingAmount: orderData.shippingAmount || 0,
    createdAt: orderData.createdAt ? new Date(orderData.createdAt) : new Date(),
    apiUpdatedAt,
    statusHistory: timeline,
    processingAt: lifecycle.processingAt,
    shippedAt: lifecycle.shippedAt,
    deliveredAt: lifecycle.deliveredAt,
    cancelledAt: lifecycle.cancelledAt,
    returnedAt: lifecycle.returnedAt,
    rawData: orderData,
    priceHistory: [],
    lastSyncedAt: now
  };
  if (hasTracking && trackingData) {
    doc.rawData = { ...orderData, trackingProcesses: trackingData.marketplaceProcesses };
    doc.trackingData = trackingData;
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
      .select('orderId apiUpdatedAt orderStatus customer vendor totalAmount shippingAmount paymentStatus priceHistory')
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
        // ponytail: timestamps equal ≠ status equal — tracking can still promote (e.g. to Delivered);
        // skip only terminal rows whose status can no longer advance
        if (['Delivered', 'Cancelled', 'Returned'].includes(existing.orderStatus)) {
          skippedCount++;
        } else {
          changedOrderData.push(orderData);
        }
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
    const flippedToReturned = [];
    const healedToDelivered = [];

    for (const orderData of newOrderData) {
      const orderId = orderData.orderId || orderData._id;
      const trackingData = trackingMap.get(orderId);
      const vendorLeadId = orderData.vendor
        ? (vendorLeadMap.get(orderData.vendor.toLowerCase()) || vendorLeadMap.get(orderData.vendor))
        : null;
      const update = buildOrderUpdate(orderData, trackingData, null);
      update.update.$setOnInsert.vendor_lead_id = vendorLeadId;
      upsertOps.push({ updateOne: { ...update, upsert: true } });
      if (update.update.$setOnInsert.orderStatus === 'Returned') flippedToReturned.push(orderId);
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
      if (update.update.$set?.orderStatus === 'Returned' && existing?.orderStatus !== 'Returned') flippedToReturned.push(orderId);
      if (update.update.$set?.orderStatus === 'Delivered' && existing?.orderStatus === 'Returned') healedToDelivered.push(orderId);
      updatedCount++;
    }

    // Execute writes
    if (upsertOps.length > 0) {
      await NepalcanOrder.bulkWrite(upsertOps, { ordered: false });
    }

    // ponytail: flag finance rows for newly-returned orders — keep row, exclude from totals
    if (flippedToReturned.length > 0) {
      try {
        const Finance = require('../models/Finance');
        await Finance.updateMany(
          { order_id: { $in: flippedToReturned }, is_returned: { $ne: true } },
          { $set: { is_returned: true, returned_at: new Date(), return_note: 'Order synced as Returned' } }
        );
      } catch (flagErr) {
        console.error('[Nepalcan Sync] Finance return flag failed:', flagErr.message);
      }
    }

    // ponytail: backfill heal — clear return flag on false Returned demoted to Delivered
    if (healedToDelivered.length > 0) {
      try {
        const Finance = require('../models/Finance');
        await Finance.updateMany(
          { order_id: { $in: healedToDelivered }, is_returned: true },
          { $set: { is_returned: false }, $unset: { returned_at: '', return_note: '' } }
        );
      } catch (healErr) {
        console.error('[Nepalcan Sync] Finance return heal failed:', healErr.message);
      }
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
          lastOrderDate: { $max: statusDateExpression('Delivered') }
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
            lastOrderDate: { $max: statusDateExpression('Delivered') }
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
    const { from, to } = getOrderSyncWindow();
    const activeOrders = await NepalcanOrder.find({
      // Returned orders can still have a valid delivery event (delivered,
      // then returned). Keep them in enrichment so deliveredAt is retained
      // for delivery-event and month-end reporting.
      orderStatus: { $in: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Returned'] },
      createdAt: { $gte: from, $lte: to }
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
      // ponytail: empty/unknown tracking yields null — must not demote Delivered to Pending
      if (!trackingData?.marketplaceProcesses?.length && !trackingData?.processHistory?.length && !trackingData?.deliveryDate && !deriveFromLogisticsFields(trackingData)) continue;
      const newStatus = deriveStatusFromTracking(trackingData?.marketplaceProcesses, trackingData);
      if (!newStatus) continue;
      const resolved = resolveStatus(order.orderStatus, newStatus, 'logistics_api');
      const timeline = extractStatusTimeline(trackingData);
      if (!order.rawData) order.rawData = {};
      if (Array.isArray(trackingData.marketplaceProcesses)) order.rawData.trackingProcesses = trackingData.marketplaceProcesses;
      const now = new Date();
      const priceChanges = [];
      if (trackingData.totalAmount !== undefined && order.totalAmount !== undefined && Number(order.totalAmount) !== Number(trackingData.totalAmount)) {
        priceChanges.push({ field: 'totalAmount', oldValue: order.totalAmount, newValue: trackingData.totalAmount, source: 'sync', timestamp: now });
      }
      if (trackingData.shippingAmount !== undefined && order.shippingAmount !== undefined && Number(order.shippingAmount) !== Number(trackingData.shippingAmount)) {
        priceChanges.push({ field: 'shippingAmount', oldValue: order.shippingAmount, newValue: trackingData.shippingAmount, source: 'sync', timestamp: now });
      }
      const setFields = {
        rawData: order.rawData,
        trackingData,
        lastSyncedAt: now,
        ...(trackingData.totalAmount !== undefined ? { totalAmount: Number(trackingData.totalAmount) } : {}),
        ...(trackingData.shippingAmount !== undefined ? { shippingAmount: Number(trackingData.shippingAmount) } : {})
      };
      // Refresh lifecycle dates even when the current status is unchanged.
      // Older rows can contain an estimated sync timestamp (for example the
      // August backfill date) while the provider now exposes an exact
      // deliveryDate in trackingData.  Previously this branch only rebuilt
      // dates after a status transition, leaving those stale estimates in
      // place forever.
      const mergedTimeline = timeline.length
        ? mergeStatusHistory(order.statusHistory || [], timeline)
        : (order.statusHistory || []);
      const lifecycle = lifecycleFields({ ...order.toObject(), statusHistory: mergedTimeline, trackingData });
      if (timeline.length > 0) setFields.statusHistory = mergedTimeline;
      for (const field of ['processingAt', 'shippedAt', 'deliveredAt', 'cancelledAt', 'returnedAt']) {
        if (lifecycle[field]) setFields[field] = lifecycle[field];
      }
      if (resolved.status !== order.orderStatus) {
        setFields.orderStatus = resolved.status;
        setFields.statusSource = resolved.source;
      }
      bulkOps.push({
        updateOne: {
          filter: { _id: order._id },
          update: {
            $set: setFields,
            ...(priceChanges.length > 0 ? { $push: { priceHistory: { $each: priceChanges } } } : {})
          }
        }
      });
      updated++;
    }
    if (bulkOps.length > 0) {
      await NepalcanOrder.bulkWrite(bulkOps, { ordered: false });
    }
    // ponytail: flag finance rows for orders that just flipped to Returned; heal falses demoted to Delivered
    try {
      const flipped = activeOrders.filter(o => {
        const td = trackingMap.get(o.orderId);
        return td?.marketplaceProcesses && deriveStatusFromTracking(td.marketplaceProcesses) === 'Returned' && o.orderStatus !== 'Returned';
      }).map(o => o.orderId);
      if (flipped.length) {
        const Finance = require('../models/Finance');
        await Finance.updateMany(
          { order_id: { $in: flipped }, is_returned: { $ne: true } },
          { $set: { is_returned: true, returned_at: new Date(), return_note: 'Order tracked as Returned' } }
        );
      }
      const healed = activeOrders.filter(o => {
        const td = trackingMap.get(o.orderId);
        return td?.marketplaceProcesses && deriveStatusFromTracking(td.marketplaceProcesses) === 'Delivered' && o.orderStatus === 'Returned';
      }).map(o => o.orderId);
      if (healed.length) {
        const Finance = require('../models/Finance');
        await Finance.updateMany(
          { order_id: { $in: healed }, is_returned: true },
          { $set: { is_returned: false }, $unset: { returned_at: '', return_note: '' } }
        );
      }
    } catch (flagErr) {
      console.error('[Tracking Enrichment] Finance return flag failed:', flagErr.message);
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
  buildOrderUpdate,
  syncNepalcanOrders,
  enrichOrdersWithTracking,
  getLastSyncLog,
  getRecentSyncLogs,
  deriveStatusFromTracking,
  deriveFromLogisticsFields,
  extractStatusTimeline,
  isReturnProcess,
  isReturnKeeper,
  normalizeReturnStatus,
  resolveStatus,
  batchFetchTracking,
  retryWithBackoff
};
