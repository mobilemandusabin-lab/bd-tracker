const mongoose = require('mongoose');
const Lead = require('./Lead');
const NepalcanOrder = require('./NepalcanOrder');
const { toNepaliDateObject } = require('../utils/nepaliDate');

const vendorSnapshotSchema = new mongoose.Schema({
  totalVendors: {
    type: Number,
    required: true
  },
  verifiedVendors: {
    type: Number,
    required: true
  },
  activeSellers: {
    type: Number,
    required: true
  },
  snapshotDate: {
    type: Date,
    required: true
  },
  nepaliDate: {
    type: String,
    required: true
  },
  nepaliYear: {
    type: Number,
    required: true
  },
  nepaliMonth: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['weekly', 'monthly'],
    required: true
  }
}, { timestamps: true });

vendorSnapshotSchema.index({ snapshotDate: -1 });
vendorSnapshotSchema.index({ type: 1, snapshotDate: -1 });
vendorSnapshotSchema.index({ nepaliYear: 1, nepaliMonth: 1 });
vendorSnapshotSchema.index({ snapshotDate: 1, type: 1 }, { unique: true });

vendorSnapshotSchema.statics.captureSnapshot = async function (type) {
  const [totalVendors, verifiedVendors, activeSellerAgg] = await Promise.all([
    Lead.countDocuments({ type: 'vendor' }),
    Lead.countDocuments({
      type: 'vendor',
      $or: [
        { is_verified: true },
        { verification_status: 'verified' }
      ]
    }),
    NepalcanOrder.aggregate([
      { $match: { orderStatus: 'Delivered' } },
      { $group: { _id: '$vendor_lead_id' } },
      { $count: 'total' }
    ])
  ]);

  const activeSellers = activeSellerAgg.length > 0 ? activeSellerAgg[0].total : 0;

  const now = new Date();
  const bsDate = toNepaliDateObject(now);

  const snapshotDateStr = now.toISOString().split('T')[0];
  const snapshotDate = new Date(snapshotDateStr);

  const existing = await this.findOne({ snapshotDate, type });
  if (existing) return existing;

  return await this.create({
    totalVendors,
    verifiedVendors,
    activeSellers,
    snapshotDate,
    nepaliDate: bsDate.formatted,
    nepaliYear: bsDate.year,
    nepaliMonth: bsDate.month,
    type
  });
};

module.exports = mongoose.model('VendorSnapshot', vendorSnapshotSchema);
