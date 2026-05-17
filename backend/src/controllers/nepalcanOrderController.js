const NepalcanOrder = require('../models/NepalcanOrder');
const NepalcanSyncLog = require('../models/NepalcanSyncLog');
const axios = require('axios');

const API_BASE = 'https://commerce.thecanbrand.com/api';

// Sync orders from Nepalcan API to database
exports.syncNepalcanOrders = async (req, res) => {
  try {
    const { orders, token } = req.body;
    
    if (!orders || !Array.isArray(orders)) {
      return res.status(400).json({ message: 'Invalid orders data' });
    }

    const results = {
      created: 0,
      updated: 0,
      errors: []
    };

    for (const orderData of orders) {
      try {
        const orderId = orderData.orderId || orderData._id;
        
        if (!orderId) {
          results.errors.push(`Skipping order without ID: ${JSON.stringify(orderData).substring(0, 100)}`);
          continue;
        }

        // Check if order already exists
        let existingOrder = await NepalcanOrder.findOne({ orderId });
        
        // Build complete status history from API data
        const statusHistoryEntry = {
          status: orderData.orderStatus || 'Pending',
          timestamp: orderData.updatedAt ? new Date(orderData.updatedAt) : new Date()
        };

        // Build historical status changes
        const historicalStatuses = [];
        
        // If order has status history from API, use it
        if (orderData.statusHistory && Array.isArray(orderData.statusHistory)) {
          historicalStatuses.push(...orderData.statusHistory.map(h => ({
            status: h.status,
            timestamp: h.timestamp ? new Date(h.timestamp) : new Date()
          })));
        } else if (orderData.createdAt && orderData.updatedAt) {
          // Infer intermediate statuses for complete tracking
          const createdAt = new Date(orderData.createdAt);
          const updatedAt = new Date(orderData.updatedAt);
          
          const currentStatus = orderData.orderStatus;
          
          // Always record Pending as starting point
          historicalStatuses.push({
            status: 'Pending',
            timestamp: createdAt
          });
          
          // If delivered, infer Processing at midpoint
          if (currentStatus === 'Delivered') {
            const midpoint = new Date((createdAt.getTime() + updatedAt.getTime()) / 2);
            historicalStatuses.push({
              status: 'Processing',
              timestamp: midpoint
            });
            historicalStatuses.push({
              status: 'Delivered',
              timestamp: updatedAt
            });
          }
          // If shipped, infer Processing at 2/3 point
          else if (currentStatus === 'Shipped') {
            const twoThirds = new Date(createdAt.getTime() + (updatedAt.getTime() - createdAt.getTime()) * 2 / 3);
            historicalStatuses.push({
              status: 'Processing',
              timestamp: twoThirds
            });
            historicalStatuses.push({
              status: 'Shipped',
              timestamp: updatedAt
            });
          }
          // If processing, infer started at 1/3 point
          else if (currentStatus === 'Processing') {
            const oneThird = new Date(createdAt.getTime() + (updatedAt.getTime() - createdAt.getTime()) * 1 / 3);
            historicalStatuses.push({
              status: 'Processing',
              timestamp: oneThird
            });
          }
        }

if (!existingOrder) {
           // Create new order
           // Build final history - include current entry only if not already covered by historical
           let finalHistory = [];
           if (historicalStatuses.length > 0) {
             // Check if current status is already in historicalStatuses
             const hasCurrent = historicalStatuses.some(h => h.status === (orderData.orderStatus || 'Pending'));
             finalHistory = hasCurrent ? historicalStatuses : [...historicalStatuses, statusHistoryEntry];
           } else {
             finalHistory = [statusHistoryEntry];
           }
           
           const newOrder = new NepalcanOrder({
             orderId,
             nepalcanId: orderData._id,
             customer: orderData.customer || 'Unknown',
             vendor: orderData.vendor,
             source: orderData.source,
             orderStatus: orderData.orderStatus || 'Pending',
             paymentStatus: orderData.paymentStatus,
             paymentMethod: orderData.paymentMethod,
             totalAmount: orderData.totalAmount || 0,
             shippingAmount: orderData.shippingAmount || 0,
             createdAt: orderData.createdAt ? new Date(orderData.createdAt) : new Date(),
             updatedAt: orderData.updatedAt ? new Date(orderData.updatedAt) : new Date(),
             statusHistory: finalHistory,
             rawData: orderData,
             lastSyncedAt: new Date()
           });

           await newOrder.save();
           results.created++;
         } else {
           // Check if status changed
           const oldStatus = existingOrder.orderStatus;
           const newStatus = orderData.orderStatus || oldStatus;

           // Build final history - check if current status is already covered
           let finalHistory;
           if (historicalStatuses.length > 0) {
             const hasCurrent = historicalStatuses.some(h => h.status === newStatus);
             finalHistory = hasCurrent ? historicalStatuses : [...historicalStatuses, statusHistoryEntry];
           } else {
             finalHistory = [...existingOrder.statusHistory, statusHistoryEntry];
           }
           
           // Remove duplicates and sort by timestamp
           existingOrder.statusHistory = finalHistory
             .filter((v, i, a) => a.findIndex(t => t.timestamp.getTime() === v.timestamp.getTime()) === i)
             .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

          // Update order
          existingOrder.orderStatus = newStatus;
          existingOrder.paymentStatus = orderData.paymentStatus || existingOrder.paymentStatus;
          existingOrder.totalAmount = orderData.totalAmount || existingOrder.totalAmount;
          existingOrder.updatedAt = orderData.updatedAt ? new Date(orderData.updatedAt) : new Date();
          existingOrder.rawData = orderData;
          existingOrder.lastSyncedAt = new Date();

          await existingOrder.save();
          results.updated++;
        }
      } catch (err) {
        results.errors.push(`Error processing order ${orderData.orderId}: ${err.message}`);
      }
    }

    res.json({
      message: 'Sync completed',
      results
    });

  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ message: 'Server error during sync', error: error.message });
  }
};

