const mongoose = require('mongoose');

const pricingSlabSchema = new mongoose.Schema({
  productPriceFrom: { type: Number, required: true },
  productPriceTo: { type: Number, required: true },
  customerDeliveryCharge: { type: Number, required: true },
  vendorDropCharge: { type: Number, required: true },
  vendorPickupCharge: { type: Number, required: true }
}, { _id: false });

const providerPricingSchema = new mongoose.Schema({
  nepalcanId: { type: String, required: true, unique: true },
  entity: { type: String, required: true },
  serviceType: { type: String, required: true, enum: ['D2D', 'D2B'] },
  deliveryZoneGroup: { type: String, required: true },
  deliveryZoneGroupName: { type: String },
  pricingSlabs: [pricingSlabSchema],
  returnChargeDelivered: { type: Number, default: 0 },
  returnChargeNotDelivered: { type: Number, default: 0 },
  fallbackPrice: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  entityName: { type: String },
  syncedAt: { type: Date, default: Date.now }
}, { timestamps: true });

providerPricingSchema.index({ deliveryZoneGroup: 1, serviceType: 1 });

module.exports = mongoose.model('ProviderPricing', providerPricingSchema);
