require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });

const mongoose = require('mongoose');
const NepalcanOrder = require('../src/models/NepalcanOrder');
const {
  lifecycleFields,
  normalizeStatusHistory,
  trackingEvents
} = require('../src/utils/orderLifecycle');

const apply = process.argv.includes('--apply');
const dedupe = process.argv.includes('--dedupe');

const sameSecond = (a, b) => Math.abs(new Date(a) - new Date(b)) < 1000;

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 60000,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 60000
  });

  const orders = await NepalcanOrder.find({}).lean();
  const operations = [];
  const report = {
    scanned: orders.length,
    changed: 0,
    duplicateHistoryEntriesRemoved: 0,
    deliveredDatesBackfilled: 0,
    returnedDatesBackfilled: 0,
    deliveredMissingDate: 0,
    returnedMissingDate: 0,
    exactTrackingDates: 0,
    estimatedLegacyDates: 0
  };

  for (const order of orders) {
    const before = order.statusHistory || [];
    const exact = trackingEvents(order.trackingData);
    const normalizedHistory = normalizeStatusHistory(before).map(event => {
      const matched = exact.find(item => item.status === event.status && sameSecond(item.timestamp, event.timestamp));
      return matched ? { ...event, source: 'logistics_api', accuracy: 'exact' } : event;
    });
    const history = dedupe ? normalizedHistory : before.map(event => {
      const matched = exact.find(item => item.status === event.status && sameSecond(item.timestamp, event.timestamp));
      return matched ? { ...event, source: 'logistics_api', accuracy: 'exact' } : event;
    });
    report.duplicateHistoryEntriesRemoved += Math.max(0, before.length - normalizedHistory.length);

    const dates = lifecycleFields({ ...order, statusHistory: history });
    if (order.orderStatus === 'Delivered' && !dates.deliveredAt) report.deliveredMissingDate += 1;
    if (order.orderStatus === 'Returned' && !dates.returnedAt) report.returnedMissingDate += 1;
    if (!order.deliveredAt && dates.deliveredAt) report.deliveredDatesBackfilled += 1;
    if (!order.returnedAt && dates.returnedAt) report.returnedDatesBackfilled += 1;
    if (dates.dateQuality.delivered.accuracy === 'exact') report.exactTrackingDates += 1;
    else if (dates.deliveredAt) report.estimatedLegacyDates += 1;

    const set = { statusHistory: history };
    for (const field of ['processingAt', 'shippedAt', 'deliveredAt', 'cancelledAt', 'returnedAt']) {
      if (dates[field]) set[field] = dates[field];
    }
    const changed = (dedupe && before.length !== history.length) ||
      ['processingAt', 'shippedAt', 'deliveredAt', 'cancelledAt', 'returnedAt']
        .some(field => dates[field] && (!order[field] || new Date(order[field]).getTime() !== new Date(dates[field]).getTime()));
    if (!changed) continue;
    report.changed += 1;
    operations.push({ updateOne: { filter: { _id: order._id }, update: { $set: set } } });
  }

  if (apply && operations.length) {
    const result = await NepalcanOrder.bulkWrite(operations, { ordered: false });
    report.modified = result.modifiedCount;
  }

  console.log(JSON.stringify({ mode: apply ? 'applied' : 'dry-run', dedupe, ...report }, null, 2));
  await mongoose.disconnect();
})().catch(async error => {
  console.error(error.message);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
