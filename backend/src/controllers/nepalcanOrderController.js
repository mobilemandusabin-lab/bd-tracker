const NepalcanOrder = require('../models/NepalcanOrder');
const NepalcanSyncLog = require('../models/NepalcanSyncLog');
const Lead = require('../models/Lead');
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

// NPT day helpers — YYYY-MM-DD interpreted as NPT midnight (server tz varies: Vercel UTC vs local NPT)
const NPT = 'Asia/Kathmandu';
const NPT_OFFSET_MS = 5.75 * 3600000;
const nptDayStart = (ymd) => new Date(`${ymd}T00:00:00+05:45`);
const nptDayEnd = (ymd) => new Date(`${ymd}T23:59:59.999+05:45`);
const toNptDateStr = (d) => new Date(d.getTime() + NPT_OFFSET_MS).toISOString().split('T')[0];
// ponytail: BS buckets — NepaliDate reads server tz, shift to NPT wall first
const NepaliDate = require('nepali-date-converter').default;
const toNptWall = (d) => new Date(new Date(d).toLocaleString('en-US', { timeZone: NPT }));
const bsKeyOf = (d) => { const nd = new NepaliDate(toNptWall(d)); return { y: nd.getYear(), m: nd.getMonth() + 1 }; };
const bsMonthAdRange = (y, mIdx0) => {
  const ai = (dt) => new Date(dt.getTime() + NPT_OFFSET_MS).toISOString().split('T')[0];
  const s = new NepaliDate(y, mIdx0, 1).toJsDate();
  const nm = mIdx0 === 11 ? new NepaliDate(y + 1, 0, 1).toJsDate() : new NepaliDate(y, mIdx0 + 1, 1).toJsDate();
  return { start: ai(s), end: ai(new Date(nm.getTime() - 86400000)) };
};
const bsMonthBounds = (y, mIdx0) => { const { start, end } = bsMonthAdRange(y, mIdx0); return { start: nptDayStart(start), end: nptDayEnd(end) }; };

// Sync Nepalcan orders — one resumable batch per call (ponytail: reuses SyncJob,
// the old blocking syncNepalcanOrders never survives Hobby 10s). Hit repeatedly
// via kick cron or the Refresh button until done:true.
exports.syncNepalcanOrders = async (req, res) => {
  try {
    const { ensureAndRunOneBatch } = require('./syncController');
    console.log('[Order Sync] Resumable batch starting...');
    const result = await ensureAndRunOneBatch('nepalcan_orders');
    console.log(`[Order Sync] Batch: phase=${result.phase} ${result.processed}/${result.total} done=${result.done}`);
    res.status(200).json({ status: 'success', message: result.done ? 'Sales sync completed' : `Sales sync batch: ${result.processed}/${result.total}`, ...result });
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
      // ponytail: YYYY-MM-DD = whole NPT day; bare new Date(end) would drop the end day after 05:45 NPT
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? nptDayStart(startDate) : new Date(startDate);
      if (endDate) query.createdAt.$lte = /^\d{4}-\d{2}-\d{2}$/.test(endDate) ? nptDayEnd(endDate) : new Date(endDate);
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
    const order = await NepalcanOrder.findOne({ orderId });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const base = order.trackingData || {};
    const response = {
      ...base,
      orderId: order.orderId,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      source: order.source,
      totalAmount: order.totalAmount,
      shippingAmount: order.shippingAmount,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      priceHistory: order.priceHistory || []
    };

    // Keep trackingData's vendor/customerProfile objects; fall back to DB strings only when missing
    if (!response.vendor && order.vendor) {
      response.vendor = { name: order.vendor };
    }
    if (!response.customerProfile && order.customer) {
      response.customerProfile = { name: order.customer };
    }

    res.json(response);
  } catch (error) {
    console.error('Get order tracking error:', error);
    res.status(500).json({ message: 'Failed to fetch order tracking data', error: error.message });
  }
};

