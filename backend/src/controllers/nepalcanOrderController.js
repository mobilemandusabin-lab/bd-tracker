const NepalcanOrder = require('../models/NepalcanOrder');
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
        
        const statusHistoryEntry = {
          status: orderData.orderStatus || 'Pending',
          timestamp: orderData.updatedAt ? new Date(orderData.updatedAt) : new Date()
        };

        if (!existingOrder) {
          // Create new order
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
            statusHistory: [statusHistoryEntry],
            rawData: orderData,
            lastSyncedAt: new Date()
          });

          await newOrder.save();
          results.created++;
        } else {
          // Check if status changed
          const oldStatus = existingOrder.orderStatus;
          const newStatus = orderData.orderStatus || oldStatus;

          if (oldStatus !== newStatus) {
            // Add new status to history
            existingOrder.statusHistory.push(statusHistoryEntry);
          }

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

    // Calculate average processing times
    const orders = await NepalcanOrder.find({
      orderStatus: 'Delivered'
    });

    let totalPendingToProcessing = 0;
    let totalProcessingToDelivered = 0;
    let totalPendingToDelivered = 0;
    let ordersWithFullHistory = 0;

    orders.forEach(order => {
      const times = order.getProcessingTimes();
      const fulfillmentTime = order.getTotalFulfillmentTime();

      if (times['Pending_to_Processing']) {
        totalPendingToProcessing += times['Pending_to_Processing'];
      }
      if (times['Processing_to_Shipped']) {
        totalProcessingToDelivered += times['Processing_to_Shipped'];
      }
      if (fulfillmentTime) {
        totalPendingToDelivered += fulfillmentTime;
        ordersWithFullHistory++;
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
      ordersAnalyzed: ordersWithFullHistory
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
    const order = await NepalcanOrder.findOne({ 
      $or: [
        { orderId: req.params.id },
        { _id: req.params.id }
      ]
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(order);
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
