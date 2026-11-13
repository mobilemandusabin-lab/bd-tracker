// Incremental Nepalcan order statistics.
//
// The sales dashboard must show numbers for the whole dataset while only
// fetching one page of rows. Rather than re-aggregating 6,900+ orders on every
// fetch, every order write emits a small delta which is applied with atomic
// $inc operations. `rebuildOrderStats` recomputes everything from scratch and
// is the safety net for drift or bulk imports.
const NepalcanOrder = require('../models/NepalcanOrder');
const NepalcanOrderStats = require('../models/NepalcanOrderStats');
const NepalcanWeeklyStat = require('../models/NepalcanWeeklyStat');
const NepalcanCustomerStat = require('../models/NepalcanCustomerStat');

const STATUSES = ['Pending', 'Hold', 'Processing', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled', 'Returned'];
const NPT_OFFSET_MS = 5.75 * 3600000;
const STATS_ID = 'global';

// NPT calendar week starting Sunday, matching the old browser-side grouping.
const weekKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const npt = new Date(date.getTime() + NPT_OFFSET_MS);
  const sundayUtc = Date.UTC(npt.getUTCFullYear(), npt.getUTCMonth(), npt.getUTCDate() - npt.getUTCDay());
  return new Date(sundayUtc).toISOString().slice(0, 10);
};

const snapshot = (doc) => {
  if (!doc) return null;
  return {
    orderStatus: doc.orderStatus || 'Pending',
    totalAmount: Number(doc.totalAmount) || 0,
    customer: (doc.customer || '').trim() || 'Unknown',
    deliveredAt: doc.deliveredAt ? new Date(doc.deliveredAt) : null
  };
};

const contribution = (snap) => {
  const delivered = snap.orderStatus === 'Delivered';
  return {
    active: snap.orderStatus === 'Cancelled' ? 0 : 1,
    delivered: delivered ? 1 : 0,
    deliveredRevenue: delivered ? snap.totalAmount : 0,
    week: delivered && snap.deliveredAt ? weekKey(snap.deliveredAt) : null
  };
};

const newDelta = () => ({ statusCounts: {}, revenue: 0, weekly: {}, customers: {} });

const addStatus = (delta, status, amount) => {
  if (!status || !amount) return;
  delta.statusCounts[status] = (delta.statusCounts[status] || 0) + amount;
};

const addWeekly = (delta, week, revenue, orders) => {
  if (!week) return;
  const bucket = delta.weekly[week] || (delta.weekly[week] = { revenue: 0, orders: 0 });
  bucket.revenue += revenue;
  bucket.orders += orders;
};

const addCustomer = (delta, name, fields) => {
  if (!name) return;
  const bucket = delta.customers[name] || (delta.customers[name] = {
    activeOrders: 0, deliveredOrders: 0, deliveredRevenue: 0
  });
  bucket.activeOrders += fields.activeOrders || 0;
  bucket.deliveredOrders += fields.deliveredOrders || 0;
  bucket.deliveredRevenue += fields.deliveredRevenue || 0;
};

const subtractContribution = (delta, name, contrib) => {
  addCustomer(delta, name, {
    activeOrders: -contrib.active,
    deliveredOrders: -contrib.delivered,
    deliveredRevenue: -contrib.deliveredRevenue
  });
  if (contrib.week) addWeekly(delta, contrib.week, -contrib.deliveredRevenue, -contrib.delivered);
};

const addContribution = (delta, name, contrib) => {
  addCustomer(delta, name, {
    activeOrders: contrib.active,
    deliveredOrders: contrib.delivered,
    deliveredRevenue: contrib.deliveredRevenue
  });
  if (contrib.week) addWeekly(delta, contrib.week, contrib.deliveredRevenue, contrib.delivered);
};

// Diff the metric-relevant fields of an order before/after a write.
const diffOrder = (prevDoc, nextDoc) => {
  const prev = snapshot(prevDoc);
  const next = snapshot(nextDoc);
  if (!next) return null;
  if (prev && prev.orderStatus === next.orderStatus && prev.totalAmount === next.totalAmount &&
      prev.customer === next.customer &&
      String(prev.deliveredAt) === String(next.deliveredAt)) {
    return null;
  }

  const delta = newDelta();
  const before = prev ? contribution(prev) : { active: 0, delivered: 0, deliveredRevenue: 0, week: null };
  const after = contribution(next);

  if (!prev) {
    addStatus(delta, next.orderStatus, 1);
    addContribution(delta, next.customer, after);
    return delta;
  }

  if (prev.orderStatus !== next.orderStatus) {
    addStatus(delta, prev.orderStatus, -1);
    addStatus(delta, next.orderStatus, 1);
  }

  delta.revenue += after.deliveredRevenue - before.deliveredRevenue;

  if (prev.customer === next.customer) {
    addCustomer(delta, next.customer, {
      activeOrders: after.active - before.active,
      deliveredOrders: after.delivered - before.delivered,
      deliveredRevenue: after.deliveredRevenue - before.deliveredRevenue
    });
    if (before.week !== after.week) {
      if (before.week) addWeekly(delta, before.week, -before.deliveredRevenue, -before.delivered);
      if (after.week) addWeekly(delta, after.week, after.deliveredRevenue, after.delivered);
    } else if (after.week) {
      addWeekly(delta, after.week, after.deliveredRevenue - before.deliveredRevenue, 0);
    }
  } else {
    subtractContribution(delta, prev.customer, before);
    addContribution(delta, next.customer, after);
  }

  return delta;
};

