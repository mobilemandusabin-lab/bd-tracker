const ListingSnapshot = require('../models/ListingSnapshot');
const { takeSnapshot } = require('../services/listingSnapshotService');
const NepaliDate = require('nepali-date-converter').default;

exports.getLiveData = async (req, res) => {
  try {
    const Lead = require('../models/Lead');
    const ExtensionEvent = require('../models/ExtensionEvent');

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 7 - 0) % 7));
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 5);
    weekEnd.setHours(23, 59, 59, 999);

    let totalMarketplaceProducts = 0;
    try {
      const { fetchTotalMarketplaceProducts } = require('../services/nepalcanSyncService');
      totalMarketplaceProducts = await fetchTotalMarketplaceProducts();
    } catch {
      const Product = require('../models/Product');
      totalMarketplaceProducts = await Product.countDocuments({ isActive: true });
    }
    if (!totalMarketplaceProducts) {
      const latest = await ListingSnapshot.findOne().sort({ snapshotDate: -1 });
      if (latest?.totalMarketplaceProducts) {
        totalMarketplaceProducts = latest.totalMarketplaceProducts;
      }
    }

    const [verifiedAgg, specAgg, listingAgg] = await Promise.all([
      Lead.aggregate([
        {
          $match: { type: 'vendor', $or: [{ is_verified: true }, { verification_status: 'verified' }] }
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
      ]),
      ExtensionEvent.aggregate([
        { $match: { event_type: 'spec_added', created_at: { $gte: weekStart, $lte: weekEnd } } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$bulk_count', 1] } } } }
      ]),
      ExtensionEvent.aggregate([
        { $match: { event_type: 'listing_created', created_at: { $gte: weekStart, $lte: weekEnd } } },
        { $group: { _id: '$user_id', listingCount: { $sum: { $ifNull: ['$bulk_count', 1] } } } },
        { $match: { listingCount: { $gt: 1 } } },
        { $group: { _id: null, totalListings: { $sum: '$listingCount' } } }
      ])
    ]);

    const verifiedMarketplaceProducts = verifiedAgg.length > 0 ? verifiedAgg[0].total : 0;
    const totalSpecificationsAdded = specAgg.length > 0 ? specAgg[0].total : 0;
    const weeklyListings = listingAgg.length > 0 ? listingAgg[0].totalListings : 0;

    res.status(200).json({
      status: 'success',
      data: {
        totalMarketplaceProducts,
        verifiedMarketplaceProducts,
        totalListings: weeklyListings,
        dailyAverageListings: Math.round(weeklyListings / 6),
        totalSpecificationsAdded
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.getSnapshots = async (req, res) => {
  try {
    const { type, limit = 24, page = 1 } = req.query;
    const query = {};

    if (type && type !== 'all') {
      query.type = type;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [snapshots, total] = await Promise.all([
      ListingSnapshot.find(query)
        .sort({ snapshotDate: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      ListingSnapshot.countDocuments(query)
    ]);

    res.status(200).json({
      status: 'success',
      data: { snapshots, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.getLatestSnapshot = async (req, res) => {
  try {
    const [latestWeekly, latestMonthly] = await Promise.all([
      ListingSnapshot.findOne({ type: 'weekly' }).sort({ snapshotDate: -1 }),
      ListingSnapshot.findOne({ type: 'monthly' }).sort({ snapshotDate: -1 })
    ]);

    res.status(200).json({
      status: 'success',
      data: { weekly: latestWeekly, monthly: latestMonthly }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

function computeNextTargetDate(type) {
  const now = new Date();
  const bsNow = new NepaliDate(now);
  let targetDate;

  if (type === 'weekly') {
    const daysUntilFriday = bsNow.getDay() === 5 ? 0 : (5 - bsNow.getDay() + 7) % 7;
    targetDate = bsNow.toJsDate();
    targetDate.setDate(targetDate.getDate() + daysUntilFriday);
  } else {
    let nextMonth = bsNow.getMonth() + 1;
    let nextYear = bsNow.getYear();
    if (nextMonth > 11) { nextMonth = 0; nextYear++; }
    const firstOfNext = new NepaliDate(nextYear, nextMonth, 1);
    targetDate = new Date(firstOfNext.toJsDate().getTime() - 86400000);
  }

  targetDate.setHours(23, 59, 59, 999);
  if (targetDate.getTime() <= now.getTime()) {
    if (type === 'weekly') {
      targetDate.setDate(targetDate.getDate() + 7);
    } else {
      let nextMonth = bsNow.getMonth() + 2;
      let nextYear = bsNow.getYear();
      if (nextMonth > 11) { nextMonth -= 12; nextYear++; }
      const firstOfNextNext = new NepaliDate(nextYear, nextMonth, 1);
      targetDate = new Date(firstOfNextNext.toJsDate().getTime() - 86400000);
      targetDate.setHours(23, 59, 59, 999);
    }
  }

  return {
    type,
    targetDate: targetDate.toISOString(),
    delayMs: targetDate.getTime() - now.getTime(),
    scheduledAt: now.toISOString()
  };
}

exports.getNextSchedule = async (req, res) => {
  try {
    const schedule = {
      weekly: computeNextTargetDate('weekly'),
      monthly: computeNextTargetDate('monthly')
    };
    res.status(200).json({ status: 'success', data: schedule });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.getComparison = async (req, res) => {
  try {
    const { type = 'weekly', count = 12 } = req.query;
    const limit = parseInt(count) + 1;

    const snapshots = await ListingSnapshot.find({ type })
      .sort({ snapshotDate: 1 })
      .limit(limit);

    const comparison = [];
    for (let i = 0; i < snapshots.length; i++) {
      const current = snapshots[i];
      const previous = i > 0 ? snapshots[i - 1] : null;
      const prevTargets = previous?.targets || {};

      comparison.push({
        _id: current._id,
        totalMarketplaceProducts: current.totalMarketplaceProducts,
        verifiedMarketplaceProducts: current.verifiedMarketplaceProducts || 0,
        totalListings: current.totalListings || 0,
        dailyAverageListings: current.dailyAverageListings,
        totalSpecificationsAdded: current.totalSpecificationsAdded,
        prevTotalMarketplaceProducts: previous ? previous.totalMarketplaceProducts : null,
        prevVerifiedMarketplaceProducts: previous ? previous.verifiedMarketplaceProducts || 0 : null,
        prevTotalListings: previous ? previous.totalListings || 0 : null,
        prevDailyAverageListings: previous ? previous.dailyAverageListings : null,
        prevTotalSpecificationsAdded: previous ? previous.totalSpecificationsAdded : null,
        snapshotDate: current.snapshotDate,
        prevSnapshotDate: previous ? previous.snapshotDate : null,
        nepaliDate: current.nepaliDate,
        prevNepaliDate: previous ? previous.nepaliDate : null,
        nepaliYear: current.nepaliYear,
        nepaliMonth: current.nepaliMonth,
        type: current.type,
        targets: {
          totalListings: prevTargets.totalListings || null,
          dailyAverageListings: prevTargets.dailyAverageListings || null,
          totalSpecificationsAdded: prevTargets.totalSpecificationsAdded || null
        },

        totalMarketplaceProductsDelta: previous ? current.totalMarketplaceProducts - previous.totalMarketplaceProducts : 0,
        verifiedMarketplaceProductsDelta: previous ? (current.verifiedMarketplaceProducts || 0) - (previous.verifiedMarketplaceProducts || 0) : 0,
        dailyAverageListingsDelta: previous ? current.dailyAverageListings - previous.dailyAverageListings : 0,
        totalSpecificationsAddedDelta: previous ? current.totalSpecificationsAdded - previous.totalSpecificationsAdded : 0,
        totalMarketplaceProductsPercentChange: previous && previous.totalMarketplaceProducts > 0
          ? parseFloat((((current.totalMarketplaceProducts - previous.totalMarketplaceProducts) / previous.totalMarketplaceProducts) * 100).toFixed(1))
          : 0,
        verifiedMarketplaceProductsPercentChange: previous && previous.verifiedMarketplaceProducts > 0
          ? parseFloat((((current.verifiedMarketplaceProducts - previous.verifiedMarketplaceProducts) / previous.verifiedMarketplaceProducts) * 100).toFixed(1))
          : 0,
        dailyAverageListingsPercentChange: previous && previous.dailyAverageListings > 0
          ? parseFloat((((current.dailyAverageListings - previous.dailyAverageListings) / previous.dailyAverageListings) * 100).toFixed(1))
          : 0,
        totalSpecificationsAddedPercentChange: previous && previous.totalSpecificationsAdded > 0
          ? parseFloat((((current.totalSpecificationsAdded - previous.totalSpecificationsAdded) / previous.totalSpecificationsAdded) * 100).toFixed(1))
          : 0
      });
    }

    res.status(200).json({
      status: 'success',
      data: { snapshots: comparison.reverse() }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.triggerSnapshot = async (req, res) => {
  try {
    const { type = 'weekly' } = req.body;

    if (!['weekly', 'monthly'].includes(type)) {
      return res.status(400).json({ status: 'error', message: 'Type must be weekly or monthly' });
    }

    const snapshot = await takeSnapshot(type);

    res.status(201).json({
      status: 'success',
      data: { snapshot }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.updateTargets = async (req, res) => {
  try {
    const { type = 'weekly', targets } = req.body;

    if (!['weekly', 'monthly'].includes(type)) {
      return res.status(400).json({ status: 'error', message: 'Type must be weekly or monthly' });
    }

    const snapshot = await ListingSnapshot.findOne({ type }).sort({ snapshotDate: -1 });
    if (!snapshot) {
      return res.status(404).json({ status: 'error', message: 'No snapshot found for this type' });
    }

    snapshot.targets = {
      totalListings: targets.totalListings ?? snapshot.targets?.totalListings ?? null,
      dailyAverageListings: targets.dailyAverageListings ?? snapshot.targets?.dailyAverageListings ?? null,
      totalSpecificationsAdded: targets.totalSpecificationsAdded ?? snapshot.targets?.totalSpecificationsAdded ?? null
    };
    await snapshot.save();

    res.status(200).json({ status: 'success', data: { snapshot } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.deleteSnapshots = async (req, res) => {
  try {
    const { type } = req.query;
    const query = type ? { type } : {};
    const result = await ListingSnapshot.deleteMany(query);
    res.status(200).json({ status: 'success', deleted: result.deletedCount });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};
