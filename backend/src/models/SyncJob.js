const mongoose = require('mongoose');

const syncErrorSchema = new mongoose.Schema({
  recordId: { type: String, default: null },
  message: { type: String, default: null },
  at: { type: Date, default: Date.now }
}, { _id: false });

const syncJobSchema = new mongoose.Schema({
  sync_type: {
    type: String,
    enum: ['full', 'nepalcan_orders', 'tracking', 'nepalcan_vendors', 'branches'],
    default: 'full'
  },
  status: {
    type: String,
    enum: ['pending', 'running', 'paused', 'stale', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  total: { type: Number, default: 0 }, // alias of total_records
  processed: { type: Number, default: 0 },
  successful: { type: Number, default: 0 },
  failed: { type: Number, default: 0 },
  skipped: { type: Number, default: 0 },
  batchSize: { type: Number, default: 100 },
  cursor: { type: String, default: null }, // legacy generic cursor
  current_page: { type: Number, default: 1 },
  last_processed_id: { type: String, default: null },
  payload: {
    phase: { type: String, enum: ['orders', 'tracking', 'vendors', 'branches', 'done'], default: 'orders' },
    pages: { type: mongoose.Schema.Types.Mixed, default: {} },
    totals: { type: mongoose.Schema.Types.Mixed, default: {} },
    totalApi: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  started_at: { type: Date, default: null },
  startedAt: { type: Date, default: null }, // legacy alias
  last_heartbeat_at: { type: Date, default: null },
  lastProcessedAt: { type: Date, default: null }, // legacy alias
  completed_at: { type: Date, default: null },
  completedAt: { type: Date, default: null }, // legacy alias
  error_message: { type: String, default: null },
  error: { type: String, default: null }, // legacy alias
  retry_count: { type: Number, default: 0 },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  worker_id: { type: String, default: null },
  lease_until: { type: Date, default: null },
  lockedAt: { type: Date, default: null }, // legacy
  lockedBy: { type: String, default: null }, // legacy
  batch_errors: { type: [syncErrorSchema], default: [] },
  batch_started_at: { type: Date, default: null },
  avg_batch_ms: { type: Number, default: null }
}, { timestamps: true, suppressReservedKeysWarning: true });

syncJobSchema.index({ status: 1, sync_type: 1 });
// One active job per sync_type — application race safety net
syncJobSchema.index(
  { sync_type: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['pending', 'running', 'paused'] } } }
);
syncJobSchema.index({ createdAt: -1 });
syncJobSchema.index({ lease_until: 1 });

module.exports = mongoose.model('SyncJob', syncJobSchema);
