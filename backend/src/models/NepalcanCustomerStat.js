const mongoose = require('mongoose');

// Per-customer running totals. `activeOrders` counts every non-cancelled
// order, so uniqueCustomers is a count over this collection instead of a scan
// of the orders collection.
const nepalcanCustomerStatSchema = new mongoose.Schema({
  customer: { type: String, required: true, unique: true },
  activeOrders: { type: Number, default: 0 },
  deliveredOrders: { type: Number, default: 0 },
  deliveredRevenue: { type: Number, default: 0 }
}, {
  timestamps: true,
  versionKey: false
});

nepalcanCustomerStatSchema.index({ activeOrders: 1 });
nepalcanCustomerStatSchema.index({ deliveredOrders: -1 });

module.exports = mongoose.model('NepalcanCustomerStat', nepalcanCustomerStatSchema);
