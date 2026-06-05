const NepalcanOrder = require('../models/NepalcanOrder');
const NepalcanSyncLog = require('../models/NepalcanSyncLog');
const Lead = require('../models/Lead');
const User = require('../models/User');
const axios = require('axios');

const API_BASE = 'https://commerce.thecanbrand.com/api';

const NEPA_CAN_EMAIL = process.env.NEPA_CAN_EMAIL || 'sabin.awal@buy.nepalcan.com';
const NEPA_CAN_PASSWORD = process.env.NEPA_CAN_PASSWORD || '1';

// Helper: Fetch service branches for a vendor from Nepalcan API
const fetchVendorServiceBranches = async (vendorNepalcanId, authToken) => {
  try {
    const response = await axios.get(
      `${API_BASE}/vendor-profile/serviceBranches`,
      {
        params: { vendor: vendorNepalcanId, status: true },
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'Origin': 'https://commerce.thecanbrand.com',
          'Referer': 'https://commerce.thecanbrand.com/'
        },
        timeout: 15000
      }
    );

    // Handle multiple response shapes
    const data = response.data;
    if (Array.isArray(data)) return data;
    if (data?.data && Array.isArray(data.data)) return data.data;
    if (data?.branches && Array.isArray(data.branches)) return data.branches;
    if (data?.data?.branches && Array.isArray(data.data.branches)) return data.data.branches;
    return [];
  } catch (err) {
    // Silently skip — don't fail the whole sync for one vendor's branches
    return [];
  }
};
let defaultSyncUser = null;

const getDefaultSyncUser = async () => {
  if (defaultSyncUser) return defaultSyncUser;
  try {
    defaultSyncUser = await User.findOne({ role: 'super_admin' }).select('_id');
    return defaultSyncUser;
  } catch (err) {
    console.error('[Sync] Could not find default user:', err.message);
    return null;
  }
};

const loginToNepalcan = async () => {
  try {
    console.log('[Nepalcan Login] Attempting login with email:', NEPA_CAN_EMAIL);
    
    const response = await axios.post(
      `${API_BASE}/users/login`,
      {
        email: NEPA_CAN_EMAIL,
        password: NEPA_CAN_PASSWORD
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://commerce.thecanbrand.com',
          'Referer': 'https://commerce.thecanbrand.com/',
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
        },
        timeout: 30000
      }
    );

    console.log('[Nepalcan Login] Response status:', response.status);
    
    if (response.data?.token) {
      console.log('[Nepalcan Login] Success - token received');
      return response.data.token;
    }
    throw new Error('No token received from Nepalcan login');
  } catch (error) {
    const errMsg = error.response?.data?.message || error.message || 'Unknown error';
    console.error('[Nepalcan Login] Error:', errMsg);
    console.error('[Nepalcan Login] Full error:', error.response?.data || error.stack);
    throw error;
  }
};

