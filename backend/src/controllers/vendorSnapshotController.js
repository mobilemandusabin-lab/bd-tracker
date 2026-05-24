const VendorSnapshot = require('../models/VendorSnapshot');
const { takeSnapshot } = require('../services/vendorSnapshotService');

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

// GET /api/v1/vendor-snapshots/compare
exports.getComparison = async (req, res) => {
  try {
    const { type = 'weekly', count = 12 } = req.query;
    const limit = parseInt(count) + 1;

    const snapshots = await VendorSnapshot.find({ type })
      .sort({ snapshotDate: 1 })
      .limit(limit);

    const comparison = [];
    for (let i = 1; i < snapshots.length; i++) {
      const current = snapshots[i];
      const previous = snapshots[i - 1];

      comparison.push({
        _id: current._id,
        totalVendors: current.totalVendors,
        verifiedVendors: current.verifiedVendors,
        activeSellers: current.activeSellers,
        prevTotalVendors: previous.totalVendors,
        prevVerifiedVendors: previous.verifiedVendors,
        prevActiveSellers: previous.activeSellers,
        snapshotDate: current.snapshotDate,
        prevSnapshotDate: previous.snapshotDate,
        nepaliDate: current.nepaliDate,
        prevNepaliDate: previous.nepaliDate,
        nepaliYear: current.nepaliYear,
        nepaliMonth: current.nepaliMonth,
        type: current.type,
        totalVendorsDelta: current.totalVendors - previous.totalVendors,
        verifiedVendorsDelta: current.verifiedVendors - previous.verifiedVendors,
        activeSellersDelta: current.activeSellers - previous.activeSellers,
        totalVendorsPercentChange: previous.totalVendors > 0
          ? parseFloat((((current.totalVendors - previous.totalVendors) / previous.totalVendors) * 100).toFixed(1))
          : 0,
        verifiedVendorsPercentChange: previous.verifiedVendors > 0
          ? parseFloat((((current.verifiedVendors - previous.verifiedVendors) / previous.verifiedVendors) * 100).toFixed(1))
          : 0,
        activeSellersPercentChange: previous.activeSellers > 0
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
