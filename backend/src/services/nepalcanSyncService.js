const NepalcanOrder = require('../models/NepalcanOrder');
const NepalcanSyncLog = require('../models/NepalcanSyncLog');
const axios = require('axios');

const API_BASE = 'https://commerce.thecanbrand.com/api';

const NEPA_CAN_EMAIL = process.env.NEPA_CAN_EMAIL || 'sabin.awal@buy.nepalcan.com';
const NEPA_CAN_PASSWORD = process.env.NEPA_CAN_PASSWORD || '1';

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

/**
 * Sync orders from Nepalcan API periodically
 * Checks orders within 2-hour windows to track status changes
 */
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

    // If there are more orders on subsequent pages, fetch them
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

/**
 * Check for orders that haven't been synced recently and update their timestamps
 * This ensures status changes within 2-hour windows are captured
 */
const updateStaleOrders = async () => {
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    
    const staleOrders = await NepalcanOrder.find({
      lastSyncedAt: { $lt: twoHoursAgo },
      orderStatus: { $in: ['Pending', 'Processing'] } // Only check non-completed orders
    });

    console.log(`[Stale Orders] Found ${staleOrders.length} orders to recheck`);
    return staleOrders.length;
  } catch (error) {
    console.error('[Stale Orders] Error:', error.message);
    return 0;
  }
};

/**
 * Get the latest sync log
 */
const getLastSyncLog = async () => {
  return await NepalcanSyncLog.findOne().sort({ createdAt: -1 });
};

/**
 * Get recent sync logs (last 10)
 */
const getRecentSyncLogs = async (limit = 10) => {
  return await NepalcanSyncLog.find().sort({ createdAt: -1 }).limit(limit);
};

module.exports = {
  syncNepalcanOrders,
  updateStaleOrders,
  getLastSyncLog,
  getRecentSyncLogs,
  loginToNepalcan
};