// Get all Nepalcan orders with filtering
exports.getNepalcanOrders = async (req, res) => {
  try {
    const { 
      status, 
      customer, 
      startDate, 
      endDate,
      page = 1,
      limit = 100
    } = req.query;

    const query = {};

    if (status) query.orderStatus = status;
    if (customer) query.customer = new RegExp(customer, 'i');
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const orders = await NepalcanOrder.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await NepalcanOrder.countDocuments(query);

    res.json({
      orders,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get order statistics and processing times
exports.getNepalcanStats = async (req, res) => {
  try {
    // Get basic stats
    const totalOrders = await NepalcanOrder.countDocuments();
    const statusCounts = await NepalcanOrder.aggregate([
      { $group: { _id: '$orderStatus', count: { $sum: 1 } } }
    ]);

    const paymentStatusCounts = await NepalcanOrder.aggregate([
      { $group: { _id: '$paymentStatus', count: { $sum: 1 } } }
    ]);

    // Calculate average processing times - only orders from today with valid interval data
    // Nepal timezone is UTC+5:45
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const orders = await NepalcanOrder.find({
      orderStatus: 'Delivered',
      createdAt: { $gte: today, $lt: tomorrow }
    });

    let totalPendingToProcessing = 0;
    let totalProcessingToDelivered = 0;
    let totalPendingToDelivered = 0;
    let ordersWithFullHistory = 0;
    let ordersWithNoIntervalData = 0;

    orders.forEach(order => {
      const times = order.getProcessingTimes();
      const fulfillmentTime = order.getTotalFulfillmentTime();

      // Check if order has actual status interval data (not inferred)
      // A valid interval exists if there are at least 2 status entries with different timestamps
      const hasIntervalData = order.statusHistory.length >= 2 && 
        order.statusHistory.some((entry, i) => {
          if (i === 0) return false;
          const prevEntry = order.statusHistory[i - 1];
          return prevEntry.status !== entry.status;
        });

      if (!hasIntervalData) {
        ordersWithNoIntervalData++;
        return;
      }

      if (times['Pending_to_Processing']) {
        totalPendingToProcessing += times['Pending_to_Processing'];
        ordersWithFullHistory++;
      }
      if (times['Processing_to_Shipped']) {
        totalProcessingToDelivered += times['Processing_to_Shipped'];
      }
      if (fulfillmentTime) {
        totalPendingToDelivered += fulfillmentTime;
      }
    });

    const stats = {
      totalOrders,
      statusCounts: statusCounts.map(s => ({ status: s._id, count: s.count })),
      paymentStatusCounts: paymentStatusCounts.map(s => ({ status: s._id, count: s.count })),
      averages: {
        pendingToProcessing: ordersWithFullHistory > 0 
          ? Math.round(totalPendingToProcessing / ordersWithFullHistory) 
          : 0,
        processingToDelivered: ordersWithFullHistory > 0 
          ? Math.round(totalProcessingToDelivered / ordersWithFullHistory) 
          : 0,
        totalFulfillment: ordersWithFullHistory > 0 
          ? Math.round(totalPendingToDelivered / ordersWithFullHistory) 
          : 0
      },
      ordersAnalyzed: ordersWithFullHistory,
      ordersWithNoIntervalData
    };

    res.json(stats);

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get single order by ID with status history
exports.getNepalcanOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    let query;
    
    // Check if id is a valid ObjectId (24 hex characters)
    if (/^[0-9a-fA-F]{24}$/.test(id)) {
      query = { $or: [{ orderId: id }, { _id: id }] };
    } else {
      query = { orderId: id };
    }
    
    const order = await NepalcanOrder.findOne(query);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Calculate time spent in each status
    const statusDurations = {};
    const history = order.statusHistory.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    for (let i = 0; i < history.length - 1; i++) {
      const current = history[i];
      const next = history[i + 1];
      const hours = Math.round((new Date(next.timestamp) - new Date(current.timestamp)) / (1000 * 60 * 60));
      statusDurations[`${current.status}_to_${next.status}`] = hours;
    }

    const response = {
      ...order.toObject(),
      statusDurations,
      noPreviousData: order.statusHistory.length <= 1
    };

    res.json(response);
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Fetch orders directly from Nepalcan API
exports.fetchFromNepalcan = async (req, res) => {
  try {
    const { token } = req.body;
    
    const headers = {
      'Content-Type': 'application/json',
      'Origin': 'https://commerce.thecanbrand.com',
      'Referer': 'https://commerce.thecanbrand.com/'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await axios.get(
      `${API_BASE}/vendor/orders/super-admin/list`,
      {
        params: {
          tab: 'marketplace',
          page: 1,
          limit: 100,
          unattendedOrders: '',
          status: 'Active'
        },
        headers
      }
    );

    let ordersList = [];
    const responseData = response.data;

    if (responseData?.data?.orders && Array.isArray(responseData.data.orders)) {
      ordersList = responseData.data.orders;
    } else if (responseData?.orders && Array.isArray(responseData.orders)) {
      ordersList = responseData.orders;
    } else if (Array.isArray(responseData)) {
      ordersList = responseData;
    } else if (responseData?.data && Array.isArray(responseData.data)) {
      ordersList = responseData.data;
    }

    res.json({ orders: ordersList, count: ordersList.length });

  } catch (error) {
    console.error('Fetch from Nepalcan error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch from Nepalcan', 
      error: error.response?.data?.message || error.message 
    });
  }
};

// Get last sync log
exports.getLastSyncLog = async (req, res) => {
  try {
    const lastLog = await NepalcanSyncLog.findOne().sort({ createdAt: -1 });
    res.json(lastLog || { message: 'No sync logs found' });
  } catch (error) {
    console.error('Get sync log error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get recent sync logs
exports.getSyncLogs = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const logs = await NepalcanSyncLog.find().sort({ createdAt: -1 }).limit(limit);
    res.json(logs);
  } catch (error) {
    console.error('Get sync logs error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
