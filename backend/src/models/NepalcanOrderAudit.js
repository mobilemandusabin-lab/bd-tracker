const mongoose = require('mongoose');

const auditItemSchema = new mongoose.Schema({
  orderId: { type: String, required: true },
  orderStatus: String,
  status: { type: String, enum: ['OK', 'MISMATCH', 'NO_PRICING', 'NO_ZONE', 'MISSING_BRANCH', 'ERROR'], required: true },
  zoneGroup: String,
  serviceType: String,
  totalValue: Number,
  originBranch: String,
  originBranchName: String,
  destinationBranch: String,
  destinationBranchName: String,
  actual: {
    customer: Number, drop: Number, pickup: Number, retD: Number, retND: Number
  },
  expected: {
    customer: Number, drop: Number, pickup: Number, retD: Number, retND: Number
  },
  diffs: [String],
  error: String
}, { _id: false });

const nepalcanOrderAuditSchema = new mongoose.Schema({
  runAt: { type: Date, required: true },
  completedAt: Date,
  status: { type: String, enum: ['running', 'completed', 'failed'], default: 'running' },
  summary: {
    total: { type: Number, default: 0 },
    ok: { type: Number, default: 0 },
    mismatch: { type: Number, default: 0 },
    noPricing: { type: Number, default: 0 },
    noZone: { type: Number, default: 0 },
    missingBranch: { type: Number, default: 0 },
    errors: { type: Number, default: 0 }
  },
  items: [auditItemSchema]
}, { timestamps: true });

module.exports = mongoose.model('NepalcanOrderAudit', nepalcanOrderAuditSchema);
