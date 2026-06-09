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
// Uses fs.readFileSync (not require) so serverless / long-running servers
// always see the current file on disk, not a cached copy from startup.
// 60s in-memory cache to avoid disk read on every heartbeat (one per device / 60min)
let manifestCache = { mtimeMs: 0, data: null, at: 0 };
const MANIFEST_CACHE_TTL_MS = 60 * 1000;
exports.getLatestVersion = async (req, res) => {
  try {
    const manifestPath = path.join(__dirname, '../../public/extension/manifest.json');
    const now = Date.now();
    let manifest = null;
    if (manifestCache.data && now - manifestCache.at < MANIFEST_CACHE_TTL_MS) {
      try {
        const stat = fs.statSync(manifestPath);
        if (stat.mtimeMs === manifestCache.mtimeMs) {
          manifest = manifestCache.data;
        } else {
          manifestCache = { mtimeMs: 0, data: null, at: 0 };
        }
      } catch (_) {}
    }
    if (!manifest) {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      const stat = fs.statSync(manifestPath);
      manifestCache = { mtimeMs: stat.mtimeMs, data: manifest, at: now };
    }
    const version = manifest.version || '1.0.0';
    res.status(200).json({
      status: 'success',
      data: {
        version,
        changelog: `Extension v${version}`,
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

    // zlib level 1 — fast compression, downloads are usually on local network
    const archive = archiver('zip', { zlib: { level: 1 } });
    archive.on('error', (err) => { throw err; });
    archive.pipe(res);

    const files = await fs.promises.readdir(extDir);
    for (const file of files) {
      const fullPath = path.join(extDir, file);
      const stat = await fs.promises.stat(fullPath);
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
    const { event_type, product_id, vendor_id, product_name, qc_status, product_sku, pending_count, bulk_count, metadata, workflow_state, session_duration } = req.body;

    console.log('[EXT] logActivity', { event_type, product_id, user_id: req.user?._id, method: metadata?.method, url: metadata?.url });

    // Verify required fields
    if (!event_type) {
      return res.status(400).json({ status: 'fail', message: 'event_type is required' });
    }

    const validEvents = ['listing_created', 'product_created', 'product_updated', 'product_viewed', 'qc_approved', 'qc_rejected', 'qc_pending', 'spec_added', 'session_ended'];
    if (!validEvents.includes(event_type)) {
      return res.status(400).json({ status: 'fail', message: `Invalid event_type. Must be one of: ${validEvents.join(', ')}` });
    }

    // Try to extract product_id from URL path if not provided (webRequest source)
    let effectiveProductId = product_id;
    if (!effectiveProductId && metadata?.url) {
      const match = metadata.url.match(/\/products\/([a-f0-9]+)/);
      if (match) effectiveProductId = match[1];
    }

    // session_ended: log directly, no dedup
    if (event_type === 'session_ended') {
      const extensionEvent = await ExtensionEvent.create({
        event_type: 'session_ended',
        product_id: effectiveProductId,
        vendor_id: vendor_id || null,
        product_name: product_name || null,
        product_sku: null,
        qc_status: null,
        pending_count: null,
        user_id: req.user._id,
        workflow_state: metadata?.workflow_state || metadata?.final_state || null,
        session_duration: metadata?.total_duration || null,
        metadata: metadata || {}
      });

      // Reclassifier: if the session ended in LISTING_CREATED state and no
      // listing_created exists for this product, create one. Safety net for
      // cases where the extension's real-time detection didn't fire (old
      // extension version, cache miss on first PUT, etc.).
      if (effectiveProductId && metadata?.final_state === 'LISTING_CREATED') {
        const existingListing = await ExtensionEvent.findOne({
          product_id: effectiveProductId,
          event_type: 'listing_created'
        });
        if (!existingListing) {
          await ExtensionEvent.create({
            event_type: 'listing_created',
            product_id: effectiveProductId,
            vendor_id: vendor_id || null,
            product_name: product_name || null,
            product_sku: null,
            qc_status: null,
            pending_count: null,
            user_id: req.user._id,
            workflow_state: 'LISTING_CREATED',
            metadata: metadata || {}
          });
          console.log('[EXT] reclassifier: created listing_created from session_ended', { product_id: effectiveProductId });
        }
      }

      return res.status(201).json({
        status: 'success',
        data: {
          event_id: extensionEvent._id,
          event_type: 'session_ended',
          product_id: effectiveProductId,
          completed: metadata?.completed || false,
          final_state: metadata?.final_state || null
        }
      });
    }

    // Handle listing_created: new listing vs edit
    let effectiveEventType = event_type;
    if (event_type === 'listing_created' && effectiveProductId) {
      const isPost = metadata?.method === 'POST';
      if (isPost) {
        // POST is always a new listing
      } else {
        // PUT: disambiguate new listing vs edit
        // Increased window to 24 hours — staff may create products in bulk then list later
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentProductCreated = await ExtensionEvent.findOne({
          event_type: 'product_created',
          product_id: effectiveProductId,
          created_at: { $gte: oneDayAgo }
        });
        if (recentProductCreated) {
          // Old extension flow: clean up the pre-signal, keep as listing_created
          await ExtensionEvent.deleteOne({ _id: recentProductCreated._id });
          console.log('[EXT] listing_created PUT: product_created pre-signal found, cleaned up', { product_id: effectiveProductId });
        } else {
          // v1.0.4+ flow: no product_created pre-signal. Check for any
          // prior listing for this product (per-product, any user). If
          // none, it's a new listing; if one exists, it's an edit.
          const priorListing = await ExtensionEvent.findOne({
            event_type: 'listing_created',
            product_id: effectiveProductId
          });
          if (priorListing) {
            effectiveEventType = 'product_updated';
            console.log('[EXT] listing_created PUT: prior listing exists, downgrading to product_updated', { product_id: effectiveProductId, prior_id: priorListing._id });
          } else {
            console.log('[EXT] listing_created PUT: no prior listing, keeping as listing_created (NEW listing)', { product_id: effectiveProductId });
          }
        }
      }
    }

    // === SPEC_ADDED → LISTING_CREATED reclassification (per-product) ===
    // v1.0.4 and older extensions misclassify a PUT that adds BOTH
    // packageType and spec values in one request as 'spec_added' instead
    // of 'listing_created'. Per-product check (any user): if no prior
    // listing for this product_id exists within 24h, this is actually a
    // new listing (State 1 → State 3 transition).
    if (effectiveEventType === 'spec_added' && effectiveProductId && metadata?.method === 'PUT') {
      // Only reclassify spec_added → listing_created when the product is
      // GENUINELY not listed on the server (response has_package_type is
      // false/undefined). If the response has has_package_type: true, the
      // product is already listed — this is a spec add on an existing
      // listing, NOT a new listing. (A product can be listed on the
      // server with no prior listing_created event in BD tracker if it
      // was listed before the tracker or by a different system.)
      if (metadata?.has_package_type === true) {
        console.log('[EXT] reclassify check: response has packageType, product is listed, keeping spec_added', { product_id: effectiveProductId });
      } else {
        const priorListing = await ExtensionEvent.findOne({
          product_id: effectiveProductId,
          event_type: { $in: ['listing_created', 'product_created'] },
          created_at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });
        if (!priorListing) {
          effectiveEventType = 'listing_created';
          console.log('[EXT] reclassify spec_added → listing_created (no prior listing AND response has no packageType)', { product_id: effectiveProductId, user_id: req.user._id });
        } else {
          console.log('[EXT] reclassify check: prior listing exists, keeping spec_added', { product_id: effectiveProductId, prior_id: priorListing._id, prior_type: priorListing.event_type });
        }
      }
    }

    // === 1-HOUR SPEC_ADDED SUPPRESSION (per-user, per-product) ===
    // When the same user lists a product and adds specs within 1h, the
    // spec add is part of the same workflow as the listing. The clock
    // starts at the listing_created (including reclassified ones from
    // the block above). Cross-user, cross-browser safety net for the
    // extension's localStorage-based 1h suppression.
    if (effectiveEventType === 'spec_added' && effectiveProductId) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentListing = await ExtensionEvent.findOne({
        product_id: effectiveProductId,
        user_id: req.user._id,
        event_type: 'listing_created',
        created_at: { $gte: oneHourAgo }
      });
      if (recentListing) {
        console.log('[EXT] SUPPRESSED spec_added (1h rule)', { product_id: effectiveProductId, user_id: req.user._id, listing_id: recentListing._id, minutes_since_listing: Math.floor((Date.now() - recentListing.created_at.getTime()) / 60000) });
        return res.status(200).json({
          status: 'success',
          data: {
            suppressed: true,
            reason: 'spec_added within 1h of listing_created',
            product_id: effectiveProductId,
            listing_event_id: recentListing._id,
            minutes_since_listing: Math.floor((Date.now() - recentListing.created_at.getTime()) / 60000)
          }
        });
      }
    }

    // Deduplicate: only the first qc_pending of the day is stored.
    // Next day resets — the new first count replaces the old.
    if (event_type === 'qc_pending') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const existing = await ExtensionEvent.findOne({
        event_type: 'qc_pending',
        created_at: { $gte: todayStart }
      });
      if (existing) {
        return res.status(200).json({
          status: 'success',
          data: {
            event_id: existing._id,
            event_type: 'qc_pending',
            pending_count: existing.pending_count,
            duplicate: true,
            message: 'First pending count of the day already recorded'
          }
        });
      }
    }

    // Deduplicate spec_added: one per product_id per user per day
    if (effectiveEventType === 'spec_added' && effectiveProductId) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const existingSpec = await ExtensionEvent.findOne({
        event_type: 'spec_added',
        product_id: effectiveProductId,
        user_id: req.user._id,
        created_at: { $gte: todayStart }
      });
      if (existingSpec) {
        return res.status(200).json({
          status: 'success',
          data: {
            event_id: existingSpec._id,
            event_type: 'spec_added',
            product_id: effectiveProductId,
            duplicate: true,
            message: 'Spec already recorded for this product today'
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
      bulk_count: bulk_count || null,
      user_id: req.user._id,
      lead_id: lead_id || undefined,
      workflow_state: workflow_state || metadata?.workflow_state || null,
      session_duration: session_duration || metadata?.session_duration || null,
      metadata: metadata || {}
    });

    console.log('[EXT] logActivity → INSERTED', { _id: extensionEvent._id, event_type: effectiveEventType, product_id: effectiveProductId });

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

// DELETE /extension/events/user/:userId — Delete all events for a specific user
exports.deleteUserEvents = async (req, res) => {
  try {
    const { userId } = req.params;
    const { event_type } = req.query;

    if (!userId) {
      return res.status(400).json({ status: 'fail', message: 'userId is required' });
    }

    const filter = { user_id: userId };
    if (event_type) {
      filter.event_type = event_type;
    }

    const result = await ExtensionEvent.deleteMany(filter);
    res.status(200).json({
      status: 'success',
      message: event_type
        ? `Deleted ${result.deletedCount} ${event_type} event(s) for user`
        : `Deleted ${result.deletedCount} event(s) for user`
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// DELETE /extension/events/:eventId — Delete a single event
exports.deleteEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const result = await ExtensionEvent.findByIdAndDelete(eventId);
    if (!result) {
      return res.status(404).json({ status: 'fail', message: 'Event not found' });
    }
    res.status(200).json({
      status: 'success',
      message: 'Event deleted'
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// PATCH /extension/events/:eventId — update event_type (admin only)
exports.patchEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { event_type } = req.body;
    const validEvents = ['listing_created', 'product_created', 'product_updated', 'product_viewed', 'qc_approved', 'qc_rejected', 'qc_pending', 'spec_added', 'session_ended'];
    if (!event_type || !validEvents.includes(event_type)) {
      return res.status(400).json({ status: 'fail', message: `event_type must be one of: ${validEvents.join(', ')}` });
    }
    const result = await ExtensionEvent.findByIdAndUpdate(eventId, { event_type }, { new: true });
    if (!result) {
      return res.status(404).json({ status: 'fail', message: 'Event not found' });
    }
    res.status(200).json({ status: 'success', data: result });
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

    const matchFilter = { created_at: { $gte: startDate, $lte: endDate }, product_id: { $ne: 'b' } };
    const isAdmin = req.userPermissions?.includes('extension.admin');

    // Non-admin users can only see their own data
    if (!isAdmin) {
      matchFilter.user_id = req.user._id;
    } else if (user_id && mongoose.Types.ObjectId.isValid(user_id)) {
      matchFilter.user_id = new mongoose.Types.ObjectId(user_id);
    }

    // Lead model for vendor name lookups
    const Lead = require('../models/Lead');

    // ── Single $facet aggregation — 1 collection scan instead of 8 ──
    const BULK_SUM = { $ifNull: ['$bulk_count', 1] };
    const [facetResult] = await ExtensionEvent.aggregate([
      { $match: matchFilter },
      { $facet: {
        eventsByType: [
          { $group: { _id: '$event_type', count: { $sum: BULK_SUM } } }
        ],
        dailyEvents: [
          { $group: { _id: { date: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } }, event_type: '$event_type' }, count: { $sum: BULK_SUM } } },
          { $sort: { '_id.date': 1 } }
        ],
        topProducts: [
          { $match: { product_name: { $ne: null } } },
          { $group: { _id: '$product_name', total: { $sum: BULK_SUM }, listings: { $sum: { $cond: [{ $eq: ['$event_type', 'listing_created'] }, 1, 0] } }, specs: { $sum: { $cond: [{ $eq: ['$event_type', 'spec_added'] }, 1, 0] } }, updates: { $sum: { $cond: [{ $eq: ['$event_type', 'product_updated'] }, 1, 0] } }, qc_approved: { $sum: { $cond: [{ $eq: ['$event_type', 'qc_approved'] }, BULK_SUM, 0] } }, qc_rejected: { $sum: { $cond: [{ $eq: ['$event_type', 'qc_rejected'] }, BULK_SUM, 0] } } } },
          { $sort: { total: -1 } },
          { $limit: 10 }
        ],
        topVendorsRaw: [
          { $match: { vendor_id: { $ne: null } } },
          { $group: { _id: '$vendor_id', total: { $sum: BULK_SUM }, listings: { $sum: { $cond: [{ $eq: ['$event_type', 'listing_created'] }, 1, 0] } }, qc_approved: { $sum: { $cond: [{ $eq: ['$event_type', 'qc_approved'] }, BULK_SUM, 0] } }, qc_rejected: { $sum: { $cond: [{ $eq: ['$event_type', 'qc_rejected'] }, BULK_SUM, 0] } }, products: { $addToSet: '$product_name' } } },
          { $addFields: { product_count: { $size: '$products' } } },
          { $sort: { total: -1 } },
          { $limit: 10 }
        ],
        hourlyActivity: [
          { $group: { _id: { hour: { $hour: '$created_at' }, dow: { $dayOfWeek: '$created_at' } }, count: { $sum: BULK_SUM } } },
          { $sort: { '_id.dow': 1, '_id.hour': 1 } }
        ],
        eventsByUser: [
          { $group: { _id: { user_id: '$user_id', event_type: '$event_type' }, count: { $sum: BULK_SUM } } },
          { $lookup: { from: 'users', localField: '_id.user_id', foreignField: '_id', as: 'user' } },
          { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
          { $group: { _id: '$_id.user_id', user_name: { $first: '$user.name' }, user_team: { $first: '$user.team' }, events: { $push: { event_type: '$_id.event_type', count: '$count' } }, total: { $sum: '$count' } } },
          { $sort: { total: -1 } }
        ],
        recentEvents: [
          { $sort: { created_at: -1 } },
          { $limit: 20 },
          { $lookup: { from: 'users', localField: 'user_id', foreignField: '_id', as: 'user' } },
          { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
          { $project: { event_type: 1, product_id: 1, product_name: 1, vendor_id: 1, qc_status: 1, pending_count: 1, created_at: 1, user_id: { _id: '$user._id', name: '$user.name', team: '$user.team' } } }
        ],
        latestPending: [
          { $match: { event_type: 'qc_pending', pending_count: { $ne: null } } },
          { $sort: { created_at: -1 } },
          { $limit: 1 },
          { $project: { _id: 0, pending_count: 1 } }
        ],
        userSessions: [
          { $sort: { user_id: 1, created_at: 1 } },
          { $group: { _id: '$user_id', events: { $push: { type: '$event_type', time: '$created_at' } } } },
          { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
          { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } }
        ]
      } }
    ]);

    const eventsByType = facetResult.eventsByType || [];
    const dailyEvents = facetResult.dailyEvents || [];
    const topProducts = facetResult.topProducts || [];
    const topVendorsRaw = facetResult.topVendorsRaw || [];
    const hourlyActivity = facetResult.hourlyActivity || [];
    const eventsByUser = facetResult.eventsByUser || [];
    const recentEvents = facetResult.recentEvents || [];
    const latestPendingCount = (facetResult.latestPending || [])[0]?.pending_count ?? null;
    const userSessions = facetResult.userSessions || [];

    const dailyPendingCounts = []; // Folded into latestPendingCount

    // Derive qcStats (approved/rejected) from eventsByType — bulk/individual
    // breakdown is in the summary's metadata but the frontend only needs the
    // totals for the approval-rate widget.
    const findCount = (id) => (eventsByType.find(x => x._id === id) || {}).count || 0;
    const qcStats = {
      approved: findCount('qc_approved'),
      rejected: findCount('qc_rejected'),
      bulk_approved: 0, bulk_rejected: 0,
      individual_approved: 0, individual_rejected: 0
    };

    // Lookup vendor names from Leads (depends on topVendorsRaw)
    const vendorIds = topVendorsRaw.map(v => v._id).filter(Boolean);
    const vendorLeads = vendorIds.length > 0
      ? await Lead.find({ nepalcanId: { $in: vendorIds } }).select('nepalcanId business_name').lean()
      : [];
    const vendorNameMap = {};
    for (const lead of vendorLeads) {
      vendorNameMap[lead.nepalcanId] = lead.business_name;
    }
    const topVendors = topVendorsRaw.map(v => ({
      ...v,
      vendor_name: vendorNameMap[v._id] || v._id
    }));

    // Process user sessions in-memory
    const SESSION_GAP_MS = 60 * 60 * 1000; // 1 hour
    const userSessionsResult = userSessions.map(u => {
      const sessions = [];
      let currentSession = null;
      for (const ev of u.events) {
        if (!currentSession || (ev.time - currentSession.end) > SESSION_GAP_MS) {
          if (currentSession) sessions.push(currentSession);
          currentSession = { start: ev.time, end: ev.time, event_count: 1 };
        } else {
          currentSession.end = ev.time;
          currentSession.event_count++;
        }
      }
      if (currentSession) sessions.push(currentSession);
      const activeHours = sessions.reduce((sum, s) => sum + (s.end - s.start) / 3600000, 0);
      return {
        user_id: u._id,
        user_name: u.user?.name || 'Unknown',
        user_team: u.user?.team || '',
        sessions: sessions.length,
        total_events: u.events.length,
        active_hours: Math.round(activeHours * 10) / 10,
        session_details: sessions.map(s => ({
          start: s.start,
          end: s.end,
          duration_min: Math.round((s.end - s.start) / 60000),
          event_count: s.event_count
        }))
      };
    }).sort((a, b) => b.total_events - a.total_events);

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

    // Best/Worst days — compute from dailyComparison
    const bestWorst = {};
    const metricKeys = ['listed', 'specs', 'updated', 'approved', 'rejected'];
    for (const key of metricKeys) {
      const validDays = dailyComparison.filter(d => (d[key] || 0) > 0);
      if (validDays.length > 0) {
        const sorted = [...validDays].sort((a, b) => (b[key] || 0) - (a[key] || 0));
        bestWorst[key] = { best: sorted[0], worst: sorted[sorted.length - 1] };
      } else {
        bestWorst[key] = { best: null, worst: null };
      }
    }

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
        qcStats: qcStats[0] || { approved: 0, rejected: 0, bulk_approved: 0, bulk_rejected: 0, individual_approved: 0, individual_rejected: 0 },
        topProducts,
        topVendors,
        bestWorst,
        hourlyActivity: hourlyActivity.map(h => ({ hour: h._id.hour, dow: h._id.dow, count: h.count })),
        userSessions: userSessionsResult,
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

// GET /extension/analytics/details — event details for a given type
exports.getAnalyticsDetails = async (req, res) => {
  try {
    const { event_type, period = '7d', start_date, end_date } = req.query;
    if (!event_type) return res.status(400).json({ status: 'error', message: 'event_type required' });

    let startDate, endDate;
    if (start_date) {
      startDate = new Date(start_date + 'T00:00:00.000Z');
      endDate = end_date ? new Date(end_date + 'T23:59:59.999Z') : new Date();
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

    const { user_id } = req.query;
    const matchFilter = { event_type, created_at: { $gte: startDate, $lte: endDate }, product_id: { $ne: 'b' } };
    const isAdmin = req.userPermissions?.includes('extension.admin');
    if (!isAdmin) {
      matchFilter.user_id = req.user._id;
    } else if (user_id && mongoose.Types.ObjectId.isValid(user_id)) {
      matchFilter.user_id = new mongoose.Types.ObjectId(user_id);
    }

    const events = await ExtensionEvent.find(matchFilter)
      .select('product_name product_id created_at vendor_id qc_status metadata')
      .sort({ created_at: -1 })
      .limit(200)
      .lean();

    // For events without product_name, try to look it up from other events on the same product_id
    const missingNames = events.filter(e => !e.product_name && e.product_id);
    if (missingNames.length > 0) {
      const productIds = [...new Set(missingNames.map(e => e.product_id.toString()))].filter(id => mongoose.Types.ObjectId.isValid(id));
      const nameLookup = productIds.length > 0 ? await ExtensionEvent.aggregate([
        { $match: { product_id: { $in: productIds.map(id => new mongoose.Types.ObjectId(id)) }, product_name: { $ne: null } } },
        { $group: { _id: '$product_id', name: { $first: '$product_name' } } }
      ]) : [];
      const nameMap = {};
      for (const item of nameLookup) nameMap[item._id.toString()] = item.name;
      for (const ev of events) {
        if (!ev.product_name && ev.product_id) ev.product_name = nameMap[ev.product_id.toString()] || null;
      }
    }

    res.status(200).json({ status: 'success', data: { events, count: events.length } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// GET /extension/my-stats — lightweight endpoint for extension popup
// Returns user's own today stats + team leaderboard
exports.getMyStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;
    const userTeam = req.user.team;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const now = new Date();

    // Get user's own event counts
    const myEvents = await ExtensionEvent.aggregate([
      { $match: { user_id: userId, created_at: { $gte: todayStart, $lte: now } } },
      { $group: { _id: '$event_type', count: { $sum: { $ifNull: ['$bulk_count', 1] } } } }
    ]);

    const myStats = { listing_created: 0, product_created: 0, product_updated: 0, qc_approved: 0, qc_rejected: 0, spec_added: 0, session_ended: 0 };
    for (const item of myEvents) {
      if (myStats.hasOwnProperty(item._id)) myStats[item._id] = item.count;
    }

    // Build team leaderboard
    // listing team sees listing users; qc team sees qc users; admin/super_admin see all
    let teamFilter = {};
    if (userRole === 'super_admin' || userRole === 'admin') {
      teamFilter = { team: { $in: ['listing', 'qc'] } };
    } else if (userTeam === 'listing') {
      teamFilter = { team: 'listing' };
    } else if (userTeam === 'qc') {
      teamFilter = { team: 'qc' };
    } else {
      // Other roles only see their own stats
      teamFilter = { _id: userId };
    }

    const teamUsers = await User.find(teamFilter).select('name team').lean();
    const teamUserIds = teamUsers.map(u => u._id);

    // Get all team events for today
    const teamEvents = await ExtensionEvent.aggregate([
      { $match: { user_id: { $in: teamUserIds }, created_at: { $gte: todayStart, $lte: now } } },
      { $group: { _id: { user_id: '$user_id', event_type: '$event_type' }, count: { $sum: { $ifNull: ['$bulk_count', 1] } } } }
    ]);

    // Build leaderboard
    const userMap = {};
    for (const u of teamUsers) {
      userMap[u._id.toString()] = { user_id: u._id, name: u.name, team: u.team, listing_created: 0, product_created: 0, product_updated: 0, qc_approved: 0, qc_rejected: 0, spec_added: 0, total: 0 };
    }

    for (const item of teamEvents) {
      const uid = item._id.user_id.toString();
      const eventType = item._id.event_type;
      if (userMap[uid] && userMap[uid].hasOwnProperty(eventType)) {
        userMap[uid][eventType] = item.count;
        userMap[uid].total += item.count;
      }
    }

    const leaderboard = Object.values(userMap).sort((a, b) => b.total - a.total);

    // Fetch goals — single query with $or covers all cases
    const OperationalGoal = require('../models/OperationalGoal');
    const goalQuery = userTeam && ['listing', 'qc'].includes(userTeam)
      ? { team: userTeam, $or: [{ user_id: null }, { user_id: userId }] }
      : { $or: [{ user_id: userId }, { user_id: null }] };
    const goals = await OperationalGoal.find(goalQuery).lean();

    const teamGoal = goals.find(g => !g.user_id);
    const userGoal = goals.find(g => g.user_id && g.user_id.toString() === userId.toString());
    const effective = userGoal || teamGoal;

    console.log('[my-stats] userTeam:', userTeam, 'goals found:', goals.length, 'effective:', effective ? { listing_target: effective.listing_target, spec_target: effective.spec_target, qc_target: effective.qc_target } : null);

    // Show goals if a goal document exists (team default or per-user override)
    const goalsData = effective ? {
      listing_target: effective.listing_target || 0,
      spec_target: effective.spec_target || 0,
      qc_target: effective.qc_enabled ? (effective.qc_target || 0) : 0,
      qc_enabled: effective.qc_enabled || false,
      listing_actual: myStats.listing_created || 0,
      spec_actual: myStats.spec_added || 0,
      qc_actual: effective.qc_enabled ? ((myStats.qc_approved || 0) + (myStats.qc_rejected || 0)) : 0
    } : null;

    res.status(200).json({
      status: 'success',
      data: {
        my: { ...myStats, total: Object.values(myStats).reduce((a, b) => a + b, 0) },
        team: leaderboard,
        user: { name: req.user.name, team: userTeam, role: userRole },
        goals: goalsData
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// GET /extension/team-performance — Listing & QC team gamification analytics
exports.getTeamPerformance = async (req, res) => {
  try {
    const userRole = req.user.role;
    const userTeam = req.user.team;
    const isAdmin = userRole === 'super_admin' || userRole === 'admin' || req.userPermissions?.includes('extension.admin');

    // Determine which teams to show
    let teamsToShow = [];
    if (isAdmin) {
      const teamParam = req.query.team;
      teamsToShow = teamParam === 'listing' ? ['listing'] : teamParam === 'qc' ? ['qc'] : ['listing', 'qc'];
    } else if (userTeam === 'listing') {
      teamsToShow = ['listing'];
    } else if (userTeam === 'qc') {
      teamsToShow = ['qc'];
    } else {
      return res.status(200).json({ status: 'success', data: { listing: null, qc: null } });
    }

    const OperationalGoal = require('../models/OperationalGoal');
    const goalDocs = await OperationalGoal.find({ team: { $in: teamsToShow } }).lean();
    // Build per-user target map: { team: { userId: { listing, spec, qc, qc_enabled }, null: teamDefault } }
    const teamDefaults = {};
    const userTargetMap = {};
    for (const g of goalDocs) {
      if (!g.user_id) {
        teamDefaults[g.team] = g;
      } else {
        const uid = g.user_id.toString();
        if (!userTargetMap[g.team]) userTargetMap[g.team] = {};
        userTargetMap[g.team][uid] = g;
      }
    }

    const LISTING_EVENTS = ['listing_created'];
    const SPEC_EVENTS = ['spec_added'];
    const QC_EVENTS = ['qc_approved', 'qc_rejected'];

    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000); thirtyDaysAgo.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000); sevenDaysAgo.setHours(0, 0, 0, 0);
    const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000); fourteenDaysAgo.setHours(0, 0, 0, 0);

    const result = {};

    // Parallelize per-team queries
    const teamDataPromises = teamsToShow.map(async (team) => {
      const eventTypes = team === 'listing' ? [...LISTING_EVENTS, ...SPEC_EVENTS] : QC_EVENTS;
      const teamDefault = teamDefaults[team];

      const teamUsers = await User.find({ team }).select('name team').lean();
      if (teamUsers.length === 0) {
        return { team, data: { team_default: teamDefault || null, leaderboard: [], team_today_avg: 0, team_today_total: 0, team_week_total: 0 } };
      }
      const teamUserIds = teamUsers.map(u => u._id);

      const dailyEvents = await ExtensionEvent.aggregate([
        { $match: { user_id: { $in: teamUserIds }, event_type: { $in: eventTypes }, created_at: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { user_id: '$user_id', date: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } } },
            count: { $sum: { $ifNull: ['$bulk_count', 1] } }
          }
        },
        { $sort: { '_id.date': 1 } }
      ]);

      return { team, data: { teamDefault, teamUsers, dailyEvents, eventTypes } };
    });

    const teamDataResults = await Promise.all(teamDataPromises);

    for (const { team, data } of teamDataResults) {
      if (!data.teamUsers) {
        result[team] = data;
        continue;
      }

      const { teamDefault, teamUsers, dailyEvents, eventTypes } = data;
      const teamUserIds = teamUsers.map(u => u._id);
      const userMap = {};
      for (const u of teamUsers) {
        userMap[u._id.toString()] = { user_id: u._id, name: u.name, team: u.team };
      }

      // Build per-user daily counts
      const userDaily = {};
      for (const u of teamUsers) {
        userDaily[u._id.toString()] = {};
      }
      for (const ev of dailyEvents) {
        const uid = ev._id.user_id.toString();
        if (userDaily[uid]) {
          userDaily[uid][ev._id.date] = ev.count;
        }
      }

      // Generate date strings for last 30 days
      const dateStr = (d) => d.toISOString().slice(0, 10);
      const todayStr = dateStr(now);
      const yesterdayStr = dateStr(new Date(now - 86400000));

      // Compute per-user stats
      const leaderboard = [];
      for (const u of teamUsers) {
        const uid = u._id.toString();
        const daily = userDaily[uid];
        const userGoal = userTargetMap[team]?.[uid] || teamDefault;
        const userTarget = team === 'listing'
          ? (userGoal?.listing_target || 0) + (userGoal?.spec_target || 0)
          : (userGoal?.qc_target || 0);
        const userQcEnabled = userGoal?.qc_enabled || false;

        // Today count
        const todayCount = daily[todayStr] || 0;

        // Streak: consecutive days meeting target (from today backward)
        let streak = 0;
        let longestStreak = 0;
        const streakDate = new Date(now);
        for (let i = 0; i < 30; i++) {
          const ds = dateStr(streakDate);
          if (userTarget > 0 && (daily[ds] || 0) >= userTarget) {
            streak++;
          } else if (userTarget > 0) {
            break;
          }
          streakDate.setDate(streakDate.getDate() - 1);
        }
        longestStreak = streak;

        // Weekly totals (this week vs last week)
        let thisWeekTotal = 0;
        let lastWeekTotal = 0;
        for (let i = 0; i < 7; i++) {
          const d = new Date(now - i * 86400000);
          thisWeekTotal += daily[dateStr(d)] || 0;
        }
        for (let i = 7; i < 14; i++) {
          const d = new Date(now - i * 86400000);
          lastWeekTotal += daily[dateStr(d)] || 0;
        }
        const weeklyChangePct = lastWeekTotal > 0 ? Math.round(((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100) : (thisWeekTotal > 0 ? 100 : 0);

        // 7-day daily counts for sparkline
        const dailyCounts = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now - i * 86400000);
          dailyCounts.push(daily[dateStr(d)] || 0);
        }

        leaderboard.push({
          user_id: u._id,
          name: u.name,
          today_count: todayCount,
          target: userTarget,
          target_pct: userTarget > 0 ? Math.round((todayCount / userTarget) * 100) : 0,
          met_today: userTarget > 0 && todayCount >= userTarget,
          qc_enabled: userQcEnabled,
          streak,
          longest_streak: longestStreak,
          weekly_total: thisWeekTotal,
          weekly_change_pct: weeklyChangePct,
          daily_counts: dailyCounts,
          // Rank computed below
          rank: 0,
          rank_change: 0
        });
      }

      // Sort by today_count for today's rank
      const todayRanked = [...leaderboard].sort((a, b) => b.today_count - a.today_count);
      todayRanked.forEach((u, i) => { u.rank = i + 1; });

      // Compute yesterday's rank for rank_change
      const yesterdayRanked = [...leaderboard].sort((a, b) => {
        const aYesterday = userDaily[a.user_id.toString()]?.[yesterdayStr] || 0;
        const bYesterday = userDaily[b.user_id.toString()]?.[yesterdayStr] || 0;
        return bYesterday - aYesterday;
      });
      const yesterdayRankMap = {};
      yesterdayRanked.forEach((u, i) => { yesterdayRankMap[u.user_id.toString()] = i + 1; });
      for (const u of leaderboard) {
        const yRank = yesterdayRankMap[u.user_id.toString()] || leaderboard.length;
        u.rank_change = yRank - u.rank; // positive = improved
      }

      // Sort final leaderboard by rank
      leaderboard.sort((a, b) => a.rank - b.rank);

      // Team aggregates
      const teamTodayTotal = leaderboard.reduce((s, u) => s + u.today_count, 0);
      const teamTodayAvg = Math.round(teamTodayTotal / leaderboard.length);
      const teamWeekTotal = leaderboard.reduce((s, u) => s + u.weekly_total, 0);

      result[team] = {
        team_default: teamDefault || null,
        leaderboard,
        team_today_avg: teamTodayAvg,
        team_today_total: teamTodayTotal,
        team_week_total: teamWeekTotal
      };
    }

    res.status(200).json({ status: 'success', data: result });
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

// ==================== OPERATIONAL GOALS ====================

// GET /extension/operational-goals — Get goals for a team
exports.getOperationalGoals = async (req, res) => {
  try {
    const OperationalGoal = require('../models/OperationalGoal');
    const userRole = req.user.role;
    const userTeam = req.user.team;
    const userId = req.user._id;
    const isAdmin = userRole === 'super_admin' || userRole === 'admin' || req.userPermissions?.includes('extension.admin');

    let team = req.query.team;
    if (!isAdmin) {
      team = userTeam;
    }
    if (!team || !['listing', 'qc'].includes(team)) {
      return res.status(400).json({ status: 'fail', message: 'Valid team (listing or qc) is required' });
    }

    if (isAdmin) {
      const goals = await OperationalGoal.find({ team })
        .populate('user_id', 'name team')
        .populate('updated_by', 'name')
        .lean();
      const teamDefault = goals.find(g => !g.user_id) || null;
      const userOverrides = goals.filter(g => g.user_id);
      return res.status(200).json({ status: 'success', data: { team_default: teamDefault, user_overrides: userOverrides } });
    } else {
      const goals = await OperationalGoal.find({
        team,
        $or: [{ user_id: null }, { user_id: userId }]
      }).lean();
      const teamDefault = goals.find(g => !g.user_id) || null;
      const userOverride = goals.find(g => g.user_id && g.user_id.toString() === userId.toString()) || null;
      return res.status(200).json({ status: 'success', data: { team_default: teamDefault, user_override: userOverride } });
    }
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// PUT /extension/operational-goals — Create/update a goal
exports.updateOperationalGoal = async (req, res) => {
  try {
    const OperationalGoal = require('../models/OperationalGoal');
    const { team, user_id, listing_target, spec_target, qc_target, qc_enabled } = req.body;

    if (!team || !['listing', 'qc'].includes(team)) {
      return res.status(400).json({ status: 'fail', message: 'Valid team is required' });
    }

    const query = { team, user_id: user_id || null };
    const update = {
      listing_target: listing_target || 0,
      spec_target: spec_target || 0,
      qc_target: qc_target || 0, qc_enabled: qc_enabled || false,
      updated_by: req.user._id,
      updated_at: new Date()
    };

    const goal = await OperationalGoal.findOneAndUpdate(query, update, { new: true, upsert: true, runValidators: true });
    res.status(200).json({ status: 'success', data: goal });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// DELETE /extension/operational-goals/:id — Delete a per-user override
exports.deleteOperationalGoal = async (req, res) => {
  try {
    const OperationalGoal = require('../models/OperationalGoal');
    const goal = await OperationalGoal.findById(req.params.id);

    if (!goal) {
      return res.status(404).json({ status: 'fail', message: 'Goal not found' });
    }
    if (!goal.user_id) {
      return res.status(400).json({ status: 'fail', message: 'Cannot delete team-wide default' });
    }

    await OperationalGoal.findByIdAndDelete(req.params.id);
    res.status(200).json({ status: 'success', message: 'Goal override deleted' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};
