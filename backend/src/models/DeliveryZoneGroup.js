const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema({
  nepalcanId: { type: String, required: true },
  name: { type: String, required: true }
}, { _id: false });

const deliveryZoneGroupSchema = new mongoose.Schema({
  nepalcanId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  branches: [branchSchema],
  isActive: { type: Boolean, default: true },
  syncedAt: { type: Date, default: Date.now }
}, { timestamps: true });

deliveryZoneGroupSchema.index({ nepalcanId: 1 }, { unique: true });

module.exports = mongoose.model('DeliveryZoneGroup', deliveryZoneGroupSchema);