const syncNepalcanOrders = async (token = null) => {
  const startTime = Date.now();
  let synced = 0;
  let errorMessage = null;
  let apiResponse = null;

  let authToken = token;
  
  if (!authToken) {
    try {
      console.log('[Nepalcan Sync] No token provided, logging in...');
      authToken = await loginToNepalcan();
      console.log('[Nepalcan Sync] Login successful');
    } catch (loginErr) {
      errorMessage = 'Failed to login to Nepalcan: ' + (loginErr.response?.data?.message || loginErr.message);
      console.log(`[Nepalcan Sync] ${errorMessage}`);
      
      await NepalcanSyncLog.create({
        success: false,
        ordersSynced: 0,
        errorMessage,
        durationMs: Date.now() - startTime
      });
      
      return { synced: 0, message: errorMessage };
    }
  }

  try {
    const headers = {
      'Content-Type': 'application/json',
      'Origin': 'https://commerce.thecanbrand.com',
      'Referer': 'https://commerce.thecanbrand.com/'
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await axios.get(
      `${API_BASE}/vendor/orders/super-admin/list`,
      {
        params: {
          tab: 'marketplace',
          page: 1,
          limit: 500,
          unattendedOrders: '',
          status: 'Active'
        },
        headers,
        timeout: 30000
      }
    );

    apiResponse = {
      status: response.status,
      statusText: response.statusText,
      dataCount: response.data?.data?.orders?.length || response.data?.orders?.length || 0
    };

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

    let currentPage = 2;
    const totalPages = Math.min(10, Math.ceil((responseData?.data?.total || 1000) / 500));
    if (totalPages >= 2) {
      // Fetch pages 2..N in parallel (3 at a time) instead of serially
      const pagePromises = [];
      for (let p = 2; p <= totalPages; p++) {
        pagePromises.push(
          axios.get(`${API_BASE}/vendor/orders/super-admin/list`, {
            params: {
              tab: 'marketplace',
              page: p,
              limit: 500,
              unattendedOrders: '',
              status: 'Active'
            },
            headers,
            timeout: 30000
          }).then(r => r.data).catch(err => {
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

    for (const orderData of ordersList) {
      try {
        const orderId = orderData.orderId || orderData._id;
        if (!orderId) continue;

        const existingOrder = await NepalcanOrder.findOne({ orderId });
        let newStatus = orderData.orderStatus || 'Pending';
        const newUpdatedAt = orderData.updatedAt ? new Date(orderData.updatedAt) : new Date();

        // Check marketplaceProcesses for "returned" status — overrides main orderStatus
        if (orderData.marketplaceProcesses && Array.isArray(orderData.marketplaceProcesses)) {
          const hasReturned = orderData.marketplaceProcesses.some(
            p => p.process && p.process.toLowerCase() === 'returned'
          );
          if (hasReturned) {
            newStatus = 'Returned';
          }
        }

        let vendorLeadId = null;
        if (orderData.vendor) {
          const vendorLead = await Lead.findOne({
            $or: [
              { business_name: { $regex: orderData.vendor, $options: 'i' } },
              { nepalcanId: orderData.vendor }
            ]
          });
          if (vendorLead) {
            vendorLeadId = vendorLead._id;
          }
        }

        if (!existingOrder) {
          const statusHistoryEntry = {
            status: newStatus,
            timestamp: newUpdatedAt
          };

          let historicalStatuses = [];
          let createdAt = null;
          
          if (orderData.createdAt) {
            createdAt = new Date(orderData.createdAt);
            historicalStatuses.push({ status: 'Pending', timestamp: createdAt });
            
            if (newStatus === 'Delivered') {
              const midpoint = new Date((createdAt.getTime() + newUpdatedAt.getTime()) / 2);
              historicalStatuses.push({ status: 'Processing', timestamp: midpoint });
              historicalStatuses.push({ status: 'Delivered', timestamp: newUpdatedAt });
            } else if (newStatus === 'Shipped') {
              const twoThirds = new Date(createdAt.getTime() + (newUpdatedAt.getTime() - createdAt.getTime()) * 2 / 3);
              historicalStatuses.push({ status: 'Processing', timestamp: twoThirds });
              historicalStatuses.push({ status: 'Shipped', timestamp: newUpdatedAt });
            }
          }

          const newOrder = new NepalcanOrder({
            orderId,
            nepalcanId: orderData._id,
            customer: orderData.customer || 'Unknown',
            vendor: orderData.vendor,
            vendor_lead_id: vendorLeadId,
            orderStatus: newStatus,
            paymentStatus: orderData.paymentStatus,
            totalAmount: orderData.totalAmount || 0,
            shippingAmount: orderData.shippingAmount || 0,
            createdAt: createdAt || new Date(),
            updatedAt: newUpdatedAt,
            statusHistory: historicalStatuses.length > 0 ? historicalStatuses : [statusHistoryEntry],
            rawData: orderData,
            lastSyncedAt: new Date()
          });

          await newOrder.save();

          synced++;
        } else {
          const oldStatus = existingOrder.orderStatus;

          if (oldStatus !== newStatus) {
            const statusHistoryEntry = {
              status: newStatus,
              timestamp: newUpdatedAt
            };
            existingOrder.statusHistory.push(statusHistoryEntry);
            existingOrder.orderStatus = newStatus;
          }

          if (vendorLeadId) {
            existingOrder.vendor_lead_id = vendorLeadId;
          }

          existingOrder.updatedAt = newUpdatedAt;
          existingOrder.paymentStatus = orderData.paymentStatus || existingOrder.paymentStatus;
          existingOrder.totalAmount = orderData.totalAmount || existingOrder.totalAmount;
          existingOrder.lastSyncedAt = new Date();

          await existingOrder.save();
          synced++;
        }
      } catch (err) {
        console.error(`[Nepalcan Sync] Error processing order ${orderData.orderId}:`, err.message);
      }
    }

    console.log(`[Nepalcan Sync] Synced ${synced} orders`);

    // Enrich active orders with tracking data from logistics API (before aggregation)
    const trackingUpdates = await enrichOrdersWithTracking();
    if (trackingUpdates > 0) {
      console.log(`[Nepalcan Sync] Tracking enrichment updated ${trackingUpdates} orders`);
    }

// Update Lead records with active seller metrics
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
          const syncUserId = userId || (await getDefaultSyncUser())?._id;
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
        console.log(`[Nepalcan Sync] Updated lead ${leadToUpdate.business_name}: ${deliveredCount} delivered orders - Active Seller`);
      }
    }

    // Retroactively fix orders with null vendor_lead_id by matching vendor name
    const ordersToFix = await NepalcanOrder.find({
      orderStatus: 'Delivered',
      vendor_lead_id: null,
      vendor: { $exists: true, $ne: null }
    });

    if (ordersToFix.length > 0) {
      console.log(`[Nepalcan Sync] Fixing ${ordersToFix.length} orders with missing vendor_lead_id`);

      for (const order of ordersToFix) {
        const vendorLead = await Lead.findOne({
          $or: [
            { business_name: { $regex: order.vendor, $options: 'i' } },
            { nepalcanId: order.vendor }
          ]
        });

        if (vendorLead) {
          order.vendor_lead_id = vendorLead._id;
          await order.save();
          console.log(`[Nepalcan Sync] Fixed order ${order.orderId} -> ${vendorLead.business_name}`);
        }
      }

      // Re-run aggregation now that orders are fixed
      const fixedOrdersAgg = await NepalcanOrder.aggregate([
        { $match: { orderStatus: 'Delivered', vendor_lead_id: { $ne: null } } },
        { $group: {
          _id: '$vendor_lead_id',
          deliveredCount: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          lastOrderDate: { $max: '$updatedAt' }
        } }
      ]);

      for (const vendorData of fixedOrdersAgg) {
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
            const syncUserId = userId || (await getDefaultSyncUser())?._id;
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
        }
      }
    }
  } catch (error) {
    errorMessage = error.response?.data?.message || error.message || 'Unknown error';
    apiResponse = {
      status: error.response?.status,
      statusText: error.response?.statusText,
      errorMessage: error.message
    };
    console.error('[Nepalcan Sync] Error:', errorMessage);
    console.error('[Nepalcan Sync] Full error:', error.response?.data || error.stack);
  }

  const durationMs = Date.now() - startTime;

  await NepalcanSyncLog.create({
    success: !errorMessage,
    ordersSynced: synced,
    errorMessage,
    apiResponse,
    durationMs
  });

  // Tracking enrichment already ran synchronously above — no background call needed

  return {
    synced,
    message: errorMessage || `Successfully synced ${synced} orders`,
    apiResponse
  };
};

const updateStaleOrders = async () => {
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const staleOrders = await NepalcanOrder.find({
      lastSyncedAt: { $lt: twoHoursAgo },
      orderStatus: { $in: ['Pending', 'Processing'] }
    });

    console.log(`[Stale Orders] Found ${staleOrders.length} orders to recheck`);
    return staleOrders.length;
  } catch (error) {
    console.error('[Stale Orders] Error:', error.message);
    return 0;
  }
};

const LOGISTICS_API = 'https://can-logistic-prod-84pie.ondigitalocean.app/api/public/marketplace-tracker';

/**
 * Enrich all active orders with tracking data from the logistics API.
 * This catches returned orders that disappear from the commerce API,
 * and stores the full tracking timeline on each order.
 */
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
    let updated = 0;
    let returned = 0;

    // Process in batches of 10 with delay to avoid rate limits
    const BATCH_SIZE = 10;
    for (let i = 0; i < activeOrders.length; i += BATCH_SIZE) {
      const batch = activeOrders.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (order) => {
          try {
            const response = await axios.get(`${LOGISTICS_API}/${order.orderId}`, { timeout: 10000 });
            const trackingData = response.data;
            return { order, trackingData, error: null };
          } catch (err) {
            return { order, trackingData: null, error: err.response?.status || err.message };
          }
        })
      );

      const bulkOps = [];
      for (const result of results) {
        if (result.status !== 'fulfilled' || !result.value.trackingData) continue;
        const { order, trackingData } = result.value;

        let changed = false;

        // Store full tracking data on the order
        if (trackingData?.marketplaceProcesses && Array.isArray(trackingData.marketplaceProcesses)) {
          // Check for returned status
          const hasReturned = trackingData.marketplaceProcesses.some(
            p => p.process && p.process.toLowerCase() === 'returned'
          );

          if (hasReturned && order.orderStatus !== 'Returned') {
            order.orderStatus = 'Returned';
            const alreadyHasReturned = order.statusHistory.some(h => h.status === 'Returned');
            if (!alreadyHasReturned) {
              order.statusHistory.push({ status: 'Returned', timestamp: new Date() });
            }
            changed = true;
            returned++;
            console.log(`[Tracking Enrichment] Order ${order.orderId} → Returned`);
          }

          // Check for other status updates from tracking (e.g. Delivered, Shipped)
          if (!hasReturned) {
            const processes = trackingData.marketplaceProcesses.map(p => p.process?.toLowerCase()).filter(Boolean);
            if (processes.includes('delivered') && order.orderStatus !== 'Delivered' && order.orderStatus !== 'Returned') {
              order.orderStatus = 'Delivered';
              const alreadyHas = order.statusHistory.some(h => h.status === 'Delivered');
              if (!alreadyHas) {
                order.statusHistory.push({ status: 'Delivered', timestamp: new Date() });
              }
              changed = true;
            } else if (processes.includes('shipped') && !['Shipped', 'Delivered', 'Returned'].includes(order.orderStatus)) {
              order.orderStatus = 'Shipped';
              const alreadyHas = order.statusHistory.some(h => h.status === 'Shipped');
              if (!alreadyHas) {
                order.statusHistory.push({ status: 'Shipped', timestamp: new Date() });
              }
              changed = true;
            } else if (processes.includes('processing') && !['Processing', 'Shipped', 'Delivered', 'Returned'].includes(order.orderStatus)) {
              order.orderStatus = 'Processing';
              const alreadyHas = order.statusHistory.some(h => h.status === 'Processing');
              if (!alreadyHas) {
                order.statusHistory.push({ status: 'Processing', timestamp: new Date() });
              }
              changed = true;
            }
          }

          // Store tracking processes on rawData for reference
          if (!order.rawData) order.rawData = {};
          order.rawData.trackingProcesses = trackingData.marketplaceProcesses;
        }

        if (changed) updated++;

        // Defer persistence to a single bulkWrite per batch
        bulkOps.push({
          updateOne: {
            filter: { _id: order._id },
            update: {
              $set: {
                orderStatus: order.orderStatus,
                statusHistory: order.statusHistory,
                rawData: order.rawData,
                lastSyncedAt: new Date()
              }
            }
          }
        });
      }

      if (bulkOps.length > 0) {
        try {
          await NepalcanOrder.bulkWrite(bulkOps, { ordered: false });
        } catch (bulkErr) {
          console.error('[Tracking Enrichment] bulkWrite error:', bulkErr.message);
        }
      }

      // Small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < activeOrders.length) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    console.log(`[Tracking Enrichment] Updated ${updated} orders (${returned} returned)`);
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

/**
 * Extract vendors array from API response - handles multiple response structures
 */
const extractVendors = (response) => {
  const data = response.data;
  
  // Direct array
  if (Array.isArray(data)) return data;
  
  // { data: [...] } - Nepalcan vendor API format
  if (data?.data && Array.isArray(data.data)) return data.data;
  
  // { vendors: [...] }
  if (data?.vendors && Array.isArray(data.vendors)) return data.vendors;
  
  // { data: { vendors: [...] } }
  if (data?.data?.vendors && Array.isArray(data.data.vendors)) return data.data.vendors;
  
  // Fallback: find any array that looks like vendors
  if (typeof data === 'object') {
    for (const key of Object.keys(data)) {
      if (Array.isArray(data[key]) && data[key].length > 0 && typeof data[key][0] === 'object') {
        return data[key];
      }
    }
  }
  
  return [];
};

/**
 * Get total count from API response - handles multiple response structures
 */
const getTotalCount = (response) => {
  const data = response.data;
  
  // Try totalItems first (based on your API response)
  if (typeof data?.totalItems === 'number') return data.totalItems;
  if (typeof data?.data?.totalItems === 'number') return data.data.totalItems;
  
  // Try total
  if (typeof data?.total === 'number') return data.total;
  if (typeof data?.data?.total === 'number') return data.data.total;
  
  return 0;
};

/**
* Sync vendors from Nepalcan API with pagination support
   * - All vendors are stored directly in leads collection with type='vendor'
   * - Matching by nepalcanId, email, phone, or business_name
   * - Verified vendors: lead_status='Activated', verification_status='verified', onboarding_stage='seller_activated', activation_status='active'
   * - Unverified vendors: lead_status='Document Pending', verification_status='pending', onboarding_stage='documents_pending', activation_status='inactive'
   * - Vendors with delivered orders become 'Active Seller' with active_seller=true
   */
const syncNepalcanVendors = async (token = null, userId = null) => {
   const startTime = Date.now();
   let synced = 0;
   let updated = 0;
   let created = 0;
   let errorMessage = null;
   
   let authToken = token;
   
   if (!authToken) {
     try {
       console.log('[Nepalcan Vendor Sync] No token provided, logging in...');
       authToken = await loginToNepalcan();
     } catch (loginErr) {
       errorMessage = 'Failed to login to Nepalcan: ' + (loginErr.message || 'Unknown error');
       console.log(`[Nepalcan Vendor Sync] ${errorMessage}`);
       
       await NepalcanSyncLog.create({
         type: 'vendors',
         success: false,
         vendorsSynced: 0,
         leadsSynced: 0,
         mergedRecords: 0,
         errorMessage,
         durationMs: Date.now() - startTime
       });
       
       return { synced: 0, updated: 0, created: 0, message: errorMessage };
     }
   }

   try {
     console.log('[Nepalcan Vendor Sync] Fetching page 1...');
     const firstResponse = await axios.get(
       `${API_BASE}/vendor/super-admin/list`,
       {
         params: { page: 1, limit: 100, type: 'Business' },
         headers: {
           'Authorization': `Bearer ${authToken}`,
           'Content-Type': 'application/json',
           'Origin': 'https://commerce.thecanbrand.com',
           'Referer': 'https://commerce.thecanbrand.com/'
         },
         timeout: 30000
       }
     );

     const totalItems = getTotalCount(firstResponse);
     const totalPages = Math.ceil(totalItems / 100);
     
     console.log(`[Nepalcan Vendor Sync] API Response keys: ${Object.keys(firstResponse.data).join(', ')}`);
     console.log(`[Nepalcan Vendor Sync] Total items reported: ${totalItems}, Calculated pages: ${totalPages}`);

     let allVendors = extractVendors(firstResponse);
     console.log(`[Nepalcan Vendor Sync] Page 1: extracted ${allVendors.length} vendors`);

     for (let page = 2; page <= totalPages && page <= 50; page++) {
       try {
         console.log(`[Nepalcan Vendor Sync] Fetching page ${page}/${totalPages}...`);
         const pageResponse = await axios.get(
           `${API_BASE}/vendor/super-admin/list`,
           {
             params: { page, limit: 100, type: 'Business' },
             headers: {
               'Authorization': `Bearer ${authToken}`,
               'Content-Type': 'application/json',
               'Origin': 'https://commerce.thecanbrand.com',
               'Referer': 'https://commerce.thecanbrand.com/'
             },
             timeout: 30000
           }
         );

         console.log(`[Nepalcan Vendor Sync] Page ${page} raw response keys: ${Object.keys(pageResponse.data).join(', ')}`);
         
         const pageVendors = extractVendors(pageResponse);
         allVendors = [...allVendors, ...pageVendors];
         console.log(`[Nepalcan Vendor Sync] Page ${page}: extracted ${pageVendors.length} vendors, total so far: ${allVendors.length}`);
       } catch (pageErr) {
         console.error(`[Nepalcan Vendor Sync] Error fetching page ${page}:`, pageErr.message);
         console.error(`[Nepalcan Vendor Sync] Full error for page ${page}:`, pageErr.response?.status, pageErr.response?.data);
         break;
       }
     }

console.log(`[Nepalcan Vendor Sync] Total vendors to process: ${allVendors.length}`);
      
      for (const vendor of allVendors) {
        const { _id, name, email, phone, isVerified, activeMarketplaceProductCount, productCount, activeProductsCount, address, createdAt, updatedAt, canId, slug } = vendor;
        
        const productCountFromAPI = activeMarketplaceProductCount || productCount || activeProductsCount || 0;
        console.log(`[Sync Vendor] ${name}: activeMarketplaceProductCount=${activeMarketplaceProductCount}, productCount=${productCount}, activeProductsCount=${activeProductsCount}`);

        const existingLead = await Lead.findOne({
          $or: [
            { nepalcanId: _id },
            { email: email },
            { phone: phone },
            { business_name: { $regex: `^${name}$`, $options: 'i' } }
          ]
        });

const leadData = {
             business_name: name,
             contact_person: name,
             email: email || 'TBD',
             phone: phone || 'TBD',
             location: address || 'TBD',
             lead_source: 'Nepalcan',
             expected_product_count: productCountFromAPI,
             nepalcanId: _id,
             type: 'vendor',
             is_verified: isVerified,
             verification_status: isVerified ? 'verified' : 'pending',
             onboarding_stage: isVerified ? 'seller_activated' : 'documents_pending',
             activation_status: isVerified ? 'active' : 'inactive',
             lead_status: isVerified ? 'Activated' : 'Document Pending',
             rawData: {
               canId: canId?.canId,
               slug,
               createdAt,
               updatedAt,
               address
             }
           };

        if (existingLead) {
          const previousNepalcanStatus = existingLead.last_nepalcan_status;
          const newNepalcanStatus = leadData.lead_status;

          // Never downgrade from 'Active Seller' to 'Activated' — aggregation handles the upgrade
          if (existingLead.lead_status === 'Active Seller' && newNepalcanStatus === 'Activated') {
            // Only update non-status fields, keep Active Seller status
            existingLead.business_name = leadData.business_name;
            existingLead.contact_person = leadData.contact_person;
            existingLead.email = leadData.email;
            existingLead.phone = leadData.phone;
            existingLead.location = leadData.location;
            existingLead.expected_product_count = leadData.expected_product_count;
            existingLead.is_verified = leadData.is_verified;
            existingLead.verification_status = leadData.verification_status;
            existingLead.onboarding_stage = leadData.onboarding_stage;
            existingLead.activation_status = leadData.activation_status;
            if (!existingLead.nepalcanId) existingLead.nepalcanId = _id;
            existingLead.last_nepalcan_status = newNepalcanStatus;
            await existingLead.save();
            updated++;
            continue;
          }

          Object.assign(existingLead, leadData);
          if (!existingLead.nepalcanId) existingLead.nepalcanId = _id;
          existingLead.last_nepalcan_status = newNepalcanStatus;
          // Track activation date — only when transitioning from a known prior status (not first sync)
          if (previousNepalcanStatus && newNepalcanStatus === 'Activated' && previousNepalcanStatus !== 'Activated') {
            if (!existingLead.converted_at) existingLead.converted_at = new Date();
          }
          await existingLead.save();

          // Only log activity if Nepalcan's own status changed (not our internal lead_status)
          if (previousNepalcanStatus && previousNepalcanStatus !== newNepalcanStatus) {
            const Activity = require('../models/Activity');
            const syncUserId = userId || (await getDefaultSyncUser())?._id;
            if (syncUserId) {
              await Activity.create({
                lead_id: existingLead._id,
                user_id: syncUserId,
                activity_type: 'status_change',
                description: `Pipeline changed (sync): ${previousNepalcanStatus} → ${newNepalcanStatus}`,
                status: 'completed'
              });
            }
          }

          updated++;
          console.log(`[Sync Vendor] Updated lead ${name}`);
        } else {
          const creatorId = userId || (await getDefaultSyncUser())?._id;
          leadData.creator_id = creatorId;
          leadData.last_nepalcan_status = leadData.lead_status;
          if (leadData.lead_status === 'Activated') {
            leadData.converted_at = new Date();
          }

          const newLead = new Lead(leadData);
          await newLead.save();
          created++;
          console.log(`[Sync Vendor] Created lead ${name}`);
        }
        synced++;
      }

const durationMs = Date.now() - startTime;
      
      console.log(`[Nepalcan Vendor Sync] COMPLETE - Total: ${synced}, Updated: ${updated}, Created: ${created}`);

     // Sync service branches for vendors
     console.log('[Nepalcan Vendor Sync] Syncing service branches...');
     const branchesResult = await syncServiceBranches(authToken);
     console.log(`[Nepalcan Vendor Sync] Service branches sync complete: ${branchesResult.updated} vendors updated`);

// Update Lead records with active seller metrics from delivered orders
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
            const syncUserId = userId || (await getDefaultSyncUser())?._id;
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
        }
      }

      // Retroactively fix orders with null vendor_lead_id by matching vendor name
      const ordersToFix = await NepalcanOrder.find({ 
        orderStatus: 'Delivered', 
        vendor_lead_id: null,
        vendor: { $exists: true, $ne: null }
      });
      
      if (ordersToFix.length > 0) {
        console.log(`[Nepalcan Vendor Sync] Fixing ${ordersToFix.length} orders with missing vendor_lead_id`);
        
        for (const order of ordersToFix) {
          const vendorLead = await Lead.findOne({
            $or: [
              { business_name: { $regex: order.vendor, $options: 'i' } },
              { nepalcanId: order.vendor }
            ]
          });
          
          if (vendorLead) {
            order.vendor_lead_id = vendorLead._id;
            await order.save();
            console.log(`[Nepalcan Vendor Sync] Fixed order ${order.orderId} -> ${vendorLead.business_name}`);
          }
        }
      }

      await NepalcanSyncLog.create({
       type: 'vendors',
       success: !errorMessage,
       vendorsSynced: synced,
       leadsSynced: created,
       mergedRecords: updated,
       totalProcessed: allVendors.length,
       errorMessage,
       durationMs
     });

     return { synced, updated, created, message: errorMessage || 'Success' };
   } catch (error) {
     errorMessage = error.response?.data?.message || error.message || 'Unknown error';
     console.error('[Nepalcan Vendor Sync] Error:', errorMessage);
     
     const durationMs = Date.now() - startTime;
     
     await NepalcanSyncLog.create({
       type: 'vendors',
       success: false,
       vendorsSynced: synced,
       leadsSynced: created,
       mergedRecords: updated,
       errorMessage,
       durationMs
     });

     return { synced, updated, created, message: errorMessage };
   }
};

