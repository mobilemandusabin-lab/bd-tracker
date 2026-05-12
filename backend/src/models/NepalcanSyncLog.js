const mongoose = require('mongoose');

const nepalcanSyncLogSchema = new mongoose.Schema({
  success: {
    type: Boolean,
    required: true
  },
  ordersSynced: {
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
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
nepalcanSyncLogSchema.index({ createdAt: -1 });
nepalcanSyncLogSchema.index({ success: 1 });

module.exports = mongoose.model('NepalcanSyncLog', nepalcanSyncLogSchema);