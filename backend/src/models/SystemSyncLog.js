const mongoose = require('mongoose');

const systemSyncLogSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['running', 'completed', 'failed'],
    default: 'running'
  },
  triggeredBy: {
    type: String,
    enum: ['cron', 'manual', 'startup'],
    default: 'cron'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  success: {
    type: Boolean,
    default: null
  },
  durationMs: {
    type: Number,
    default: 0
  },
  tasks: {
    overdueCheck: {
      ran: { type: Boolean, default: false },
      success: { type: Boolean, default: null },
      result: { type: mongoose.Schema.Types.Mixed, default: null },
      error: { type: String, default: null },
      durationMs: { type: Number, default: 0 }
    },
    nepalcanOrders: {
      ran: { type: Boolean, default: false },
      success: { type: Boolean, default: null },
      ordersSynced: { type: Number, default: 0 },
      error: { type: String, default: null },
      durationMs: { type: Number, default: 0 }
    },
    returnedCheck: {
      ran: { type: Boolean, default: false },
      success: { type: Boolean, default: null },
      ordersUpdated: { type: Number, default: 0 },
      error: { type: String, default: null },
      durationMs: { type: Number, default: 0 }
    },
    vendorSync: {
      ran: { type: Boolean, default: false },
      success: { type: Boolean, default: null },
      vendorsSynced: { type: Number, default: 0 },
      vendorsCreated: { type: Number, default: 0 },
      vendorsUpdated: { type: Number, default: 0 },
      branchesUpdated: { type: Number, default: 0 },
      error: { type: String, default: null },
      durationMs: { type: Number, default: 0 }
    },
    vendorSnapshots: {
      ran: { type: Boolean, default: false },
      success: { type: Boolean, default: null },
      snapshotsTaken: { type: Number, default: 0 },
      error: { type: String, default: null },
      durationMs: { type: Number, default: 0 }
    }
  },
  errorMessage: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

systemSyncLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('SystemSyncLog', systemSyncLogSchema);
