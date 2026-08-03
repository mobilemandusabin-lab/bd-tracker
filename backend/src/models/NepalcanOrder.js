const mongoose = require('mongoose');

const statusHistorySchema = new mongoose.Schema({
  status: {
    type: String,
    required: true,
    enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned']
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const nepalcanOrderSchema = new mongoose.Schema({
  // Nepalcan order ID
  orderId: {
    type: String,
    required: true,
    unique: true
  },
  // Internal ID from Nepalcan
  nepalcanId: {
    type: String,
    unique: true,
    sparse: true
  },
  customer: {
    type: String,
    required: true
  },
  vendor: {
    type: String
  },
  vendor_lead_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    default: null
  },
  vendor_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    default: null
  },
  source: {
    type: String
  },
  orderStatus: {
    type: String,
    enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'],
    default: 'Pending'
  },
  paymentStatus: {
    type: String
  },
  paymentMethod: {
    type: String
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  shippingAmount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date
  },
  // Nepalcan API's last-modified timestamp — used for delta sync
  apiUpdatedAt: {
    type: Date
  },
  // Track status changes with timestamps
  statusHistory: [statusHistorySchema],
  // Full order data from API
  rawData: {
    type: mongoose.Schema.Types.Mixed
  },
  // Full tracking snapshot from logistics API, captured during sync
  trackingData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  // Order-level amount change history
  priceHistory: [{
    field: { type: String },
    oldValue: { type: Number },
    newValue: { type: Number },
    source: { type: String, enum: ['sync', 'manual'], default: 'sync' },
    timestamp: { type: Date, default: Date.now }
  }],
  // Last synced with Nepalcan
  lastSyncedAt: {
    type: Date,
    default: Date.now
  },
  // Pre-computed total processing duration in hours (first status to last status)
  processingDurationHours: {
    type: Number,
    default: null
  },
  // Source of the current orderStatus value
  statusSource: {
    type: String,
    enum: ['commerce_api', 'logistics_api', 'manual'],
    default: 'commerce_api'
  }
}, {
  timestamps: true
});

// Calculate time spent in each status
nepalcanOrderSchema.methods.getProcessingTimes = function() {
  const history = this.statusHistory.sort((a, b) => a.timestamp - b.timestamp);
  const times = {};
  
  for (let i = 0; i < history.length - 1; i++) {
    const current = history[i];
    const next = history[i + 1];
    const timeDiff = new Date(next.timestamp) - new Date(current.timestamp);
    const hours = Math.round(timeDiff / (1000 * 60 * 60));
    
    const key = `${current.status}_to_${next.status}`;
    times[key] = hours;
  }
  
  return times;
};

// Calculate average time from Pending to Delivered
nepalcanOrderSchema.methods.getTotalFulfillmentTime = function() {
  const history = this.statusHistory.sort((a, b) => a.timestamp - b.timestamp);
  
  const pendingEntry = history.find(h => h.status === 'Pending');
  const deliveredEntry = history.find(h => h.status === 'Delivered');
  
  if (pendingEntry && deliveredEntry) {
    const timeDiff = new Date(deliveredEntry.timestamp) - new Date(pendingEntry.timestamp);
    return Math.round(timeDiff / (1000 * 60 * 60)); // in hours
  }
  
  return null;
};

// Indexes for analytics queries
nepalcanOrderSchema.index({ orderStatus: 1, createdAt: -1 });
nepalcanOrderSchema.index({ vendor_lead_id: 1 });
nepalcanOrderSchema.index({ createdAt: -1 });
nepalcanOrderSchema.index({ vendor: 1 });
nepalcanOrderSchema.index({ customer: 1 });

module.exports = mongoose.model('NepalcanOrder', nepalcanOrderSchema);
