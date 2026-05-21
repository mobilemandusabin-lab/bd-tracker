const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: 500
  },
  sku: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  // Category references (normalized)
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required']
  },
  // Denormalized category data for fast queries
  c1Id: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  c2Id: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  c3Id: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  c4Id: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  c1Name: { type: String },
  c2Name: { type: String },
  c3Name: { type: String },
  c4Name: { type: String },
  fullCategoryPath: { type: String },
  // Product details
  price: {
    type: Number,
    default: 0,
    min: 0
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'discontinued'],
    default: 'active'
  },
  // QC stats (denormalized)
  qcStats: {
    total: { type: Number, default: 0 },
    passed: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    passRate: { type: Number, default: 0 }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for fast queries
productSchema.index({ categoryId: 1 });
productSchema.index({ c1Id: 1 });
productSchema.index({ c2Id: 1 });
productSchema.index({ c3Id: 1 });
productSchema.index({ c4Id: 1 });
productSchema.index({ vendorId: 1 });
productSchema.index({ status: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ fullCategoryPath: 1 });
productSchema.index({ name: 'text', description: 'text' });

const Product = mongoose.model('Product', productSchema);
module.exports = Product;
