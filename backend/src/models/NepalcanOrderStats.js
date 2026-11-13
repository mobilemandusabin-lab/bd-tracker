const mongoose = require('mongoose');

// Singleton running totals for the Nepalcan sales dashboard.
// Updated incrementally on every order write so the summary never depends on
// how many rows the table fetched. `rebuildOrderStats` can repair it from the
// orders collection at any time.
const statusCountsSchema = new mongoose.Schema({
  Pending: { type: Number, default: 0 },
  Hold: { type: Number, default: 0 },
  Processing: { type: Number, default: 0 },
  Confirmed: { type: Number, default: 0 },
  Shipped: { type: Number, default: 0 },
  Delivered: { type: Number, default: 0 },
  Cancelled: { type: Number, default: 0 },
  Returned: { type: Number, default: 0 }
}, { _id: false });

const nepalcanOrderStatsSchema = new mongoose.Schema({
  _id: { type: String, default: 'global' },
  statusCounts: { type: statusCountsSchema, default: () => ({}) },
  // Sum of totalAmount across orders currently in Delivered status.
  revenue: { type: Number, default: 0 }
}, {
  timestamps: true,
  versionKey: false
});

module.exports = mongoose.model('NepalcanOrderStats', nepalcanOrderStatsSchema);
