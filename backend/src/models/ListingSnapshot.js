const mongoose = require('mongoose');
const Product = require('./Product');
const Lead = require('./Lead');
const ExtensionEvent = require('./ExtensionEvent');
const User = require('./User');
const { toNepaliDateObject } = require('../utils/nepaliDate');

const listingSnapshotSchema = new mongoose.Schema({
  totalMarketplaceProducts: {
    type: Number,
    required: true
  },
  verifiedMarketplaceProducts: {
    type: Number,
    default: 0
  },
  totalListings: {
    type: Number,
    default: 0
  },
  dailyAverageListings: {
    type: Number,
    required: true
  },
  totalSpecificationsAdded: {
    type: Number,
    required: true
  },
  specificationCompletionPercent: {
    type: Number,
    default: 0
  },
  backlogProducts: {
    type: Number,
    default: 0
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
  },
  targets: {
    totalListings: { type: Number, default: null },
    dailyAverageListings: { type: Number, default: null },
    totalSpecificationsAdded: { type: Number, default: null }
  }
}, { timestamps: true });

listingSnapshotSchema.index({ snapshotDate: -1 });
listingSnapshotSchema.index({ type: 1, snapshotDate: -1 });
listingSnapshotSchema.index({ nepaliYear: 1, nepaliMonth: 1 });
listingSnapshotSchema.index({ snapshotDate: 1, type: 1 }, { unique: true });

listingSnapshotSchema.statics.captureSnapshot = async function (type, marketplaceTotal = null) {
  const now = new Date();

  const sundayStart = new Date(now);
  sundayStart.setDate(sundayStart.getDate() - ((sundayStart.getDay() + 7 - 0) % 7));
  sundayStart.setHours(0, 0, 0, 0);

  const fridayEnd = new Date(sundayStart);
  fridayEnd.setDate(fridayEnd.getDate() + 5);
  fridayEnd.setHours(23, 59, 59, 999);

  const [specEvents, listingEvents, verifiedProductsAgg] = await Promise.all([
    ExtensionEvent.aggregate([
      {
        $match: {
          event_type: 'spec_added',
          created_at: { $gte: sundayStart, $lte: fridayEnd }
        }
      },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$bulk_count', 1] } } } }
    ]),

    ExtensionEvent.aggregate([
      {
        $match: {
          event_type: 'listing_created',
          created_at: { $gte: sundayStart, $lte: fridayEnd }
        }
      },
      {
        $group: {
          _id: '$user_id',
          listingCount: { $sum: { $ifNull: ['$bulk_count', 1] } }
        }
      },
      {
        $match: { listingCount: { $gt: 1 } }
      },
      {
        $group: {
          _id: null,
          totalListings: { $sum: '$listingCount' }
        }
      }
    ]),

    Lead.aggregate([
      {
        $match: {
          type: 'vendor',
          $or: [
            { is_verified: true },
            { verification_status: 'verified' }
          ]
        }
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $max: [
                { $ifNull: ['$total_products_listed', 0] },
                { $ifNull: ['$expected_product_count', 0] }
              ]
            }
          }
        }
      }
    ])
  ]);

  let totalMarketplaceProducts = marketplaceTotal;

  if (totalMarketplaceProducts === null) {
    totalMarketplaceProducts = verifiedProductsAgg.length > 0 ? verifiedProductsAgg[0].total : 0;
  }

  const verifiedMarketplaceProducts = verifiedProductsAgg.length > 0 ? verifiedProductsAgg[0].total : 0;
  const totalSpecificationsAdded = specEvents.length > 0 ? specEvents[0].total : 0;

  const weeklyListings = listingEvents.length > 0 ? listingEvents[0].totalListings : 0;
  const dailyAverageListings = Math.round(weeklyListings / 6);

  const snapshotDateStr = now.toISOString().split('T')[0];
  const snapshotDate = new Date(snapshotDateStr);
  const bsDate = toNepaliDateObject(now);

  const existing = await this.findOne({ snapshotDate, type });
  if (existing) return existing;

  const snapshotData = {
    totalMarketplaceProducts,
    verifiedMarketplaceProducts,
    totalListings: weeklyListings,
    dailyAverageListings,
    totalSpecificationsAdded,
    snapshotDate,
    nepaliDate: bsDate.formatted,
    nepaliYear: bsDate.year,
    nepaliMonth: bsDate.month,
    type
  };

  return await this.create(snapshotData);
};

module.exports = mongoose.model('ListingSnapshot', listingSnapshotSchema);
