const mongoose = require('mongoose');

// Delivery cost constants from Nepalcan Commerce
const DELIVERY_COSTS = {
  D2D: { service: 100, pickup: 15 },
  D2B: { service: 120, pickup: 15 },
  B2B: { service: 70, pickup: 0 }
};

const financeSchema = new mongoose.Schema({
  order_id: {
    type: String,
    required: [true, 'Order ID is required'],
    unique: true,
    trim: true
  },
  nepalcan_order_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NepalcanOrder',
    default: null
  },
  product_name: {
    type: String,
    trim: true
  },
  product_price: {
    type: Number,
    required: [true, 'Product price is required'],
    min: 0
  },
  customer_name: {
    type: String,
    trim: true
  },
  delivery_charge_contribution: {
    type: Number,
    default: 0,
    min: 0
  },
  cost_to_vendor: {
    type: Number,
    default: 0,
    min: 0
  },
  vendor_name: {
    type: String,
    trim: true
  },
  delivery_type: {
    type: String,
    enum: ['D2D', 'D2B', 'B2B'],
    default: 'D2D'
  },

  // ── Computed fields (auto-calculated) ──────────────────────────
  commission: { type: Number, default: 0 },
  tds: { type: Number, default: 0 },
  net_payment: { type: Number, default: 0 },
  total_revenue: { type: Number, default: 0 },
  service_cost: { type: Number, default: 0 },
  pickup_charge: { type: Number, default: 0 },
  total_charge: { type: Number, default: 0 },
  revenue_recognized: { type: Number, default: 0 },
  delivery_cost_recognized: { type: Number, default: 0 },
  profit: { type: Number, default: 0 },

  // ── Metadata ──────────────────────────────────────────────────
  payment_status: {
    type: String,
    enum: ['Paid', 'Pending'],
    default: 'Pending'
  },
  payment_date: { type: Date },
  delivery_date: { type: Date },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

// Indexes (order_id already indexed via unique: true in schema)
financeSchema.index({ delivery_date: -1 });
financeSchema.index({ vendor_name: 1 });
financeSchema.index({ payment_status: 1 });

// Calculate all computed fields
financeSchema.methods.calculateFinancials = function() {
  const price = this.product_price || 0;
  const delContrib = this.delivery_charge_contribution || 0;
  const costVendor = this.cost_to_vendor || 0;
  const costs = DELIVERY_COSTS[this.delivery_type] || DELIVERY_COSTS.D2D;

  this.commission = parseFloat((price * 0.02825).toFixed(2));
  this.tds = parseFloat((price * 0.01).toFixed(2));
  this.net_payment = parseFloat((price - this.commission - this.tds - costVendor).toFixed(2));
  this.total_revenue = parseFloat((delContrib + this.commission + costVendor).toFixed(2));
  this.service_cost = costs.service;
  this.pickup_charge = costs.pickup;
  this.total_charge = costs.service + costs.pickup;
  this.revenue_recognized = parseFloat((this.total_revenue / 1.13).toFixed(2));
  this.delivery_cost_recognized = parseFloat((this.total_charge / 1.13).toFixed(2));
  this.profit = parseFloat((this.revenue_recognized - this.delivery_cost_recognized).toFixed(2));
};

financeSchema.pre('save', function() {
  this.updated_at = Date.now();
  this.calculateFinancials();
});

financeSchema.set('toJSON', { virtuals: true });
financeSchema.set('toObject', { virtuals: true });

const Finance = mongoose.model('Finance', financeSchema);
module.exports = Finance;
