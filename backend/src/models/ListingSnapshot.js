const mongoose = require('mongoose');
const Product = require('./Product');
const Lead = require('./Lead');
const ExtensionEvent = require('./ExtensionEvent');
const User = require('./User');
const NepaliDate = require('nepali-date-converter').default;
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
  previousWeek: {
    type: mongoose.Schema.Types.Mixed,
    default: null
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
    totalListings: { type: Number, default: 0 },
    dailyAverageListings: { type: Number, default: 0 },
    totalSpecificationsAdded: { type: Number, default: 0 },
    qcApproved: { type: Number, default: 0 },
    qcRejected: { type: Number, default: 0 }
  }
}, { timestamps: true });

listingSnapshotSchema.index({ snapshotDate: -1 });
listingSnapshotSchema.index({ type: 1, snapshotDate: -1 });
listingSnapshotSchema.index({ nepaliYear: 1, nepaliMonth: 1 });
listingSnapshotSchema.index({ snapshotDate: 1, type: 1 }, { unique: true });

listingSnapshotSchema.statics.computeQcPrevWeek = async function (snapshotDate) {
  const prevEnd = new Date(snapshotDate);
  const prevStart = new Date(prevEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
  const qcCounts = await ExtensionEvent.aggregate([
    {
      $match: {
        created_at: { $gte: prevStart, $lte: prevEnd },
        event_type: { $in: ['qc_approved', 'qc_rejected'] },
        product_id: { $ne: 'b' }
      }
    },
    { $group: { _id: '$event_type', count: { $sum: { $ifNull: ['$bulk_count', 1] } } } }
  ]);
  const qcMap = {};
  for (const item of qcCounts) qcMap[item._id] = item.count;
  return { qcApproved: qcMap.qc_approved || 0, qcRejected: qcMap.qc_rejected || 0 };
};

listingSnapshotSchema.statics.captureSnapshot = async function (type, marketplaceTotal = null) {
  const now = new Date();

  let startDate, endDate;

  if (type === 'monthly') {
    const bsDate = new NepaliDate(now);
    const firstOfMonth = new NepaliDate(bsDate.getYear(), bsDate.getMonth(), 1);
    startDate = firstOfMonth.toJsDate();
    startDate.setHours(0, 0, 0, 0);
    let nextMonth = bsDate.getMonth() + 1;
    let nextYear = bsDate.getYear();
    if (nextMonth > 11) { nextMonth = 0; nextYear++; }
    const lastOfMonth = new Date(new NepaliDate(nextYear, nextMonth, 1).toJsDate().getTime() - 86400000);
    endDate = lastOfMonth;
    endDate.setHours(23, 59, 59, 999);
  } else {
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() - ((startDate.getDay() + 7 - 0) % 7));
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 5);
    endDate.setHours(23, 59, 59, 999);
  }

  const [specEvents, listingEvents, verifiedProductsAgg] = await Promise.all([
    ExtensionEvent.aggregate([
      {
        $match: {
          event_type: 'spec_added',
          created_at: { $gte: startDate, $lte: endDate }
        }
      },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$bulk_count', 1] } } } }
    ]),

    ExtensionEvent.aggregate([
      {
        $match: {
          event_type: 'listing_created',
          created_at: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalListings: { $sum: { $ifNull: ['$bulk_count', 1] } }
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
    previousWeek: await this.computeQcPrevWeek(snapshotDate),
    snapshotDate,
    nepaliDate: bsDate.formatted,
    nepaliYear: bsDate.year,
    nepaliMonth: bsDate.month,
    type
  };

  return await this.create(snapshotData);
};

module.exports = mongoose.model('ListingSnapshot', listingSnapshotSchema);
