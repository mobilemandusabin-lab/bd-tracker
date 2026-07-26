const NepalcanOrder = require('../models/NepalcanOrder');
const NepalcanSyncLog = require('../models/NepalcanSyncLog');
const axios = require('axios');

const API_BASE = 'https://commerce.thecanbrand.com/api';

// Compute total processing duration in hours from statusHistory
function computeProcessingDuration(statusHistory) {
  if (!statusHistory || statusHistory.length < 2) return null;
  const sorted = [...statusHistory].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const first = new Date(sorted[0].timestamp);
  const last = new Date(sorted[sorted.length - 1].timestamp);
  const diffMs = last - first;
  if (diffMs <= 0) return 0;
  return Math.round(diffMs / (1000 * 60 * 60));
}

// Sync Nepalcan orders only — standalone, no vendor sync
exports.syncNepalcanOrders = async (req, res) => {
  try {
    const { syncNepalcanOrders } = require('../services/nepalcanOrderSyncService');
    console.log('[Order Sync] Starting...');
    const result = await syncNepalcanOrders();
    console.log('[Order Sync] Complete:', result.message);
    res.status(200).json({ status: 'success', message: result.message, synced: result.synced });
  } catch (err) {
    console.error('[Order Sync] Error:', err);
    res.status(500).json({ status: 'fail', message: err.message });
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

    // Add processingDurationHours to each order (use denormalized field or compute on-the-fly)
    const ordersWithDuration = orders.map(order => {
      const obj = order.toObject();
      if (obj.processingDurationHours === null || obj.processingDurationHours === undefined) {
        obj.processingDurationHours = computeProcessingDuration(obj.statusHistory);
      }
      return obj;
    });

    res.json({
      orders: ordersWithDuration,
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

    // Calculate average processing times from orders since 2026-04-24 with valid status history
    const allOrders = await NepalcanOrder.find({
      'statusHistory.1': { $exists: true },  // at least 2 status entries
      createdAt: { $gte: new Date('2026-04-24') }
    }).select('statusHistory orderStatus').lean();

    let totals = {};
    let counts = {};
    let ordersWithNoIntervalData = 0;
    let totalFulfillmentHours = 0;
    let fulfilledCount = 0;

    allOrders.forEach(order => {
      const history = (order.statusHistory || []).sort((a, b) =>
        new Date(a.timestamp) - new Date(b.timestamp)
      );

      // Check if order has actual status interval data
      const hasIntervalData = history.length >= 2 &&
        history.some((entry, i) => {
          if (i === 0) return false;
          return history[i - 1].status !== entry.status;
        });

      if (!hasIntervalData) {
        ordersWithNoIntervalData++;
        return;
      }

      // Compute each transition pair
      for (let i = 0; i < history.length - 1; i++) {
        const from = history[i].status;
        const to = history[i + 1].status;
        const hours = Math.round(
          (new Date(history[i + 1].timestamp) - new Date(history[i].timestamp)) / (1000 * 60 * 60)
        );
        const key = `${from}_to_${to}`;
        totals[key] = (totals[key] || 0) + hours;
        counts[key] = (counts[key] || 0) + 1;
      }

      // Compute total fulfillment (first Pending to first Delivered)
      if (order.orderStatus === 'Delivered') {
        const pending = history.find(h => h.status === 'Pending');
        const delivered = history.find(h => h.status === 'Delivered');
        if (pending && delivered) {
          totalFulfillmentHours += Math.round(
            (new Date(delivered.timestamp) - new Date(pending.timestamp)) / (1000 * 60 * 60)
          );
          fulfilledCount++;
        }
      }
    });

    // Build averages for all transition pairs
    const averages = {};
    for (const key in totals) {
      averages[key] = Math.round(totals[key] / counts[key]);
    }

    const ordersAnalyzed = allOrders.length - ordersWithNoIntervalData;

    const stats = {
      totalOrders,
      statusCounts: statusCounts.map(s => ({ status: s._id, count: s.count })),
      paymentStatusCounts: paymentStatusCounts.map(s => ({ status: s._id, count: s.count })),
      averages: {
        ...averages,
        // Legacy fields for backward compatibility
        pendingToProcessing: averages['Pending_to_Processing'] || 0,
        processingToDelivered: averages['Processing_to_Shipped'] || averages['Processing_to_Delivered'] || 0,
        totalFulfillment: fulfilledCount > 0 ? Math.round(totalFulfillmentHours / fulfilledCount) : 0
      },
      ordersAnalyzed,
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
        timeout: 15000,
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

// checkReturnedOrders removed — enrichOrdersWithTracking (called during sync) covers this.

// Get order tracking details from external logistics API
exports.getOrderTracking = async (req, res) => {
  try {
    const { orderId } = req.params;
    const response = await axios.get(
      `https://can-logistic-prod-84pie.ondigitalocean.app/api/public/marketplace-tracker/${orderId}`,
      { timeout: 10000 }
    );
    const trackingData = response.data;

    // Check marketplaceProcesses for "returned" status and update order if found
    if (trackingData?.marketplaceProcesses && Array.isArray(trackingData.marketplaceProcesses)) {
      const hasReturned = trackingData.marketplaceProcesses.some(
        p => p.process && p.process.toLowerCase() === 'returned'
      );
      if (hasReturned) {
        const order = await NepalcanOrder.findOne({ orderId });
        if (order && order.orderStatus !== 'Returned') {
          order.orderStatus = 'Returned';
          order.statusHistory.push({ status: 'Returned', timestamp: new Date() });
          await order.save();
        }
      }
    }

    res.json(trackingData);
  } catch (error) {
    console.error('Get order tracking error:', error);
    const status = error.response?.status || 500;
    res.status(status).json({
      message: 'Failed to fetch order tracking data',
      error: error.response?.data?.message || error.message
    });
  }
};

// Get comprehensive analytics for Nepalcan orders
exports.getNepalcanAnalytics = async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const processingThreshold = new Date(now);
    processingThreshold.setDate(processingThreshold.getDate() - 3);
    const shippedThreshold = new Date(now);
    shippedThreshold.setDate(shippedThreshold.getDate() - 5);

    const [
      revenueTrend,
      vendorPerformance,
      customerOrders,
      ordersAtRisk,
      returnAnalysis,
      currentMonth,
      lastMonth,
      dayOfWeek,
      paymentMethods,
      vendorProcessingTimeRaw,
      processingTimeDistribution,
      hourlyPattern,
      vendorGrowthTrend,
      statusFlow,
      deliveryZones
    ] = await Promise.all([
      // 1. Revenue Trend (daily, last 30 days)
      NepalcanOrder.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$totalAmount' },
          orders: { $sum: 1 }
        }},
        { $sort: { _id: 1 } },
        { $project: { date: '$_id', revenue: 1, orders: 1, _id: 0 } }
      ]),

      // 2. Vendor Performance (top 15 by revenue)
      NepalcanOrder.aggregate([
        { $group: {
          _id: '$vendor',
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          deliveredCount: { $sum: { $cond: [{ $eq: ['$orderStatus', 'Delivered'] }, 1, 0] } },
          returnedCount: { $sum: { $cond: [{ $eq: ['$orderStatus', 'Returned'] }, 1, 0] } },
          avgAmount: { $avg: '$totalAmount' }
        }},
        { $sort: { totalRevenue: -1 } },
        { $limit: 15 },
        { $project: {
          vendor: { $ifNull: ['$_id', 'Unknown'] },
          totalOrders: 1, totalRevenue: 1, deliveredCount: 1, returnedCount: 1,
          avgAmount: { $round: ['$avgAmount', 0] },
          returnRate: {
            $cond: [
              { $gt: ['$totalOrders', 0] },
              { $round: [{ $multiply: [{ $divide: ['$returnedCount', '$totalOrders'] }, 100] }, 1] },
              0
            ]
          },
          _id: 0
        }}
      ]),

      // 3. Customer orders grouped (for retention calculation)
      NepalcanOrder.aggregate([
        { $group: { _id: '$customer', orderCount: { $sum: 1 }, totalSpent: { $sum: '$totalAmount' } } }
      ]),

      // 4. Orders at Risk (stuck Processing 3+ days or Shipped 5+ days)
      NepalcanOrder.find({
        $or: [
          { orderStatus: 'Processing', updatedAt: { $lte: processingThreshold } },
          { orderStatus: 'Shipped', updatedAt: { $lte: shippedThreshold } }
        ]
      }).select('orderId customer vendor orderStatus totalAmount updatedAt').sort('updatedAt').limit(20).lean(),

      // 5. Return Analysis by vendor
      NepalcanOrder.aggregate([
        { $match: { orderStatus: 'Returned' } },
        { $group: {
          _id: '$vendor',
          returnCount: { $sum: 1 },
          totalReturnedAmount: { $sum: '$totalAmount' }
        }},
        { $sort: { returnCount: -1 } },
        { $project: { vendor: { $ifNull: ['$_id', 'Unknown'] }, returnCount: 1, totalReturnedAmount: 1, _id: 0 } }
      ]),

      // 6. Current month stats
      NepalcanOrder.aggregate([
        { $match: { createdAt: { $gte: startOfMonth } } },
        { $group: {
          _id: null,
          orderCount: { $sum: 1 },
          revenue: { $sum: '$totalAmount' },
          deliveredCount: { $sum: { $cond: [{ $eq: ['$orderStatus', 'Delivered'] }, 1, 0] } },
          returnedCount: { $sum: { $cond: [{ $eq: ['$orderStatus', 'Returned'] }, 1, 0] } },
          customers: { $addToSet: '$customer' }
        }},
        { $project: { orderCount: 1, revenue: 1, deliveredCount: 1, returnedCount: 1, uniqueCustomers: { $size: '$customers' }, _id: 0 } }
      ]),

      // 7. Last month stats
      NepalcanOrder.aggregate([
        { $match: { createdAt: { $gte: startOfLastMonth, $lt: startOfMonth } } },
        { $group: {
          _id: null,
          orderCount: { $sum: 1 },
          revenue: { $sum: '$totalAmount' },
          deliveredCount: { $sum: { $cond: [{ $eq: ['$orderStatus', 'Delivered'] }, 1, 0] } },
          returnedCount: { $sum: { $cond: [{ $eq: ['$orderStatus', 'Returned'] }, 1, 0] } },
          customers: { $addToSet: '$customer' }
        }},
        { $project: { orderCount: 1, revenue: 1, deliveredCount: 1, returnedCount: 1, uniqueCustomers: { $size: '$customers' }, _id: 0 } }
      ]),

      // 8. Day-of-Week pattern
      NepalcanOrder.aggregate([
        { $group: {
          _id: { $dayOfWeek: '$createdAt' },
          orders: { $sum: 1 },
          revenue: { $sum: '$totalAmount' }
        }},
        { $sort: { _id: 1 } }
      ]),

      // 9. Payment Method breakdown
      NepalcanOrder.aggregate([
        { $group: {
          _id: { $ifNull: ['$paymentMethod', 'Unknown'] },
          count: { $sum: 1 },
          revenue: { $sum: '$totalAmount' }
        }},
        { $sort: { count: -1 } },
        { $project: { method: '$_id', count: 1, revenue: 1, _id: 0 } }
      ]),

      // 10. Vendor Processing Time Performance
      NepalcanOrder.aggregate([
        { $match: { orderStatus: 'Delivered', 'statusHistory.1': { $exists: true } } },
        { $unwind: '$statusHistory' },
        { $sort: { 'statusHistory.timestamp': 1 } },
        { $group: {
          _id: { vendor: '$vendor', orderId: '$orderId', status: '$statusHistory.status' },
          firstTimestamp: { $first: '$statusHistory.timestamp' },
          vendor: { $first: '$vendor' },
          orderId: { $first: '$orderId' }
        }},
        { $group: {
          _id: '$vendor',
          orders: { $push: { orderId: '$orderId', status: '$_id.status', timestamp: '$firstTimestamp' } }
        }},
        { $project: {
          vendor: '$_id',
          orders: 1,
          _id: 0
        }}
      ]),

      // 11. Processing Time Distribution (buckets)
      NepalcanOrder.aggregate([
        { $match: { processingDurationHours: { $ne: null, $gt: 0, $lt: 720 } } },
        { $bucket: {
          groupBy: '$processingDurationHours',
          boundaries: [0, 1, 6, 24, 72, 168, 720],
          default: '720+',
          output: { count: { $sum: 1 }, orders: { $push: { orderId: '$orderId', vendor: '$vendor', hours: '$processingDurationHours' } } }
        }}
      ]),

      // 12. Hourly Order Pattern
      NepalcanOrder.aggregate([
        { $group: {
          _id: { $hour: '$createdAt' },
          orders: { $sum: 1 },
          revenue: { $sum: '$totalAmount' }
        }},
        { $sort: { _id: 1 } }
      ]),

      // 13. Vendor Growth Trend (monthly per vendor, last 6 months)
      NepalcanOrder.aggregate([
        { $match: { createdAt: { $gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) } } },
        { $group: {
          _id: { vendor: '$vendor', year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          orders: { $sum: 1 },
          revenue: { $sum: '$totalAmount' }
        }},
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        { $project: {
          vendor: '$_id.vendor',
          year: '$_id.year',
          month: '$_id.month',
          orders: 1,
          revenue: 1,
          _id: 0
        }}
      ]),

      // 14. Status Flow (count transitions from statusHistory)
      NepalcanOrder.aggregate([
        { $unwind: '$statusHistory' },
        { $sort: { 'statusHistory.timestamp': 1 } },
        { $group: {
          _id: '$orderId',
          statuses: { $push: '$statusHistory.status' }
        }},
        { $project: {
          transitions: {
            $map: {
              input: { $range: [0, { $subtract: [{ $size: '$statuses' }, 1] }] },
              as: 'i',
              in: {
                from: { $arrayElemAt: ['$statuses', '$$i'] },
                to: { $arrayElemAt: ['$statuses', { $add: ['$$i', 1] }] }
              }
            }
          }
        }},
        { $unwind: '$transitions' },
        { $group: {
          _id: { from: '$transitions.from', to: '$transitions.to' },
          count: { $sum: 1 }
        }},
        { $sort: { count: -1 } },
        { $project: { from: '$_id.from', to: '$_id.to', count: 1, _id: 0 } }
      ]),

      // 15. Delivery Zone / Shipping Address breakdown
      NepalcanOrder.aggregate([
        { $match: { 'rawData.shippingAddress': { $exists: true } } },
        { $group: {
          _id: { $ifNull: ['$rawData.shippingAddress.city', '$rawData.shippingAddress.district', 'Unknown'] },
          orders: { $sum: 1 },
          revenue: { $sum: '$totalAmount' }
        }},
        { $sort: { orders: -1 } },
        { $limit: 15 },
        { $project: { zone: '$_id', orders: 1, revenue: 1, _id: 0 } }
      ])
    ]);

    // Compute customer retention
    const totalCustomers = customerOrders.length;
    const repeatCustomers = customerOrders.filter(c => c.orderCount > 1).length;
    const newCustomers = customerOrders.filter(c => c.orderCount === 1).length;
    const repeatRate = totalCustomers > 0 ? Math.round((repeatCustomers / totalCustomers) * 100) : 0;
    const avgOrdersPerCustomer = totalCustomers > 0 ? Math.round((customerOrders.reduce((s, c) => s + c.orderCount, 0) / totalCustomers) * 10) / 10 : 0;

    // Day-of-week labels
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayOfWeekData = dayLabels.map((label, i) => {
      const entry = dayOfWeek.find(d => d._id === i + 1);
      return { day: label, orders: entry?.orders || 0, revenue: entry?.revenue || 0 };
    });

    // Process vendor processing time data
    const vendorProcessingTime = vendorProcessingTimeRaw.map(vendor => {
      const orders = vendor.orders || [];
      const orderMap = {};

      // Group by orderId
      orders.forEach(entry => {
        if (!orderMap[entry.orderId]) orderMap[entry.orderId] = {};
        orderMap[entry.orderId][entry.status] = new Date(entry.timestamp);
      });

      // Calculate processing time for each order
      const processingTimes = [];
      const fulfillmentTimes = [];

      Object.values(orderMap).forEach(statusMap => {
        // Processing time: Pending -> Processing
        if (statusMap.Pending && statusMap.Processing) {
          const hours = (statusMap.Processing - statusMap.Pending) / (1000 * 60 * 60);
          if (hours >= 0 && hours < 720) processingTimes.push(hours); // Cap at 30 days
        }
        // Fulfillment time: Pending -> Delivered
        if (statusMap.Pending && statusMap.Delivered) {
          const hours = (statusMap.Delivered - statusMap.Pending) / (1000 * 60 * 60);
          if (hours >= 0 && hours < 720) fulfillmentTimes.push(hours);
        }
      });

      const avgProcessingHours = processingTimes.length > 0
        ? Math.round(processingTimes.reduce((s, t) => s + t, 0) / processingTimes.length)
        : null;
      const avgFulfillmentHours = fulfillmentTimes.length > 0
        ? Math.round(fulfillmentTimes.reduce((s, t) => s + t, 0) / fulfillmentTimes.length)
        : null;

      return {
        vendor: vendor.vendor,
        avgProcessingHours,
        avgFulfillmentHours,
        ordersWithProcessingData: processingTimes.length,
        ordersWithFulfillmentData: fulfillmentTimes.length
      };
    }).filter(v => v.avgProcessingHours !== null || v.avgFulfillmentHours !== null);

    // Sort by processing time (best first, then worst first)
    const bestVendors = [...vendorProcessingTime]
      .filter(v => v.avgProcessingHours !== null)
      .sort((a, b) => a.avgProcessingHours - b.avgProcessingHours)
      .slice(0, 5);

    const worstVendors = [...vendorProcessingTime]
      .filter(v => v.avgProcessingHours !== null)
      .sort((a, b) => b.avgProcessingHours - a.avgProcessingHours)
      .slice(0, 5);

    const bestFulfillment = [...vendorProcessingTime]
      .filter(v => v.avgFulfillmentHours !== null)
      .sort((a, b) => a.avgFulfillmentHours - b.avgFulfillmentHours)
      .slice(0, 5);

    const worstFulfillment = [...vendorProcessingTime]
      .filter(v => v.avgFulfillmentHours !== null)
      .sort((a, b) => b.avgFulfillmentHours - a.avgFulfillmentHours)
      .slice(0, 5);

    // Monthly comparison with % change
    const cm = currentMonth[0] || { orderCount: 0, revenue: 0, deliveredCount: 0, returnedCount: 0, uniqueCustomers: 0 };
    const lm = lastMonth[0] || { orderCount: 0, revenue: 0, deliveredCount: 0, returnedCount: 0, uniqueCustomers: 0 };
    const pctChange = (curr, prev) => prev > 0 ? Math.round(((curr - prev) / prev) * 100) : curr > 0 ? 100 : 0;

    // Format processing time distribution
    const processingTimeBuckets = [
      { label: '< 1h', min: 0, max: 1 },
      { label: '1-6h', min: 1, max: 6 },
      { label: '6-24h', min: 6, max: 24 },
      { label: '1-3d', min: 24, max: 72 },
      { label: '3-7d', min: 72, max: 168 },
      { label: '7d+', min: 168, max: 720 }
    ];
    const processingTimeDist = processingTimeBuckets.map(bucket => {
      const found = processingTimeDistribution.find(b => b._id === bucket.min);
      return { label: bucket.label, count: found?.count || 0 };
    });

    // Format hourly pattern
    const hourlyData = Array.from({ length: 24 }, (_, i) => {
      const entry = hourlyPattern.find(h => h._id === i);
      return { hour: i, label: `${String(i).padStart(2, '0')}:00`, orders: entry?.orders || 0, revenue: entry?.revenue || 0 };
    });

    // Format vendor growth trend
    const vendorGrowth = {};
    vendorGrowthTrend.forEach(entry => {
      if (!vendorGrowth[entry.vendor]) vendorGrowth[entry.vendor] = [];
      vendorGrowth[entry.vendor].push({ year: entry.year, month: entry.month, orders: entry.orders, revenue: entry.revenue });
    });
    // Get top 5 vendors by total orders in the period
    const topVendorNames = Object.entries(vendorGrowth)
      .map(([vendor, months]) => ({ vendor, total: months.reduce((s, m) => s + m.orders, 0) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map(v => v.vendor);
    const vendorGrowthData = topVendorNames.map(vendor => ({
      vendor,
      months: vendorGrowth[vendor] || []
    }));

    // Customer LTV
    const customerLTV = customerOrders
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 20)
      .map(c => ({ customer: c._id, orderCount: c.orderCount, totalSpent: Math.round(c.totalSpent) }));

    // Return rate vs processing time scatter data
    const scatterData = vendorPerformance.map(v => {
      const pt = vendorProcessingTime.find(p => p.vendor === v.vendor);
      return {
        vendor: v.vendor,
        returnRate: v.returnRate,
        avgProcessingHours: pt?.avgProcessingHours || null,
        totalOrders: v.totalOrders,
        totalRevenue: v.totalRevenue
      };
    }).filter(d => d.avgProcessingHours !== null);

    res.json({
      revenueTrend,
      vendorPerformance,
      customerRetention: { totalCustomers, repeatCustomers, newCustomers, repeatRate, avgOrdersPerCustomer },
      ordersAtRisk,
      returnAnalysis,
      monthlyComparison: {
        current: cm,
        last: lm,
        changes: {
          orders: pctChange(cm.orderCount, lm.orderCount),
          revenue: pctChange(cm.revenue, lm.revenue),
          delivered: pctChange(cm.deliveredCount, lm.deliveredCount),
          returns: pctChange(cm.returnedCount, lm.returnedCount)
        }
      },
      dayOfWeek: dayOfWeekData,
      paymentMethods,
      vendorProcessingTime: {
        bestProcessing: bestVendors,
        worstProcessing: worstVendors,
        bestFulfillment,
        worstFulfillment
      },
      processingTimeDistribution: processingTimeDist,
      hourlyPattern: hourlyData,
      vendorGrowthTrend: vendorGrowthData,
      statusFlow,
      deliveryZones,
      customerLTV,
      returnVsProcessing: scatterData
    });
  } catch (error) {
    console.error('Get Nepalcan analytics error:', error);
    res.status(500).json({ message: 'Failed to fetch analytics data', error: error.message });
  }
};

// Get monthly aggregated data for all months
exports.getMonthlyData = async (req, res) => {
  try {
    const monthlyData = await NepalcanOrder.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          avgOrderValue: { $avg: '$totalAmount' },
          deliveredOrders: {
            $sum: { $cond: [{ $eq: ['$orderStatus', 'Delivered'] }, 1, 0] }
          },
          deliveredRevenue: {
            $sum: { $cond: [{ $eq: ['$orderStatus', 'Delivered'] }, '$totalAmount', 0] }
          },
          returnedOrders: {
            $sum: { $cond: [{ $eq: ['$orderStatus', 'Returned'] }, 1, 0] }
          },
          returnedRevenue: {
            $sum: { $cond: [{ $eq: ['$orderStatus', 'Returned'] }, '$totalAmount', 0] }
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ['$orderStatus', 'Cancelled'] }, 1, 0] }
          },
          pendingOrders: {
            $sum: { $cond: [{ $eq: ['$orderStatus', 'Pending'] }, 1, 0] }
          },
          processingOrders: {
            $sum: { $cond: [{ $eq: ['$orderStatus', 'Processing'] }, 1, 0] }
          },
          shippedOrders: {
            $sum: { $cond: [{ $eq: ['$orderStatus', 'Shipped'] }, 1, 0] }
          },
          uniqueVendors: { $addToSet: '$vendor' },
          uniqueCustomers: { $addToSet: '$customer' },
          uniquePaymentMethods: { $addToSet: { $ifNull: ['$paymentMethod', 'Unknown'] } }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      {
        $project: {
          _id: 0,
          year: '$_id.year',
          month: '$_id.month',
          totalOrders: 1,
          totalRevenue: 1,
          avgOrderValue: { $round: ['$avgOrderValue', 0] },
          deliveredOrders: 1,
          deliveredRevenue: 1,
          returnedOrders: 1,
          returnedRevenue: 1,
          cancelledOrders: 1,
          pendingOrders: 1,
          processingOrders: 1,
          shippedOrders: 1,
          uniqueVendors: { $size: '$uniqueVendors' },
          uniqueCustomers: { $size: '$uniqueCustomers' },
          returnRate: {
            $cond: [
              { $gt: ['$totalOrders', 0] },
              { $round: [{ $multiply: [{ $divide: ['$returnedOrders', '$totalOrders'] }, 100] }, 1] },
              0
            ]
          },
          deliveryRate: {
            $cond: [
              { $gt: ['$totalOrders', 0] },
              { $round: [{ $multiply: [{ $divide: ['$deliveredOrders', '$totalOrders'] }, 100] }, 1] },
              0
            ]
          }
        }
      }
    ]);

    res.json({ months: monthlyData });
  } catch (error) {
    console.error('Get monthly data error:', error);
    res.status(500).json({ message: 'Failed to fetch monthly data', error: error.message });
  }
};