const hasDelta = (delta) => Boolean(
  delta && (
    Object.values(delta.statusCounts).some(v => v !== 0) ||
    delta.revenue !== 0 ||
    Object.keys(delta.weekly).length ||
    Object.keys(delta.customers).length
  )
);

const isDuplicateKeyError = (error) => {
  if (!error) return false;
  if (error.code === 11000) return true;
  return Array.isArray(error.writeErrors) && error.writeErrors.some(e => e.code === 11000);
};

const writeStatDeltas = async (deltas) => {
  const statusInc = {};
  let revenueInc = 0;
  const weekly = {};
  const customers = {};

  for (const delta of deltas) {
    if (!delta) continue;
    revenueInc += delta.revenue;
    for (const [status, amount] of Object.entries(delta.statusCounts)) {
      if (!amount) continue;
      statusInc[`statusCounts.${status}`] = (statusInc[`statusCounts.${status}`] || 0) + amount;
    }
    for (const [week, bucket] of Object.entries(delta.weekly)) {
      const target = weekly[week] || (weekly[week] = { revenue: 0, orders: 0 });
      target.revenue += bucket.revenue;
      target.orders += bucket.orders;
    }
    for (const [customer, bucket] of Object.entries(delta.customers)) {
      const target = customers[customer] || (customers[customer] = {
        activeOrders: 0, deliveredOrders: 0, deliveredRevenue: 0
      });
      target.activeOrders += bucket.activeOrders;
      target.deliveredOrders += bucket.deliveredOrders;
      target.deliveredRevenue += bucket.deliveredRevenue;
    }
  }

  const statInc = { ...statusInc };
  if (revenueInc) statInc.revenue = revenueInc;

  if (Object.keys(statInc).length) {
    await NepalcanOrderStats.updateOne(
      { _id: STATS_ID },
      { $inc: statInc },
      { upsert: true }
    );
  }

  const weeklyOps = Object.entries(weekly)
    .filter(([, bucket]) => bucket.revenue !== 0 || bucket.orders !== 0)
    .map(([week, bucket]) => ({
      updateOne: {
        filter: { week },
        update: { $inc: { revenue: bucket.revenue, orders: bucket.orders } },
        upsert: true
      }
    }));
  if (weeklyOps.length) await NepalcanWeeklyStat.bulkWrite(weeklyOps, { ordered: false });

  const customerOps = Object.entries(customers)
    .filter(([, bucket]) => bucket.activeOrders || bucket.deliveredOrders || bucket.deliveredRevenue)
    .map(([customer, bucket]) => ({
      updateOne: {
        filter: { customer },
        update: { $inc: bucket },
        upsert: true
      }
    }));
  if (customerOps.length) await NepalcanCustomerStat.bulkWrite(customerOps, { ordered: false });
};

// Apply a batch of { prev, next } order states. Safe under concurrent sync
// workers because every write is an atomic $inc.
const applyOrderChanges = async (changes = []) => {
  const deltas = [];
  for (const change of changes) {
    const delta = diffOrder(change?.prev || null, change?.next || null);
    if (hasDelta(delta)) deltas.push(delta);
  }
  if (!deltas.length) return { applied: 0 };
  try {
    await writeStatDeltas(deltas);
  } catch (error) {
    // Two workers can race to create the same weekly/customer row.
    if (isDuplicateKeyError(error)) {
      await writeStatDeltas(deltas);
    } else {
      // The order writes already committed, so a lost delta would leave the
      // dashboard permanently stale. Recompute once from the orders
      // collection, which is the source of truth.
      console.error('[Order Stats] Incremental update failed, rebuilding:', error.message);
      await rebuildOrderStats();
    }
  }
  return { applied: deltas.length };
};

const applyOrderChange = async (prev, next) => applyOrderChanges([{ prev, next }]);

let rebuildPromise = null;

