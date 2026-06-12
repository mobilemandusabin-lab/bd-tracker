const mongoose = require('mongoose');

const nepalcanSyncLogSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['orders', 'vendors', 'full'],
    default: 'orders'
  },
  success: {
    type: Boolean,
    required: true
  },
  ordersSynced: {
    type: Number,
    default: 0
  },
  vendorsSynced: {
    type: Number,
    default: 0
  },
  leadsSynced: {
    type: Number,
    default: 0
  },
  errorMessage: {
    type: String,
    default: null
  },
  apiResponse: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  durationMs: {
    type: Number,
    default: 0
  },
  mergedRecords: {
    type: Number,
    default: 0
  },
  marketplaceProducts: {
    type: Number,
    default: 0
  },
  totalProcessed: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
nepalcanSyncLogSchema.index({ createdAt: -1 });
nepalcanSyncLogSchema.index({ success: 1 });
nepalcanSyncLogSchema.index({ type: 1 });

module.exports = mongoose.model('NepalcanSyncLog', nepalcanSyncLogSchema);