// Get comprehensive analytics for Nepalcan orders
exports.getNepalcanAnalytics = async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // ponytail: BS months — current BS month to date vs previous full BS month
    const bsNow = new NepaliDate(toNptWall(now));
    const bsYear = bsNow.getYear(), bsMonthIdx = bsNow.getMonth();
    const curBounds = bsMonthBounds(bsYear, bsMonthIdx);
    const prevIdx = bsMonthIdx === 0 ? 11 : bsMonthIdx - 1;
    const prevYear = bsMonthIdx === 0 ? bsYear - 1 : bsYear;
    const prevBounds = bsMonthBounds(prevYear, prevIdx);
    const startOfMonth = curBounds.start;
    const startOfLastMonth = prevBounds.start;

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
      // 1. Revenue Trend (daily NPT, last 30 days) — revenue=gross, netRevenue=Delivered only
      NepalcanOrder.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: NPT } },
          revenue: { $sum: '$totalAmount' },
          netRevenue: { $sum: { $cond: [{ $eq: ['$orderStatus', 'Delivered'] }, '$totalAmount', 0] } },
          returnedRevenue: { $sum: { $cond: [{ $eq: ['$orderStatus', 'Returned'] }, '$totalAmount', 0] } },
          orders: { $sum: 1 },
          deliveredOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'Delivered'] }, 1, 0] } },
          returnedOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'Returned'] }, 1, 0] } }
        }},
        { $sort: { _id: 1 } },
        { $project: { date: '$_id', revenue: 1, netRevenue: 1, returnedRevenue: 1, orders: 1, deliveredOrders: 1, returnedOrders: 1, _id: 0 } }
      ]),

      // 2. Vendor Performance (top 15 by revenue)
      NepalcanOrder.aggregate([
        { $group: {
          _id: '$vendor',
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          deliveredRevenue: { $sum: { $cond: [{ $eq: ['$orderStatus', 'Delivered'] }, '$totalAmount', 0] } },
          deliveredCount: { $sum: { $cond: [{ $eq: ['$orderStatus', 'Delivered'] }, 1, 0] } },
          returnedCount: { $sum: { $cond: [{ $eq: ['$orderStatus', 'Returned'] }, 1, 0] } },
          avgAmount: { $avg: '$totalAmount' }
        }},
        { $sort: { totalRevenue: -1 } },
        { $limit: 15 },
        { $project: {
          vendor: { $ifNull: ['$_id', 'Unknown'] },
          totalOrders: 1, totalRevenue: 1, deliveredRevenue: 1, deliveredCount: 1, returnedCount: 1,
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

      // 6. Current month stats — revenue=gross, netRevenue=Delivered only
      NepalcanOrder.aggregate([
        { $match: { createdAt: { $gte: startOfMonth } } },
        { $group: {
          _id: null,
          orderCount: { $sum: 1 },
          revenue: { $sum: '$totalAmount' },
          netRevenue: { $sum: { $cond: [{ $eq: ['$orderStatus', 'Delivered'] }, '$totalAmount', 0] } },
          returnedRevenue: { $sum: { $cond: [{ $eq: ['$orderStatus', 'Returned'] }, '$totalAmount', 0] } },
          deliveredCount: { $sum: { $cond: [{ $eq: ['$orderStatus', 'Delivered'] }, 1, 0] } },
          returnedCount: { $sum: { $cond: [{ $eq: ['$orderStatus', 'Returned'] }, 1, 0] } },
          customers: { $addToSet: '$customer' }
        }},
        { $project: { orderCount: 1, revenue: 1, netRevenue: 1, returnedRevenue: 1, deliveredCount: 1, returnedCount: 1, uniqueCustomers: { $size: '$customers' }, _id: 0 } }
      ]),

      // 7. Last month stats
      NepalcanOrder.aggregate([
        { $match: { createdAt: { $gte: startOfLastMonth, $lt: startOfMonth } } },
        { $group: {
          _id: null,
          orderCount: { $sum: 1 },
          revenue: { $sum: '$totalAmount' },
          netRevenue: { $sum: { $cond: [{ $eq: ['$orderStatus', 'Delivered'] }, '$totalAmount', 0] } },
          returnedRevenue: { $sum: { $cond: [{ $eq: ['$orderStatus', 'Returned'] }, '$totalAmount', 0] } },
          deliveredCount: { $sum: { $cond: [{ $eq: ['$orderStatus', 'Delivered'] }, 1, 0] } },
          returnedCount: { $sum: { $cond: [{ $eq: ['$orderStatus', 'Returned'] }, 1, 0] } },
          customers: { $addToSet: '$customer' }
        }},
        { $project: { orderCount: 1, revenue: 1, netRevenue: 1, returnedRevenue: 1, deliveredCount: 1, returnedCount: 1, uniqueCustomers: { $size: '$customers' }, _id: 0 } }
      ]),

      // 8. Day-of-Week pattern
      NepalcanOrder.aggregate([
        { $group: {
          _id: { $dayOfWeek: '$createdAt' },
          orders: { $sum: 1 },
          revenue: { $sum: '$totalAmount' },
          netRevenue: { $sum: { $cond: [{ $eq: ['$orderStatus', 'Delivered'] }, '$totalAmount', 0] } }
        }},
        { $sort: { _id: 1 } }
      ]),

      // 9. Payment Method breakdown
      NepalcanOrder.aggregate([
        { $group: {
          _id: { $ifNull: ['$paymentMethod', 'Unknown'] },
          count: { $sum: 1 },
          revenue: { $sum: '$totalAmount' },
          netRevenue: { $sum: { $cond: [{ $eq: ['$orderStatus', 'Delivered'] }, '$totalAmount', 0] } }
        }},
        { $sort: { count: -1 } },
        { $project: { method: '$_id', count: 1, revenue: 1, netRevenue: 1, _id: 0 } }
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
          revenue: { $sum: '$totalAmount' },
          netRevenue: { $sum: { $cond: [{ $eq: ['$orderStatus', 'Delivered'] }, '$totalAmount', 0] } }
        }},
        { $sort: { _id: 1 } }
      ]),

      // 13. Vendor Growth Trend (per vendor per BS month, last 6 BS months) — JS bucket, ~1-2k rows
      NepalcanOrder.find({ createdAt: { $gte: bsMonthBounds(bsMonthIdx < 5 ? bsYear - 1 : bsYear, (bsMonthIdx + 12 - 5) % 12).start } })
        .select('vendor createdAt totalAmount orderStatus').lean(),

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
          revenue: { $sum: '$totalAmount' },
          netRevenue: { $sum: { $cond: [{ $eq: ['$orderStatus', 'Delivered'] }, '$totalAmount', 0] } }
        }},
        { $sort: { orders: -1 } },
        { $limit: 15 },
        { $project: { zone: '$_id', orders: 1, revenue: 1, netRevenue: 1, _id: 0 } }
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
      return { day: label, orders: entry?.orders || 0, revenue: entry?.revenue || 0, netRevenue: entry?.netRevenue || 0 };
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
      return { hour: i, label: `${String(i).padStart(2, '0')}:00`, orders: entry?.orders || 0, revenue: entry?.revenue || 0, netRevenue: entry?.netRevenue || 0 };
    });

    // Format vendor growth trend — bucket raw rows into BS months
    const vendorGrowth = {};
    vendorGrowthTrend.forEach(o => {
      const { y, m } = bsKeyOf(o.createdAt);
      const key = `${o.vendor || 'Unknown'}|${y}|${m}`;
      if (!vendorGrowth[key]) vendorGrowth[key] = { vendor: o.vendor || 'Unknown', year: y, month: m, orders: 0, revenue: 0, netRevenue: 0 };
      const b = vendorGrowth[key];
      b.orders += 1; b.revenue += o.totalAmount || 0;
      if (o.orderStatus === 'Delivered') b.netRevenue += o.totalAmount || 0;
    });
    const vendorGrowthByName = {};
    Object.values(vendorGrowth).forEach(entry => {
      if (!vendorGrowthByName[entry.vendor]) vendorGrowthByName[entry.vendor] = [];
      vendorGrowthByName[entry.vendor].push(entry);
    });
    Object.values(vendorGrowthByName).forEach(arr => arr.sort((a, b) => a.year - b.year || a.month - b.month));
    const topVendorNames = Object.entries(vendorGrowthByName)
      .map(([vendor, months]) => ({ vendor, total: months.reduce((s, m) => s + m.orders, 0) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map(v => v.vendor);
    const vendorGrowthData = topVendorNames.map(vendor => ({
      vendor,
      months: vendorGrowthByName[vendor] || []
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
        totalRevenue: v.totalRevenue,
        deliveredRevenue: v.deliveredRevenue || 0
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

// Monthly aggregates bucketed by BS month (Bhadra 2083 = Aug 17–Sep 16 AD) — JS bucket, few k rows
exports.getMonthlyData = async (req, res) => {
  try {
    const rows = await NepalcanOrder.find({})
      .select('createdAt totalAmount orderStatus vendor customer paymentMethod').lean();
    const map = new Map();
    const get = (y, m) => {
      const k = `${y}-${m}`;
      if (!map.has(k)) map.set(k, { year: y, month: m, totalOrders: 0, totalRevenue: 0,
        deliveredOrders: 0, deliveredRevenue: 0, returnedOrders: 0, returnedRevenue: 0,
        cancelledOrders: 0, cancelledRevenue: 0, pendingOrders: 0, processingOrders: 0, shippedOrders: 0,
        vendors: new Set(), customers: new Set(), payMethods: new Set() });
      return map.get(k);
    };
    for (const o of rows) {
      if (!o.createdAt) continue;
      const { y, m } = bsKeyOf(o.createdAt);
      const b = get(y, m);
      const amt = o.totalAmount || 0;
      b.totalOrders += 1; b.totalRevenue += amt;
      if (o.orderStatus === 'Delivered') { b.deliveredOrders += 1; b.deliveredRevenue += amt; }
      else if (o.orderStatus === 'Returned') { b.returnedOrders += 1; b.returnedRevenue += amt; }
      else if (o.orderStatus === 'Cancelled') { b.cancelledOrders += 1; b.cancelledRevenue += amt; }
      else if (o.orderStatus === 'Pending') b.pendingOrders += 1;
      else if (o.orderStatus === 'Processing') b.processingOrders += 1;
      else if (o.orderStatus === 'Shipped') b.shippedOrders += 1;
      if (o.vendor) b.vendors.add(o.vendor);
      if (o.customer) b.customers.add(o.customer);
      b.payMethods.add(o.paymentMethod || 'Unknown');
    }
    const monthlyData = [...map.values()]
      .sort((a, b) => b.year - a.year || b.month - a.month)
      .map(b => {
        const activeOrders = b.totalOrders - b.cancelledOrders;
        const activeRevenue = b.totalRevenue - b.cancelledRevenue;
        return { year: b.year, month: b.month, totalOrders: b.totalOrders,
          totalRevenue: Math.round(b.totalRevenue * 100) / 100,
          // ponytail: AOV ex-cancelled so it reconciles with daily tab
          avgOrderValue: activeOrders ? Math.round(activeRevenue / activeOrders) : 0,
          deliveredOrders: b.deliveredOrders, deliveredRevenue: Math.round(b.deliveredRevenue * 100) / 100,
          returnedOrders: b.returnedOrders, returnedRevenue: Math.round(b.returnedRevenue * 100) / 100,
          cancelledOrders: b.cancelledOrders, cancelledRevenue: Math.round(b.cancelledRevenue * 100) / 100,
          pendingOrders: b.pendingOrders, processingOrders: b.processingOrders, shippedOrders: b.shippedOrders,
          uniqueVendors: b.vendors.size, uniqueCustomers: b.customers.size,
          returnRate: b.totalOrders ? Math.round((b.returnedOrders / b.totalOrders) * 1000) / 10 : 0,
          deliveryRate: b.totalOrders ? Math.round((b.deliveredOrders / b.totalOrders) * 1000) / 10 : 0 };
      });

    res.json({ months: monthlyData });
  } catch (error) {
    console.error('Get monthly data error:', error);
    res.status(500).json({ message: 'Failed to fetch monthly data', error: error.message });
  }
};

const ORDER_STATUSES = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'];

// Daily sales by createdAt (NPT days), excluding Cancelled — date-wise like vendor daily report.
// ponytail: single agg + zero-fill loop, per-vendor matrix only on demand via ?vendor=
exports.getDailySalesData = async (req, res) => {
  try {
    let { startDate, endDate, vendor } = req.query;
    const endD = endDate || toNptDateStr(new Date());
    const end = nptDayEnd(endD);
    let start = startDate ? nptDayStart(startDate)
      : new Date(end.getTime() - 29 * 86400000);
    // ponytail: clamp to 92 days, bigger ranges use /monthly
    if ((end - start) / 86400000 > 92) start = new Date(end.getTime() - 91 * 86400000);

    const match = { createdAt: { $gte: start, $lte: end }, orderStatus: { $ne: 'Cancelled' } };
    if (vendor) match.vendor = new RegExp(`^${vendor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

    const [byDay, byVendor, hourlyRows, fallbackCount, cancelledByDay] = await Promise.all([
      NepalcanOrder.aggregate([
        { $match: match },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: NPT } },
          orders: { $sum: 1 },
          revenue: { $sum: '$totalAmount' },
          deliveredOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'Delivered'] }, 1, 0] } },
          deliveredRevenue: { $sum: { $cond: [{ $eq: ['$orderStatus', 'Delivered'] }, '$totalAmount', 0] } },
          returnedOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'Returned'] }, 1, 0] } },
          shippedOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'Shipped'] }, 1, 0] } },
          pendingOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'Pending'] }, 1, 0] } },
          processingOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'Processing'] }, 1, 0] } },
          customers: { $addToSet: '$customer' },
        } },
        { $sort: { _id: 1 } },
      ]),
      NepalcanOrder.aggregate([
        { $match: match },
        { $group: {
          _id: { $ifNull: ['$vendor', 'Unknown'] },
          orders: { $sum: 1 },
          revenue: { $sum: '$totalAmount' },
          deliveredOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'Delivered'] }, 1, 0] } },
          returnedOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'Returned'] }, 1, 0] } },
        } },
        { $sort: { revenue: -1 } },
        { $limit: 10 },
        { $project: { _id: 0, vendor: '$_id', orders: 1, revenue: 1, deliveredOrders: 1, returnedOrders: 1,
          avgAmount: { $round: [{ $divide: ['$revenue', '$orders'] }, 0] } } },
      ]),
      NepalcanOrder.aggregate([
        { $match: match },
        { $group: {
          _id: { $hour: { date: '$createdAt', timezone: NPT } },
          orders: { $sum: 1 },
          revenue: { $sum: '$totalAmount' },
        } },
        { $sort: { _id: 1 } },
      ]),
      // ponytail: rows whose createdAt is sync-time fallback (API had no timestamp) poison the timeline
      NepalcanOrder.countDocuments({ ...match,
        $or: [{ 'rawData.createdAt': { $exists: false } }, { 'rawData.createdAt': null }] }),
      // ponytail: daily excludes Cancelled — parallel count so tabs reconcile
      NepalcanOrder.aggregate([
        { $match: { createdAt: match.createdAt, orderStatus: 'Cancelled' } },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: NPT } },
          orders: { $sum: 1 },
          revenue: { $sum: '$totalAmount' },
        } },
      ]),
    ]);

    const byDayMap = new Map(byDay.map(d => [d._id, d]));
    const cancelledMap = new Map(cancelledByDay.map(d => [d._id, d]));
    const days = [];
    for (let t = new Date(start); t <= end; t = new Date(t.getTime() + 86400000)) {
      const key = toNptDateStr(t);
      if (days.length && days[days.length - 1].date === key) continue;
      const d = byDayMap.get(key) || {};
      const c = cancelledMap.get(key) || {};
      const orders = d.orders || 0;
      days.push({
        date: key,
        orders,
        revenue: d.revenue || 0,
        avgOrderValue: orders ? Math.round((d.revenue || 0) / orders) : 0,
        deliveredOrders: d.deliveredOrders || 0,
        deliveredRevenue: d.deliveredRevenue || 0,
        returnedOrders: d.returnedOrders || 0,
        cancelledOrders: c.orders || 0,
        cancelledRevenue: c.revenue || 0,
        shippedOrders: d.shippedOrders || 0,
        pendingOrders: d.pendingOrders || 0,
        processingOrders: d.processingOrders || 0,
        uniqueCustomers: d.customers ? d.customers.length : 0,
      });
    }
    const hourlyMap = new Map(hourlyRows.map(h => [h._id, h]));
    const hourly = Array.from({ length: 24 }, (_, h) => ({
      hour: h, orders: hourlyMap.get(h)?.orders || 0, revenue: hourlyMap.get(h)?.revenue || 0,
    }));
    const summary = days.reduce((s, d) => ({
      orders: s.orders + d.orders, revenue: s.revenue + d.revenue,
      deliveredOrders: s.deliveredOrders + d.deliveredOrders,
      deliveredRevenue: s.deliveredRevenue + d.deliveredRevenue,
      returnedOrders: s.returnedOrders + d.returnedOrders,
      cancelledOrders: s.cancelledOrders + d.cancelledOrders,
      cancelledRevenue: s.cancelledRevenue + d.cancelledRevenue,
    }), { orders: 0, revenue: 0, deliveredOrders: 0, deliveredRevenue: 0, returnedOrders: 0, cancelledOrders: 0, cancelledRevenue: 0 });

    res.json({ days, hourly, topVendors: byVendor, summary, fallbackCount,
      range: { startDate: toNptDateStr(start), endDate: toNptDateStr(end) } });
  } catch (error) {
    console.error('Get daily sales error:', error);
    res.status(500).json({ message: 'Failed to fetch daily sales', error: error.message });
  }
};

// Update a Nepalcan order manually. orderId is locked; statusHistory is preserved,
// a status change appends a new entry instead.
exports.updateNepalcanOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;

    const order = await NepalcanOrder.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const setFields = {};
    const allowed = ['orderStatus', 'paymentStatus', 'paymentMethod', 'customer', 'vendor', 'source', 'totalAmount', 'shippingAmount', 'createdAt'];

    for (const field of allowed) {
      if (body[field] !== undefined) {
        if (field === 'orderStatus' && !ORDER_STATUSES.includes(body[field])) {
          return res.status(400).json({ message: `Invalid orderStatus: ${body[field]}` });
        }
        if ((field === 'totalAmount' || field === 'shippingAmount') && (isNaN(body[field]) || Number(body[field]) < 0)) {
          return res.status(400).json({ message: `Invalid ${field}` });
        }
        setFields[field] = field === 'totalAmount' || field === 'shippingAmount' ? Number(body[field]) : body[field];
      }
    }

    if (body.orderStatus && body.orderStatus !== order.orderStatus) {
      setFields.statusHistory = [
        ...(order.statusHistory || []),
        { status: body.orderStatus, timestamp: new Date() }
      ];
    }

    const now = new Date();
    const priceChanges = [];
    if (body.totalAmount !== undefined && Number(body.totalAmount) !== Number(order.totalAmount)) {
      priceChanges.push({ field: 'totalAmount', oldValue: order.totalAmount, newValue: Number(body.totalAmount), source: 'manual', timestamp: now });
    }
    if (body.shippingAmount !== undefined && Number(body.shippingAmount) !== Number(order.shippingAmount)) {
      priceChanges.push({ field: 'shippingAmount', oldValue: order.shippingAmount, newValue: Number(body.shippingAmount), source: 'manual', timestamp: now });
    }
    if (priceChanges.length > 0) {
      setFields.priceHistory = [...(order.priceHistory || []), ...priceChanges];
    }

    if (Object.keys(setFields).length === 0) {
      return res.status(400).json({ message: 'No editable fields provided' });
    }

    setFields.processingDurationHours = computeProcessingDuration(
      setFields.statusHistory || order.statusHistory || []
    );

    const updated = await NepalcanOrder.findByIdAndUpdate(id, { $set: setFields }, { new: true, runValidators: true });

    // Auto-recalculate Lead revenue when order becomes Delivered or amount changes on Delivered order
    if (updated.vendor_lead_id && (
        (body.orderStatus === 'Delivered' && order.orderStatus !== 'Delivered') ||  // status changed TO Delivered
        (order.orderStatus === 'Delivered' && (body.totalAmount !== undefined || body.shippingAmount !== undefined)) // amount changed on Delivered
      )) {
      try {
        const agg = await NepalcanOrder.aggregate([
          { $match: { orderStatus: 'Delivered', vendor_lead_id: updated.vendor_lead_id } },
          { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 }, lastOrder: { $max: '$updatedAt' } } }
        ]);
        const data = agg[0] || { total: 0, count: 0, lastOrder: null };
        const lead = await Lead.findById(updated.vendor_lead_id);
        if (lead) {
          lead.total_revenue = data.total;
          lead.delivered_order_count = data.count;
          lead.last_order_date = data.lastOrder;
          lead.active_seller = data.count > 0;
          lead.lead_status = 'Active Seller';
          lead.last_nepalcan_status = 'Active Seller';
          if (!lead.converted_at) lead.converted_at = new Date();
          await lead.save();
          console.log(`[Order Update] Auto-recalculated revenue for lead ${updated.vendor_lead_id}: ${data.total}`);
        }
      } catch (err) {
        console.error('[Order Update] Revenue recalc failed:', err.message);
      }
    }

    // ponytail: normalize return variants — 5 true returns flag finance, initiated/declined heal to Delivered
    try {
      const { normalizeReturnStatus } = require('../services/nepalcanOrderSyncService');
      const Finance = require('../models/Finance');
      const normNew = body.orderStatus ? normalizeReturnStatus(body.orderStatus, body.orderStatus) : null;
      if (normNew === 'Returned' && order.orderStatus !== 'Returned') {
        await Finance.updateOne(
          { order_id: updated.orderId },
          { $set: { is_returned: true, returned_at: new Date(), return_note: 'Order marked Returned (manual update)' } }
        );
      } else if (normNew && normNew !== 'Returned' && order.orderStatus === 'Returned') {
        await Finance.updateOne(
          { order_id: updated.orderId },
          { $set: { is_returned: false }, $unset: { returned_at: '', return_note: '' } }
        );
      }
    } catch (flagErr) {
      console.error('[Order Update] Finance return flag failed:', flagErr.message);
    }

    res.json({ status: 'success', data: updated });
  } catch (error) {
    console.error('Update Nepalcan order error:', error);
    res.status(500).json({ message: 'Failed to update order', error: error.message });
  }
};

// POST /nepalcan/recalculate-revenue — bulk recalculate all vendor revenues from Delivered orders
exports.recalculateRevenue = async (req, res) => {
  try {
    const deliveredOrdersAgg = await NepalcanOrder.aggregate([
      { $match: { orderStatus: 'Delivered', vendor_lead_id: { $ne: null } } },
      { $group: {
        _id: '$vendor_lead_id',
        deliveredCount: { $sum: 1 },
        totalAmount: { $sum: '$totalAmount' },
        lastOrderDate: { $max: '$updatedAt' }
      }}
    ]);

    if (deliveredOrdersAgg.length === 0) {
      return res.json({ status: 'success', message: 'No delivered orders with vendor_lead_id', updated: 0 });
    }

    const ops = deliveredOrdersAgg.map(v => ({
      updateOne: {
        filter: { _id: v._id },
        update: {
          $set: {
            total_revenue: v.totalAmount,
            delivered_order_count: v.deliveredCount,
            last_order_date: v.lastOrderDate,
            active_seller: v.deliveredCount > 0,
            lead_status: 'Active Seller',
            last_nepalcan_status: 'Active Seller'
          },
          $setOnInsert: { converted_at: new Date() }
        }
      }
    }));

    const result = await Lead.bulkWrite(ops, { ordered: false });
    const updatedIds = deliveredOrdersAgg.map(v => v._id);

    res.json({
      status: 'success',
      message: `Recalculated revenue for ${result.modifiedCount} vendors`,
      updated: result.modifiedCount,
      vendors: updatedIds
    });
  } catch (err) {
    console.error('[Recalc Revenue] Error:', err);
    res.status(500).json({ status: 'fail', message: err.message });
  }
};
