const mongoose = require('mongoose');
const ExtensionVersion = require('../models/ExtensionVersion');
const ExtensionDevice = require('../models/ExtensionDevice');
const ExtensionEvent = require('../models/ExtensionEvent');
const Lead = require('../models/Lead');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');

// POST /extension/login — Extension login (any active user)
exports.extensionLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ status: 'fail', message: 'Provide email and password' });
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({ status: 'fail', message: 'User not registered' });
    }

    const isPasswordCorrect = await user.comparePassword(password);
    if (!isPasswordCorrect) {
      return res.status(401).json({ status: 'fail', message: 'Incorrect email or password' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ status: 'fail', message: 'Account is inactive' });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN
    });

    user.last_login = Date.now();
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      status: 'success',
      token,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          team: user.team
        }
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// GET /extension/latest-version — reads directly from manifest.json
exports.getLatestVersion = async (req, res) => {
  try {
    const manifest = require('../../public/extension/manifest.json');
    res.status(200).json({
      status: 'success',
      data: {
        version: manifest.version,
        changelog: `Extension v${manifest.version}`,
        created_at: new Date().toISOString()
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// GET /extension/download — zips extension source on-the-fly
exports.downloadExtension = async (req, res) => {
  try {
    const manifestPath = path.join(__dirname, '../../public/extension/manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const version = manifest.version || '1.0.0';

    const extDir = path.join(__dirname, '../../public/extension');

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="bd-tracker-extension-v${version}.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => { throw err; });
    archive.pipe(res);

    const files = fs.readdirSync(extDir);
    for (const file of files) {
      const fullPath = path.join(extDir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        archive.directory(fullPath, file);
      } else if (!file.endsWith('.zip')) {
        archive.file(fullPath, { name: file });
      }
    }

    await archive.finalize();
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  }
};

// POST /extension/register
exports.registerDevice = async (req, res) => {
  try {
    const { device_id, extension_version } = req.body;
    if (!device_id) {
      return res.status(400).json({ status: 'fail', message: 'device_id is required' });
    }

    const device = await ExtensionDevice.findOneAndUpdate(
      { user_id: req.user._id, device_id },
      {
        user_id: req.user._id,
        device_id,
        extension_version: extension_version || '1.0.0',
        status: 'active',
        last_heartbeat: new Date(),
        registered_at: new Date()
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({
      status: 'success',
      data: { device }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// POST /extension/heartbeat
exports.heartbeat = async (req, res) => {
  try {
    const { device_id } = req.body;
    if (!device_id) {
      return res.status(400).json({ status: 'fail', message: 'device_id is required' });
    }

    const device = await ExtensionDevice.findOneAndUpdate(
      { user_id: req.user._id, device_id },
      { last_heartbeat: new Date(), status: 'active' },
      { new: true }
    );

    if (!device) {
      return res.status(404).json({ status: 'fail', message: 'Device not registered' });
    }

    res.status(200).json({ status: 'success', data: { device_id, status: 'active' } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// POST /extension/activity-log
exports.logActivity = async (req, res) => {
  try {
    const { event_type, product_id, vendor_id, product_name, qc_status, product_sku, pending_count, metadata } = req.body;

    // Verify required fields
    if (!event_type) {
      return res.status(400).json({ status: 'fail', message: 'event_type is required' });
    }

    const validEvents = ['listing_created', 'product_created', 'product_updated', 'qc_approved', 'qc_rejected', 'qc_pending', 'spec_added'];
    if (!validEvents.includes(event_type)) {
      return res.status(400).json({ status: 'fail', message: `Invalid event_type. Must be one of: ${validEvents.join(', ')}` });
    }

    // Try to extract product_id from URL path if not provided (webRequest source)
    let effectiveProductId = product_id;
    if (!effectiveProductId && metadata?.url) {
      const match = metadata.url.match(/\/products\/([a-f0-9]+)/);
      if (match) effectiveProductId = match[1];
    }

    // Handle listing_created: new listing vs edit
    let effectiveEventType = event_type;
    if (event_type === 'listing_created' && effectiveProductId) {
      const isPost = metadata?.method === 'POST';
      if (isPost) {
      } else {
        // PUT = check if this is a new listing or an edit
        // Increased window to 60 minutes to support staff opening many tabs at once
        const sixtyMinAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentCreation = await ExtensionEvent.findOne({
          event_type: 'product_created',
          product_id: effectiveProductId,
          created_at: { $gte: sixtyMinAgo }
        });
        if (recentCreation) {
          // New listing: delete product_created signal, keep listing_created
          await ExtensionEvent.deleteOne({ _id: recentCreation._id });
        } else {
          // Edit of existing listing: convert to product_updated
          effectiveEventType = 'product_updated';
        }
      }
    }

    // Deduplicate: skip spec_added if a listing_created for the same product exists within 60 minutes
    if (event_type === 'spec_added' && effectiveProductId) {
      const sixtyMinAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentListing = await ExtensionEvent.findOne({
        event_type: 'listing_created',
        product_id: effectiveProductId,
        created_at: { $gte: sixtyMinAgo }
      });
      if (recentListing) {
        return res.status(200).json({
          status: 'success',
          data: {
            event_id: recentListing._id,
            event_type: 'spec_added',
            product_id: effectiveProductId,
            duplicate: true,
            message: 'Skipped — listing created within 60 min'
          }
        });
      }
    }

    // Deduplicate: qc_pending recorded once, stays until manually removed
    if (event_type === 'qc_pending') {
      const existing = await ExtensionEvent.findOne({ event_type: 'qc_pending' });
      if (existing) {
        return res.status(200).json({
          status: 'success',
          data: {
            event_id: existing._id,
            event_type: 'qc_pending',
            pending_count: existing.pending_count,
            duplicate: true,
            message: 'Already recorded — remove from DB to re-sync'
          }
        });
      }
    }

    // Try to find the lead by nepalcanId (vendor_id)
    let lead_id = null;
    if (vendor_id) {
      const lead = await Lead.findOne({ nepalcanId: vendor_id });
      if (lead) {
        lead_id = lead._id;
      }
    }

    // Create ExtensionEvent (single source of truth for extension analytics)
    const extensionEvent = await ExtensionEvent.create({
      event_type: effectiveEventType,
      product_id: effectiveProductId,
      vendor_id,
      product_name,
      product_sku,
      qc_status,
      pending_count: pending_count || metadata?.pending_count || null,
      user_id: req.user._id,
      lead_id: lead_id || undefined,
      metadata: metadata || {}
    });

    res.status(201).json({
      status: 'success',
      data: {
        event_id: extensionEvent._id,
        event_type: effectiveEventType,
        product_id: effectiveProductId,
        vendor_id,
        verified: true,
        lead_matched: !!lead_id
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// DELETE /extension/qc-pending — Remove qc_pending record to allow re-sync
exports.deleteQcPending = async (req, res) => {
  try {
    const result = await ExtensionEvent.deleteMany({ event_type: 'qc_pending' });
    res.status(200).json({
      status: 'success',
      message: `Deleted ${result.deletedCount} qc_pending record(s)`
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// GET /extension/devices
exports.getDevices = async (req, res) => {
  try {
    const devices = await ExtensionDevice.find()
      .populate('user_id', 'name email role')
      .sort({ last_heartbeat: -1 });

    res.status(200).json({
      status: 'success',
      results: devices.length,
      data: { devices }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// GET /extension/stats
exports.getStats = async (req, res) => {
  try {
    const totalDevices = await ExtensionDevice.countDocuments();
    const activeDevices = await ExtensionDevice.countDocuments({
      last_heartbeat: { $gte: new Date(Date.now() - 15 * 60 * 1000) }
    });
    const uniqueUsers = await ExtensionDevice.distinct('user_id');
    const latestVersion = await ExtensionVersion.findOne({ is_latest: true }).sort({ created_at: -1 });

    res.status(200).json({
      status: 'success',
      data: {
        totalDevices,
        activeDevices,
        uniqueUsers: uniqueUsers.length,
        latestVersion: latestVersion?.version || '1.0.0',
        latestChangelog: latestVersion?.changelog || ''
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// GET /extension/analytics
exports.getAnalytics = async (req, res) => {
  try {
    const { period = '7d', user_id, start_date, end_date } = req.query;

    // Calculate date range — custom dates take priority over period
    let startDate, endDate;
    if (start_date) {
      startDate = new Date(start_date + 'T00:00:00.000Z');
      endDate = end_date
        ? new Date(end_date + 'T23:59:59.999Z')
        : new Date();
    } else {
      const now = new Date();
      endDate = new Date();
      switch (period) {
        case 'today': startDate = new Date(now.setHours(0, 0, 0, 0)); break;
        case '7d': startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); break;
        case '30d': startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); break;
        case '90d': startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); break;
        default: startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      }
    }

    const matchFilter = { created_at: { $gte: startDate, $lte: endDate } };
    if (user_id && mongoose.Types.ObjectId.isValid(user_id)) {
      matchFilter.user_id = new mongoose.Types.ObjectId(user_id);
    }

    // Aggregate counts by event type
    const eventsByType = await ExtensionEvent.aggregate([
      { $match: matchFilter },
      { $group: { _id: '$event_type', count: { $sum: 1 } } }
    ]);

    // Get latest pending count for each day
    const dailyPendingCounts = await ExtensionEvent.aggregate([
      { $match: { ...matchFilter, event_type: 'qc_pending', pending_count: { $ne: null } } },
      { $sort: { created_at: -1 } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } },
          latest_pending_count: { $first: '$pending_count' },
          latest_time: { $first: '$created_at' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Daily breakdown
    const dailyEvents = await ExtensionEvent.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } },
            event_type: '$event_type'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);

    // Events by user
    const eventsByUser = await ExtensionEvent.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: { user_id: '$user_id', event_type: '$event_type' },
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id.user_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$_id.user_id',
          user_name: { $first: '$user.name' },
          user_team: { $first: '$user.team' },
          events: {
            $push: {
              event_type: '$_id.event_type',
              count: '$count'
            }
          },
          total: { $sum: '$count' }
        }
      },
      { $sort: { total: -1 } }
    ]);

    // Recent events
    const recentEvents = await ExtensionEvent.find(matchFilter)
      .populate('user_id', 'name team')
      .sort({ created_at: -1 })
      .limit(20)
      .lean();

    // Get latest qc_pending count (global, not per-user)
    const latestPendingEvent = await ExtensionEvent.findOne(
      { event_type: 'qc_pending', pending_count: { $ne: null } },
      { pending_count: 1 }
    ).sort({ created_at: -1 }).lean();
    const latestPendingCount = latestPendingEvent?.pending_count ?? null;

    // Vendor conversions: activated + new active sellers in date range
    const Lead = require('../models/Lead');
    const [activatedToday, activeSellersToday] = await Promise.all([
      Lead.countDocuments({
        lead_status: 'Activated',
        updated_at: { $gte: startDate, $lte: endDate }
      }),
      Lead.countDocuments({
        lead_status: 'Active Seller',
        updated_at: { $gte: startDate, $lte: endDate }
      })
    ]);

    // Build summary
    const summary = {};
    for (const item of eventsByType) {
      if (item._id !== 'qc_pending') {
        summary[item._id] = item.count;
      }
    }

    // Build dailyComparison: merge pending counts + event counts per day
    const pendingMap = {};
    for (const pc of dailyPendingCounts) {
      pendingMap[pc._id] = pc.latest_pending_count;
    }
    const dailyByDate = {};
    for (const ev of dailyEvents) {
      if (!dailyByDate[ev._id.date]) dailyByDate[ev._id.date] = {};
      dailyByDate[ev._id.date][ev._id.event_type] = ev.count;
    }
    const allDates = new Set([...Object.keys(pendingMap), ...Object.keys(dailyByDate)]);
    const dailyComparison = [...allDates].sort().map((date) => ({
      date,
      pending: pendingMap[date] ?? null,
      approved: dailyByDate[date]?.qc_approved || 0,
      rejected: dailyByDate[date]?.qc_rejected || 0,
      created: dailyByDate[date]?.product_created || 0,
      listed: dailyByDate[date]?.listing_created || 0,
      specs: dailyByDate[date]?.spec_added || 0,
      updated: dailyByDate[date]?.product_updated || 0,
    }));

    res.status(200).json({
      status: 'success',
      data: {
        period,
        start_date: start_date || null,
        end_date: end_date || null,
        summary: {
          product_created: summary.product_created || 0,
          listing_created: summary.listing_created || 0,
          product_updated: summary.product_updated || 0,
          qc_approved: summary.qc_approved || 0,
          qc_rejected: summary.qc_rejected || 0,
          qc_pending: latestPendingCount,
          spec_added: summary.spec_added || 0,
          total: Object.values(summary).reduce((a, b) => a + b, 0)
        },
        vendorConversions: {
          activated: activatedToday,
          active_sellers: activeSellersToday
        },
        dailyComparison,
        dailyEvents,
        dailyPendingCounts,
        eventsByUser,
        recentEvents
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// GET /extension/debug — Returns last 20 extension events
exports.debugEvents = async (req, res) => {
  try {
    const events = await ExtensionEvent.find()
      .sort({ created_at: -1 })
      .limit(20)
      .lean();

    res.status(200).json({
      status: 'success',
      count: events.length,
      events: events.map(e => ({
        event_type: e.event_type,
        product_id: e.product_id,
        product_name: e.product_name,
        created_at: e.created_at
      }))
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};
