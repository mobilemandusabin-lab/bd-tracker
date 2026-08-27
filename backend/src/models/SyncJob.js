const mongoose = require('mongoose');

const syncJobSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  total: { type: Number, default: 0 },
  processed: { type: Number, default: 0 },
  successful: { type: Number, default: 0 },
  failed: { type: Number, default: 0 },
  batchSize: { type: Number, default: 100 },
  cursor: { type: String, default: null },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  lastProcessedAt: { type: Date, default: null },
  error: { type: String, default: null },
  processedIds: { type: [String], default: [] },
  lockedAt: { type: Date, default: null },
  lockedBy: { type: String, default: null }
}, { timestamps: true });

syncJobSchema.index({ status: 1 });
syncJobSchema.index({ createdAt: -1 });

module.exports = mongoose.model('SyncJob', syncJobSchema);