/**
 * Sync service branches for all vendors that have a nepalcanId.
 * Fetches branches from Nepalcan API and matches to DeliveryZoneGroup branches.
 */
const syncServiceBranches = async (token = null) => {
  const DeliveryZoneGroup = require('../models/DeliveryZoneGroup');
  const startTime = Date.now();
  let authToken = token;

  if (!authToken) {
    try {
      authToken = await loginToNepalcan();
    } catch (err) {
      console.error('[Service Branches] Failed to login:', err.message);
      return { updated: 0, message: 'Login failed' };
    }
  }

  // Load all delivery zone branches for matching
  const zoneGroups = await DeliveryZoneGroup.find({}).lean();
  const branchLookup = {};
  for (const group of zoneGroups) {
    for (const branch of group.branches) {
      branchLookup[branch.nepalcanId] = branch.name;
    }
  }

  // Get all vendors with nepalcanId
  const vendors = await Lead.find({
    type: 'vendor',
    nepalcanId: { $exists: true, $ne: null }
  }).select('nepalcanId business_name service_branches').lean();

  console.log(`[Service Branches] Checking ${vendors.length} vendors...`);
  let updated = 0;

  for (const vendor of vendors) {
    const apiBranches = await fetchVendorServiceBranches(vendor.nepalcanId, authToken);
    if (apiBranches.length === 0) continue;

    // Match API branches to our DeliveryZoneGroup branches
    const matched = [];
    for (const branch of apiBranches) {
      const branchId = branch._id || branch.id || branch.branchId || branch.nepalcanId;
      const branchName = branch.name || branch.branchName || branch.label;
      if (branchId) {
        // Try to match against our zone branches for a better name
        const zoneName = branchLookup[branchId];
        matched.push({ branchId: String(branchId), name: zoneName || branchName || String(branchId) });
      }
    }

    if (matched.length > 0) {
      await Lead.findByIdAndUpdate(vendor._id, { service_branches: matched });
      updated++;
      console.log(`[Service Branches] Updated ${vendor.business_name}: ${matched.length} branches`);
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200));
  }

  const durationMs = Date.now() - startTime;
  console.log(`[Service Branches] Done — ${updated} vendors updated in ${durationMs}ms`);
  return { updated, message: `Updated ${updated} vendors with service branches` };
};

