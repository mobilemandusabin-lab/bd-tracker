const NepalcanOrder = require('../models/NepalcanOrder');
const NepalcanSyncLog = require('../models/NepalcanSyncLog');
const Lead = require('../models/Lead');
const User = require('../models/User');
const axios = require('axios');

const API_BASE = 'https://commerce.thecanbrand.com/api';

const NEPA_CAN_EMAIL = process.env.NEPA_CAN_EMAIL || 'sabin.awal@buy.nepalcan.com';
const NEPA_CAN_PASSWORD = process.env.NEPA_CAN_PASSWORD || '1';
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
    while (ordersList.length < (responseData?.data?.total || 1000) && currentPage <= 10) {
      try {
        const nextPageRes = await axios.get(`${API_BASE}/vendor/orders/super-admin/list`, {
          params: {
            tab: 'marketplace',
            page: currentPage,
            limit: 500,
            unattendedOrders: '',
            status: 'Active'
          },
          headers,
          timeout: 30000
        });
        
        const nextPageData = nextPageRes.data;
        let nextOrders = [];
        
        if (nextPageData?.data?.orders && Array.isArray(nextPageData.data.orders)) {
          nextOrders = nextPageData.data.orders;
        } else if (nextPageData?.orders && Array.isArray(nextPageData.orders)) {
          nextOrders = nextPageData.orders;
        }
        
        if (nextOrders.length === 0) break;
        ordersList = [...ordersList, ...nextOrders];
        currentPage++;
      } catch (pageErr) {
        console.error(`[Nepalcan Sync] Error fetching page ${currentPage}:`, pageErr.message);
        break;
      }
    }

    for (const orderData of ordersList) {
      try {
        const orderId = orderData.orderId || orderData._id;
        if (!orderId) continue;

        const existingOrder = await NepalcanOrder.findOne({ orderId });
        const newStatus = orderData.orderStatus || 'Pending';
        const newUpdatedAt = orderData.updatedAt ? new Date(orderData.updatedAt) : new Date();

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

    // Update Lead records with active seller metrics
    const deliveredOrdersAgg = await NepalcanOrder.aggregate([
      { $match: { orderStatus: 'Delivered' } },
      { $group: { 
        _id: '$vendor', 
        deliveredCount: { $sum: 1 }, 
        totalAmount: { $sum: '$totalAmount' },
        lastOrderDate: { $max: '$updatedAt' }
      } }
    ]);
    
    for (const vendorData of deliveredOrdersAgg) {
      const { _id: vendorName, deliveredCount, totalAmount, lastOrderDate } = vendorData;
      if (!vendorName) continue;
      
      const updated = await Lead.findOneAndUpdate(
        { type: 'vendor', business_name: { $regex: `^${vendorName}$`, $options: 'i' } },
        { 
          delivered_order_count: deliveredCount,
          active_seller: deliveredCount > 0,
          last_order_date: lastOrderDate
        },
        { new: true }
      );
      
      if (updated) {
        console.log(`[Nepalcan Sync] Updated lead ${vendorName}: ${deliveredCount} delivered orders`);
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
 * - Unverified vendors: lead_status='Document Pending', verification_status='pending', onboarding_stage='document_pending', activation_status='inactive'
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
           onboarding_stage: isVerified ? 'seller_activated' : 'document_pending',
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
          Object.assign(existingLead, leadData);
          if (!existingLead.nepalcanId) existingLead.nepalcanId = _id;
          await existingLead.save();
          updated++;
          console.log(`[Sync Vendor] Updated lead ${name}`);
        } else {
          const creatorId = userId || (await getDefaultSyncUser())?._id;
          leadData.creator_id = creatorId;

          const newLead = new Lead(leadData);
          await newLead.save();
          created++;
          console.log(`[Sync Vendor] Created lead ${name}`);
        }
        synced++;
      }

const durationMs = Date.now() - startTime;
      
      console.log(`[Nepalcan Vendor Sync] COMPLETE - Total: ${synced}, Updated: ${updated}, Created: ${created}`);

      // Update Lead records with active seller metrics from delivered orders
      const deliveredOrdersAgg = await NepalcanOrder.aggregate([
        { $match: { orderStatus: 'Delivered' } },
        { $group: { 
          _id: '$vendor', 
          deliveredCount: { $sum: 1 }, 
          lastOrderDate: { $max: '$updatedAt' }
        } }
      ]);
      
      for (const vendorData of deliveredOrdersAgg) {
        const { _id: vendorName, deliveredCount, lastOrderDate } = vendorData;
        if (!vendorName) continue;
        
        await Lead.findOneAndUpdate(
          { type: 'vendor', business_name: { $regex: `^${vendorName}$`, $options: 'i' } },
          { 
            delivered_order_count: deliveredCount,
            active_seller: deliveredCount > 0,
            last_order_date: lastOrderDate
          }
        );
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

module.exports = {
  syncNepalcanOrders,
  updateStaleOrders,
  getLastSyncLog,
  getRecentSyncLogs,
  loginToNepalcan,
  syncNepalcanVendors
};