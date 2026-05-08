const mongoose = require('mongoose');

const productReadinessSchema = new mongoose.Schema({
  vendor_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: [true, 'Please provide vendor ID']
  },
  total_products_expected: {
    type: Number,
    default: 0
  },
  total_uploaded: {
    type: Number,
    default: 0
  },
  approved_products: {
    type: Number,
    default: 0
  },
  rejected_products: {
    type: Number,
    default: 0
  },
  quality_status: {
    type: String,
    enum: ['draft', 'under_review', 'approved', 'rejected', 'live'],
    default: 'draft'
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

productReadinessSchema.pre('save', function() {
  this.updated_at = Date.now();
});

const ProductReadiness = mongoose.model('ProductReadiness', productReadinessSchema);
module.exports = ProductReadiness;
