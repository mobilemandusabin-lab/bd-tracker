import mongoose from 'mongoose';

const statusHistorySchema = new mongoose.Schema({
  status: {
    type: String,
    required: true,
    enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled']
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
  source: {
    type: String
  },
  orderStatus: {
    type: String,
    enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
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
  updatedAt: {
    type: Date
  },
  // Track status changes with timestamps
  statusHistory: [statusHistorySchema],
  // Full order data from API
  rawData: {
    type: mongoose.Schema.Types.Mixed
  },
  // Last synced with Nepalcan
  lastSyncedAt: {
    type: Date,
    default: Date.now
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

export default mongoose.model('NepalcanOrder', nepalcanOrderSchema);
