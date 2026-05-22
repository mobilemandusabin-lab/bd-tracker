const mongoose = require('mongoose');

const extensionEventSchema = new mongoose.Schema({
  event_type: {
    type: String,
    enum: ['listing_created', 'product_created', 'product_updated', 'qc_approved', 'qc_rejected', 'qc_pending', 'spec_added'],
    required: true
  },
  product_id: {
    type: String,
    default: null
  },
  vendor_id: {
    type: String,
    default: null
  },
  product_name: {
    type: String,
    default: null
  },
  product_sku: {
    type: String,
    default: null
  },
  qc_status: {
    type: String,
    default: null
  },
  pending_count: {
    type: Number,
    default: null
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lead_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

extensionEventSchema.index({ event_type: 1, created_at: -1 });
extensionEventSchema.index({ user_id: 1, created_at: -1 });
extensionEventSchema.index({ event_type: 1, pending_count: 1, created_at: -1 });
extensionEventSchema.index({ product_id: 1, event_type: 1, created_at: -1 });

const ExtensionEvent = mongoose.model('ExtensionEvent', extensionEventSchema);
module.exports = ExtensionEvent;
