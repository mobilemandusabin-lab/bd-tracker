const mongoose = require('mongoose');
const ExtensionVersion = require('../models/ExtensionVersion');
const ExtensionDevice = require('../models/ExtensionDevice');
const ExtensionEvent = require('../models/ExtensionEvent');
const Activity = require('../models/Activity');
const Lead = require('../models/Lead');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

// POST /extension/login — Extension-specific login (restricted to qc/listing teams)
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

    // Only qc and listing team members can use the extension
    if (!user.team || !['qc', 'listing'].includes(user.team)) {
      return res.status(403).json({ status: 'fail', message: 'Only QC and Listing team members can use the extension' });
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

// GET /extension/latest-version
exports.getLatestVersion = async (req, res) => {
  try {
    const version = await ExtensionVersion.findOne({ is_latest: true }).sort({ created_at: -1 });
    if (!version) {
      return res.status(404).json({ status: 'fail', message: 'No version found' });
    }
    res.status(200).json({
      status: 'success',
      data: {
        version: version.version,
        changelog: version.changelog,
        created_at: version.created_at
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// GET /extension/download
exports.downloadExtension = async (req, res) => {
  try {
    const version = await ExtensionVersion.findOne({ is_latest: true }).sort({ created_at: -1 });
    if (!version) {
      return res.status(404).json({ status: 'fail', message: 'No version found' });
    }

    const zipPath = path.join(__dirname, '../../public/extension/extension.zip');
    if (!fs.existsSync(zipPath)) {
      return res.status(404).json({ status: 'fail', message: 'Extension package not found' });
    }

    res.download(zipPath, `bd-tracker-extension-v${version.version}.zip`);
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
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
    const { event_type, product_id, vendor_id, product_name, qc_status, product_sku, metadata } = req.body;

    // Verify required fields
    if (!event_type) {
      return res.status(400).json({ status: 'fail', message: 'event_type is required' });
    }

    const validEvents = ['listing_created', 'product_updated', 'qc_approved', 'qc_rejected', 'qc_pending', 'spec_added'];
    if (!validEvents.includes(event_type)) {
      return res.status(400).json({ status: 'fail', message: `Invalid event_type. Must be one of: ${validEvents.join(', ')}` });
    }

    // Verify product_id exists for non-listing events
    if (event_type !== 'listing_created' && !product_id) {
      return res.status(400).json({ status: 'fail', message: 'product_id is required for this event type' });
    }

    // Try to find the lead by nepalcanId (vendor_id)
    let lead_id = null;
    if (vendor_id) {
      const lead = await Lead.findOne({ nepalcanId: vendor_id });
      if (lead) {
        lead_id = lead._id;
      }
    }

    // Format description based on event type
    let description = '';
    let activitySubtype = event_type;

    switch (event_type) {
      case 'listing_created':
        description = `Product listed: ${product_name || product_id} [${product_sku || 'no SKU'}] (Vendor: ${vendor_id}) — QC: ${qc_status || 'pending'}`;
        break;
      case 'product_updated':
        description = `Product updated: ${product_name || product_id} [${product_sku || 'no SKU'}] (Vendor: ${vendor_id}) — QC: ${qc_status || 'unknown'}`;
        break;
      case 'qc_approved':
        description = `QC approved: ${product_name || product_id} [${product_sku || 'no SKU'}] (Vendor: ${vendor_id})`;
        break;
      case 'qc_rejected':
        description = `QC rejected: ${product_name || product_id} [${product_sku || 'no SKU'}] (Vendor: ${vendor_id})`;
        break;
      case 'qc_pending':
        description = `QC pending: ${product_name || product_id} [${product_sku || 'no SKU'}] (Vendor: ${vendor_id})`;
        break;
      case 'spec_added':
        description = `Spec added: ${product_name || product_id} [${product_sku || 'no SKU'}] (Vendor: ${vendor_id})`;
        break;
      default:
        description = `${event_type}: ${product_name || product_id || 'unknown'}`;
    }

    // Create structured ExtensionEvent first (analytics data is never lost)
    const extensionEvent = await ExtensionEvent.create({
      event_type,
      product_id,
      vendor_id,
      product_name,
      product_sku,
      qc_status,
      user_id: req.user._id,
      lead_id: lead_id || undefined,
      metadata: metadata || {}
    });

    // Also create Activity record for the activity feed
    const activity = await Activity.create({
      lead_id: lead_id || undefined,
      user_id: req.user._id,
      activity_type: 'note',
      description,
      status: 'completed'
    });

    res.status(201).json({
      status: 'success',
      data: {
        activity_id: activity._id,
        event_id: extensionEvent._id,
        event_type,
        product_id,
        vendor_id,
        verified: true,
        lead_matched: !!lead_id
      }
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
    const { period = '7d', user_id } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate;
    switch (period) {
      case 'today': startDate = new Date(now.setHours(0, 0, 0, 0)); break;
      case '7d': startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); break;
      case '30d': startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); break;
      case '90d': startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); break;
      default: startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    }

    const matchFilter = { created_at: { $gte: startDate } };
    if (user_id && mongoose.Types.ObjectId.isValid(user_id)) {
      matchFilter.user_id = new mongoose.Types.ObjectId(user_id);
    }

    // Aggregate counts by event type
    const eventsByType = await ExtensionEvent.aggregate([
      { $match: matchFilter },
      { $group: { _id: '$event_type', count: { $sum: 1 } } }
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

    // Build summary
    const summary = {};
    for (const item of eventsByType) {
      summary[item._id] = item.count;
    }

    res.status(200).json({
      status: 'success',
      data: {
        period,
        summary: {
          listing_created: summary.listing_created || 0,
          product_updated: summary.product_updated || 0,
          qc_approved: summary.qc_approved || 0,
          qc_rejected: summary.qc_rejected || 0,
          qc_pending: summary.qc_pending || 0,
          spec_added: summary.spec_added || 0,
          total: Object.values(summary).reduce((a, b) => a + b, 0)
        },
        dailyEvents,
        eventsByUser,
        recentEvents
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};