/**
 * Sync all Nepalcan data: orders and vendors together
 * Runs both syncs sequentially with a single login
 */
const syncAllNepalcanData = async (userId = null) => {
  const startTime = Date.now();
  let loginToken = null;
  let ordersResult = { synced: 0, message: '' };
  let vendorsResult = { synced: 0, updated: 0, created: 0, message: '' };
  let errorMessage = null;

  try {
    console.log('[Full Sync] Getting Nepalcan token...');
    loginToken = await loginToNepalcan();
    console.log('[Full Sync] Login successful');

    console.log('[Full Sync] Starting orders sync...');
    ordersResult = await syncNepalcanOrders(loginToken);
    console.log(`[Full Sync] Orders sync complete: ${ordersResult.synced} orders`);

    console.log('[Full Sync] Starting vendors sync...');
    vendorsResult = await syncNepalcanVendors(loginToken, userId);
    console.log(`[Full Sync] Vendors sync complete: ${vendorsResult.synced} vendors`);

    console.log('[Full Sync] Starting service branches sync...');
    const branchesResult = await syncServiceBranches(loginToken);
    console.log(`[Full Sync] Service branches sync complete: ${branchesResult.updated} vendors updated`);
  } catch (err) {
    errorMessage = err.message;
    console.error('[Full Sync] Error:', errorMessage);
  }

  const durationMs = Date.now() - startTime;

  await NepalcanSyncLog.create({
    type: 'full',
    success: !errorMessage,
    ordersSynced: ordersResult.synced || 0,
    vendorsSynced: vendorsResult.synced || 0,
    leadsSynced: vendorsResult.created || 0,
    mergedRecords: vendorsResult.updated || 0,
    errorMessage,
    durationMs
  });

  return {
    success: !errorMessage,
    orders: ordersResult,
    vendors: vendorsResult,
    durationMs
  };
};

module.exports = {
  syncNepalcanOrders,
  updateStaleOrders,
  enrichOrdersWithTracking,
  getLastSyncLog,
  getRecentSyncLogs,
  loginToNepalcan,
  syncNepalcanVendors,
  syncAllNepalcanData,
  syncServiceBranches
};