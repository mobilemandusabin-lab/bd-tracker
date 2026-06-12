const VendorSnapshot = require('../models/VendorSnapshot');
const { takeSnapshot } = require('../services/vendorSnapshotService');
const NepaliDate = require('nepali-date-converter').default;

// GET /api/v1/vendor-snapshots
exports.getSnapshots = async (req, res) => {
  try {
    const { type, limit = 24, page = 1 } = req.query;
    const query = {};

    if (type && type !== 'all') {
      query.type = type;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [snapshots, total] = await Promise.all([
      VendorSnapshot.find(query)
        .sort({ snapshotDate: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      VendorSnapshot.countDocuments(query)
    ]);

    res.status(200).json({
      status: 'success',
      data: { snapshots, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// GET /api/v1/vendor-snapshots/live
exports.getLiveData = async (req, res) => {
  try {
    const Lead = require('../models/Lead');
    const NepalcanOrder = require('../models/NepalcanOrder');

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

    res.status(200).json({
      status: 'success',
      data: { totalVendors, verifiedVendors, activeSellers }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// GET /api/v1/vendor-snapshots/latest
exports.getLatestSnapshot = async (req, res) => {
  try {
    const [latestWeekly, latestMonthly] = await Promise.all([
      VendorSnapshot.findOne({ type: 'weekly' }).sort({ snapshotDate: -1 }),
      VendorSnapshot.findOne({ type: 'monthly' }).sort({ snapshotDate: -1 })
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

// GET /api/v1/vendor-snapshots/next-schedule
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

// GET /api/v1/vendor-snapshots/compare
exports.getComparison = async (req, res) => {
  try {
    const { type = 'weekly', count = 12 } = req.query;
    const limit = parseInt(count) + 1;

    const snapshots = await VendorSnapshot.find({ type })
      .sort({ snapshotDate: 1 })
      .limit(limit);

    const comparison = [];
    for (let i = 0; i < snapshots.length; i++) {
      const current = snapshots[i];
      const previous = i > 0 ? snapshots[i - 1] : null;

      // Targets from the previous snapshot represent goals for this snapshot
      const targets = previous?.targets || {};

      comparison.push({
        _id: current._id,
        totalVendors: current.totalVendors,
        verifiedVendors: current.verifiedVendors,
        activeSellers: current.activeSellers,
        prevTotalVendors: previous ? previous.totalVendors : null,
        prevVerifiedVendors: previous ? previous.verifiedVendors : null,
        prevActiveSellers: previous ? previous.activeSellers : null,
        snapshotDate: current.snapshotDate,
        prevSnapshotDate: previous ? previous.snapshotDate : null,
        nepaliDate: current.nepaliDate,
        prevNepaliDate: previous ? previous.nepaliDate : null,
        nepaliYear: current.nepaliYear,
        nepaliMonth: current.nepaliMonth,
        type: current.type,
        targets: {
          totalVendors: targets.totalVendors || null,
          verifiedVendors: targets.verifiedVendors || null,
          activeSellers: targets.activeSellers || null
        },
        currentTargets: current.targets || {},
        totalVendorsDelta: previous ? current.totalVendors - previous.totalVendors : 0,
        verifiedVendorsDelta: previous ? current.verifiedVendors - previous.verifiedVendors : 0,
        activeSellersDelta: previous ? current.activeSellers - previous.activeSellers : 0,
        totalVendorsPercentChange: previous && previous.totalVendors > 0
          ? parseFloat((((current.totalVendors - previous.totalVendors) / previous.totalVendors) * 100).toFixed(1))
          : 0,
        verifiedVendorsPercentChange: previous && previous.verifiedVendors > 0
          ? parseFloat((((current.verifiedVendors - previous.verifiedVendors) / previous.verifiedVendors) * 100).toFixed(1))
          : 0,
        activeSellersPercentChange: previous && previous.activeSellers > 0
          ? parseFloat((((current.activeSellers - previous.activeSellers) / previous.activeSellers) * 100).toFixed(1))
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

// POST /api/v1/vendor-snapshots/capture
exports.triggerSnapshot = async (req, res) => {
  try {
    const { type = 'weekly', targets } = req.body;

    if (!['weekly', 'monthly'].includes(type)) {
      return res.status(400).json({ status: 'error', message: 'Type must be weekly or monthly' });
    }

    const snapshot = await takeSnapshot(type, targets);

    res.status(201).json({
      status: 'success',
      data: { snapshot }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// PATCH /api/v1/vendor-snapshots/targets
exports.updateTargets = async (req, res) => {
  try {
    const { type = 'weekly', targets } = req.body;

    if (!['weekly', 'monthly'].includes(type)) {
      return res.status(400).json({ status: 'error', message: 'Type must be weekly or monthly' });
    }

    const snapshot = await VendorSnapshot.findOne({ type }).sort({ snapshotDate: -1 });
    if (!snapshot) {
      return res.status(404).json({ status: 'error', message: 'No snapshot found for this type' });
    }

    snapshot.targets = {
      totalVendors: targets.totalVendors ?? snapshot.targets?.totalVendors ?? null,
      verifiedVendors: targets.verifiedVendors ?? snapshot.targets?.verifiedVendors ?? null,
      activeSellers: targets.activeSellers ?? snapshot.targets?.activeSellers ?? null
    };
    await snapshot.save();

    res.status(200).json({ status: 'success', data: { snapshot } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// DELETE /api/v1/vendor-snapshots
exports.deleteSnapshots = async (req, res) => {
  try {
    const { type } = req.query;
    const query = type ? { type } : {};
    const result = await VendorSnapshot.deleteMany(query);
    res.status(200).json({ status: 'success', deleted: result.deletedCount });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};
