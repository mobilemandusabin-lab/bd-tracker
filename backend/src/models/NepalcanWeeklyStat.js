const mongoose = require('mongoose');

// Delivered revenue per NPT week (Sunday start), maintained incrementally.
const nepalcanWeeklyStatSchema = new mongoose.Schema({
  week: { type: String, required: true, unique: true },
  revenue: { type: Number, default: 0 },
  orders: { type: Number, default: 0 }
}, {
  timestamps: true,
  versionKey: false
});

module.exports = mongoose.model('NepalcanWeeklyStat', nepalcanWeeklyStatSchema);