// Recompute every stat document from the orders collection.
const rebuildOrderStats = async () => {
  if (rebuildPromise) return rebuildPromise;
  rebuildPromise = (async () => {
    const [statusAgg, weeklyAgg, activeAgg, deliveredAgg] = await Promise.all([
      NepalcanOrder.aggregate([
        {
          $group: {
            _id: '$orderStatus',
            count: { $sum: 1 },
            revenue: {
              $sum: {
                $cond: [{ $eq: ['$orderStatus', 'Delivered'] }, { $ifNull: ['$totalAmount', 0] }, 0]
              }
            }
          }
        }
      ]),
      NepalcanOrder.aggregate([
        { $match: { orderStatus: 'Delivered', deliveredAt: { $ne: null } } },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: {
                  $dateTrunc: {
                    date: '$deliveredAt',
                    unit: 'week',
                    startOfWeek: 'sunday',
                    timezone: 'Asia/Kathmandu'
                  }
                },
                timezone: 'Asia/Kathmandu'
              }
            },
            revenue: { $sum: { $ifNull: ['$totalAmount', 0] } },
            orders: { $sum: 1 }
          }
        }
      ]),
      NepalcanOrder.aggregate([
        { $match: { orderStatus: { $ne: 'Cancelled' } } },
        { $group: { _id: '$customer', activeOrders: { $sum: 1 } } }
      ]),
      NepalcanOrder.aggregate([
        { $match: { orderStatus: 'Delivered' } },
        {
          $group: {
            _id: '$customer',
            deliveredOrders: { $sum: 1 },
            deliveredRevenue: { $sum: { $ifNull: ['$totalAmount', 0] } }
          }
        }
      ])
    ]);

    const statusCounts = {};
    for (const status of STATUSES) statusCounts[status] = 0;
    let revenue = 0;
    for (const row of statusAgg) {
      if (row._id) statusCounts[row._id] = row.count;
      revenue += row.revenue || 0;
    }

    const weeklyDocs = weeklyAgg
      .filter(row => row._id)
      .map(row => ({ week: row._id, revenue: row.revenue || 0, orders: row.orders || 0 }));

    const customerMap = new Map();
    const customerRow = (name) => {
      const key = (name || '').trim() || 'Unknown';
      if (!customerMap.has(key)) {
        customerMap.set(key, { customer: key, activeOrders: 0, deliveredOrders: 0, deliveredRevenue: 0 });
      }
      return customerMap.get(key);
    };
    for (const row of activeAgg) customerRow(row._id).activeOrders = row.activeOrders || 0;
    for (const row of deliveredAgg) {
      const target = customerRow(row._id);
      target.deliveredOrders = row.deliveredOrders || 0;
      target.deliveredRevenue = row.deliveredRevenue || 0;
    }

    await NepalcanOrderStats.updateOne(
      { _id: STATS_ID },
      { $set: { statusCounts, revenue } },
      { upsert: true }
    );

    await NepalcanWeeklyStat.deleteMany({});
    if (weeklyDocs.length) await NepalcanWeeklyStat.insertMany(weeklyDocs, { ordered: false });

    await NepalcanCustomerStat.deleteMany({});
    const customerDocs = [...customerMap.values()];
    if (customerDocs.length) await NepalcanCustomerStat.insertMany(customerDocs, { ordered: false });

    return {
      totalOrders: Object.values(statusCounts).reduce((sum, n) => sum + n, 0),
      revenue,
      weeklyBuckets: weeklyDocs.length,
      customerRows: customerDocs.length
    };
  })().finally(() => { rebuildPromise = null; });
  return rebuildPromise;
};

// Cheap read: one singleton + two small collections, no order scan.
const getOrderSummary = async () => {
  let stats = await NepalcanOrderStats.findById(STATS_ID).lean();
  if (!stats) {
    await rebuildOrderStats();
    stats = await NepalcanOrderStats.findById(STATS_ID).lean();
  }

  if (!stats) {
    return {
      totalOrders: 0, totalRevenue: 0, aov: 0, processingOrders: 0, deliveredOrders: 0,
      uniqueCustomers: 0, statusData: [], salesPerWeek: [], topCustomers: [], statusCounts: {}
    };
  }

  const counts = {};
  for (const status of STATUSES) counts[status] = stats.statusCounts?.[status] || 0;

  const [weekly, uniqueCustomers, topCustomerRows] = await Promise.all([
    NepalcanWeeklyStat.find({}, { week: 1, revenue: 1, orders: 1, _id: 0 }).sort({ week: 1 }).lean(),
    NepalcanCustomerStat.countDocuments({ activeOrders: { $gt: 0 } }),
    NepalcanCustomerStat.find(
      { deliveredOrders: { $gt: 0 } },
      { customer: 1, deliveredOrders: 1, _id: 0 }
    ).sort({ deliveredOrders: -1, customer: 1 }).limit(5).lean()
  ]);

  const totalOrders = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const deliveredOrders = counts.Delivered;
  const processingOrders = counts.Pending + counts.Processing;
  const totalRevenue = stats.revenue || 0;

  return {
    totalOrders,
    totalRevenue,
    aov: deliveredOrders > 0 ? Math.round(totalRevenue / deliveredOrders) : 0,
    processingOrders,
    deliveredOrders,
    uniqueCustomers,
    statusCounts: counts,
    statusData: STATUSES.filter(status => counts[status] > 0).map(name => ({ name, value: counts[name] })),
    salesPerWeek: weekly.map(row => ({ week: row.week, revenue: row.revenue || 0, orders: row.orders || 0 })),
    topCustomers: topCustomerRows.map(row => ({ name: row.customer, count: row.deliveredOrders }))
  };
};

module.exports = {
  STATUSES,
  applyOrderChange,
  applyOrderChanges,
  diffOrder,
  getOrderSummary,
  rebuildOrderStats,
  weekKey
};
