const crypto = require('crypto');
const SyncJob = require('../models/SyncJob');
const { loginToNepalcan } = require('../services/nepalcanAuthService');
const {
  processOrdersPage, processTrackingBatch, processVendorsPage, processBranchesBatch
} = require('../services/syncBatchService');

const STALE_AFTER = parseInt(process.env.SYNC_STALE_AFTER) || 300;
const LEASE_DURATION = parseInt(process.env.SYNC_LEASE_DURATION) || 240;
const MAX_RETRIES = parseInt(process.env.SYNC_MAX_RETRIES) || 3;

const PHASES = ['orders', 'tracking', 'vendors', 'branches'];
const SYNC_TYPES = ['full', 'nepalcan_orders', 'tracking', 'nepalcan_vendors', 'branches'];
const phaseFor = (syncType, payloadPhase) =>
  syncType === 'full' ? (payloadPhase || 'orders') : (
    { nepalcan_orders: 'orders', tracking: 'tracking', nepalcan_vendors: 'vendors', branches: 'branches' }[syncType] || 'orders'
  );

// ponytail: constant-time key check, no user auth on worker
const workerKeyOk = (req) => {
  const expected = process.env.SYNC_WORKER_KEY;
  if (!expected) return false; // key required in prod
  const given = String(req.query.key || req.headers['x-sync-key'] || '');
  const a = Buffer.from(given), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const isStale = (job, now) =>
  !job.lease_until || new Date(job.lease_until) < now ||
  (job.last_heartbeat_at && (now - new Date(job.last_heartbeat_at)) / 1000 > STALE_AFTER);

const claimJob = async (workerId, now) => {
  const staleAt = new Date(now.getTime() - STALE_AFTER * 1000);
  return SyncJob.findOneAndUpdate(
    {
      status: { $in: ['pending', 'running', 'paused'] },
      $or: [
        { lease_until: null }, { lease_until: { $exists: false } },
        { lease_until: { $lt: now } },
        { last_heartbeat_at: null }, { last_heartbeat_at: { $lt: staleAt } }
      ]
    },
    {
      $set: { status: 'running', worker_id: workerId, lease_until: new Date(now.getTime() + LEASE_DURATION * 1000), last_heartbeat_at: now, batch_started_at: now },
    },
    { new: true, sort: { updatedAt: 1 } }
  );
};

// ponytail: per-phase totals so progress climbs monotonically across phases, capped 0-100
const calcProgress = (job, done) => {
  const totals = job.payload?.totals || {};
  const known = Object.values(totals).reduce((s, v) => s + (Number(v) || 0), 0);
  const denom = Math.max(known, job.total || 0, job.processed || 0);
  if (denom <= 0) return done ? 100 : 0;
  return Math.min(100, Math.round(((job.processed || 0) / denom) * 100));
};

const jobShape = (job, done) => ({
  success: true, jobId: job._id, status: job.status, phase: job.payload?.phase,
  total: job.total, processed: job.processed, successful: job.successful,
  failed: job.failed, progress: calcProgress(job, done), done: !!done,
  totals: job.payload?.totals || {}
});

// Core: run exactly ONE batch on an already-claimed job. Shared by process + kick.
const doBatch = async (job, workerId) => {
  const started = Date.now();
  const now = new Date();
  if (!job.started_at) { job.started_at = job.started_at || now; job.startedAt = job.startedAt || now; }
  const phase = phaseFor(job.sync_type, job.payload?.phase);
  console.log(`[SYNC] ${phase} batch started job=${job._id} page=${job.current_page}`);

  let token = null;
  try { token = await loginToNepalcan(); } catch (e) {
    console.error(`[SYNC] login failed: ${e.message}`);
  }

  let r;
  if (phase === 'orders') r = await processOrdersPage(job, token);
  else if (phase === 'tracking') r = await processTrackingBatch(job);
  else if (phase === 'vendors') r = await processVendorsPage(job, token, null);
  else r = await processBranchesBatch(job, token);

  const elapsedMs = Date.now() - started;
  const processed = (job.processed || 0) + (r.count || 0);
  const successful = (job.successful || 0) + (r.successful || 0);
  const failed = (job.failed || 0) + (r.failed || 0);
  // ponytail: denominator never shrinks; per-phase totals accumulate
  const totals = { ...(job.payload?.totals || {}) };
  if (r.totalApi) totals[phase] = Math.max(totals[phase] || 0, r.totalApi);
  const knownSum = Object.values(totals).reduce((s, v) => s + (Number(v) || 0), 0);
  const total = Math.max(job.total || 0, knownSum, processed);
  const update = {
    processed, successful, failed, total,
    'payload.totals': totals,
    last_heartbeat_at: new Date(),
    lastProcessedAt: new Date(),
    lease_until: null, // ponytail: release immediately so next tick claims instantly
    worker_id: null,
    batch_errors: job.batch_errors || [],
    avg_batch_ms: job.avg_batch_ms ? Math.round((job.avg_batch_ms + elapsedMs) / 2) : elapsedMs,
    error_message: null, error: null
  };

  let nextPhase = phase, jobDone = false;
  if (r.done) {
    if (job.sync_type === 'full') {
      const i = PHASES.indexOf(phase);
      if (i < PHASES.length - 1) {
        nextPhase = PHASES[i + 1];
        update['payload.phase'] = nextPhase;
        update.current_page = 1; update.last_processed_id = null; update.cursor = null;
        console.log(`[SYNC] phase ${phase} complete → ${nextPhase} job=${job._id}`);
      } else { jobDone = true; }
    } else { jobDone = true; }
    if (phase === 'orders' && !jobDone) update.current_page = (job.current_page || 1) + 1;
    if (phase === 'vendors' && !jobDone) update.current_page = (job.current_page || 1) + 1;
    if ((phase === 'tracking' || phase === 'branches') && !jobDone) update.last_processed_id = job.last_processed_id;
  } else {
    if (phase === 'orders' || phase === 'vendors') update.current_page = (job.current_page || 1) + 1;
    else update.last_processed_id = job.last_processed_id;
    if (job.sync_type === 'full') update['payload.phase'] = phase;
  }
  if (r.totalApi && job.sync_type === 'full') update['payload.totalApi'] = r.totalApi;
  if (jobDone) {
    update.status = 'completed';
    update.completed_at = new Date(); update.completedAt = new Date();
    console.log(`[SYNC] Job ${job._id} completed processed=${processed}`);
  }
  const saved = await SyncJob.findByIdAndUpdate(job._id, { $set: update }, { new: true }).lean();
  console.log(`[SYNC] checkpoint saved job=${job._id} phase=${nextPhase} processed=${processed}/${saved.total} +${r.count} (${elapsedMs}ms)`);
  if (jobDone) {
    // ponytail: keep legacy sales history working — one log row per completed job
    try {
      const NepalcanSyncLog = require('../models/NepalcanSyncLog');
      const logType = job.sync_type === 'nepalcan_vendors' ? 'vendors' : job.sync_type === 'full' ? 'full' : 'orders';
      await NepalcanSyncLog.create({
        type: logType, success: true, ordersSynced: saved.successful || 0,
        totalProcessed: saved.processed || 0, durationMs: Date.now() - new Date(saved.started_at || saved.createdAt).getTime()
      });
    } catch (e) { console.error('[SYNC] history log failed:', e.message); }
  }
  return { saved, nextPhase, jobDone };
};

/**
 * Shared: ensure an active job of syncType exists, claim it, run ONE batch.
 * Used by kick endpoint and the sales Refresh button. Returns shape + done flag.
 */
exports.ensureAndRunOneBatch = async (syncType = 'full') => {
  let active = await SyncJob.findOne({ status: { $in: ['pending', 'running', 'paused'] }, sync_type: syncType }).sort({ updatedAt: -1 });
  if (!active) {
    const now = new Date();
    active = await SyncJob.create({
      sync_type: syncType, status: 'pending', total: 0, processed: 0, successful: 0, failed: 0, skipped: 0,
      batchSize: parseInt(process.env.SYNC_BATCH_SIZE) || 50,
      current_page: 1, last_processed_id: null, cursor: null,
      payload: { phase: phaseFor(syncType, null), pages: {}, totals: {}, totalApi: null },
      started_at: now, startedAt: now, last_heartbeat_at: now, lastProcessedAt: now,
      retry_count: 0
    });
    console.log(`[SYNC] ensure created job ${active._id} type=${syncType}`);
  }
  const now = new Date();
  const workerId = `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const job = await claimJob(workerId, now);
  if (!job) {
    const cur = await SyncJob.findById(active._id).lean();
    return { ...jobShape(cur, false), note: 'busy — next tick resumes' };
  }
  const { saved, nextPhase, jobDone } = await doBatch(job, workerId);
  return { ...jobShape(saved, jobDone), phase: nextPhase };
};

/**
 * POST /api/sync/process?key=... — external cron, ONE batch per call.
 */
exports.processBatch = async (req, res) => {
  if (!workerKeyOk(req)) return res.status(401).json({ success: false, error: 'Unauthorized' });
  const now = new Date();
  const workerId = `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  let job;
  try {
    job = await claimJob(workerId, now);
    if (!job) return res.status(200).json({ success: true, status: 'idle' });
    console.log(`[SYNC] Job ${job._id} claimed by worker ${workerId} phase=${job.payload?.phase || job.sync_type}`);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }

  try {
    if (job.status === 'cancelled') return res.status(200).json({ success: true, jobId: job._id, status: 'cancelled' });
    const { saved, nextPhase, jobDone } = await doBatch(job, workerId);
    return res.status(200).json({ ...jobShape(saved, jobDone), phase: nextPhase });
  } catch (err) {
    console.error(`[SYNC] batch failed job=${job._id}: ${err.message}`);
    // ponytail: disappearance looks like exception too — keep resumable unless retries exhausted
    const retryCount = (job.retry_count || 0) + 1;
    const fatal = retryCount >= MAX_RETRIES && /login|config|auth/i.test(err.message);
    await SyncJob.findByIdAndUpdate(job._id, {
      $set: {
        retry_count: retryCount,
        last_heartbeat_at: new Date(), lastProcessedAt: new Date(),
        lease_until: null, worker_id: null, // release so next cron can reclaim immediately
        ...(fatal ? { status: 'failed', error_message: err.message, error: err.message, completed_at: new Date(), completedAt: new Date() } : {})
      }
    });
    console.log(`[SYNC] Job ${job._id} ${fatal ? 'failed' : 'released for resume'} retry=${retryCount}`);
    return res.status(fatal ? 500 : 200).json({ success: !fatal, jobId: job._id, status: fatal ? 'failed' : 'running', error: err.message, resumed: !fatal });
  }
};

/**
 * GET /api/sync/kick?key=...&type=full — single URL for external pinger:
 * create job if none active, then run exactly ONE batch. Safe to hit every 60-90s.
 */
exports.kickSync = async (req, res) => {
  if (!workerKeyOk(req)) return res.status(401).json({ success: false, error: 'Unauthorized' });
  const syncType = req.query.type || req.body?.sync_type || 'full';
  if (!SYNC_TYPES.includes(syncType)) return res.status(400).json({ success: false, error: `Invalid type. Use: ${SYNC_TYPES.join(', ')}` });
  try {
    let active = await SyncJob.findOne({ status: { $in: ['pending', 'running', 'paused'] } }).sort({ updatedAt: -1 });
    if (!active) {
      const now = new Date();
      const phase = phaseFor(syncType, null);
      active = await SyncJob.create({
        sync_type: syncType, status: 'pending', total: 0, processed: 0, successful: 0, failed: 0,
        batchSize: parseInt(process.env.SYNC_BATCH_SIZE) || 50,
        current_page: 1, last_processed_id: null, cursor: null,
        payload: { phase, pages: {}, totals: {}, totalApi: null },
        started_at: now, startedAt: now, last_heartbeat_at: now, lastProcessedAt: now,
        retry_count: 0
      });
      console.log(`[SYNC] Kick created job ${active._id} type=${syncType}`);
    }
    // Reuse process path: claim then run one batch
    const now = new Date();
    const workerId = `k_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const job = await claimJob(workerId, now);
    if (!job) {
      const cur = await SyncJob.findById(active._id).lean();
      return res.status(200).json({ ...jobShape(cur, false), note: 'busy — next tick resumes' });
    }
    if (job.status === 'cancelled') return res.status(200).json({ success: true, jobId: job._id, status: 'cancelled' });
    const { saved, nextPhase, jobDone } = await doBatch(job, workerId);
    return res.status(200).json({ ...jobShape(saved, jobDone), phase: nextPhase });
  } catch (err) {
    console.error(`[SYNC] kick failed: ${err.message}`);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * GET /api/sync/status?jobId=... — public shape, auth optional (dashboard passes JWT, cron passes key).
 */
exports.getSyncStatus = async (req, res) => {
  try {
    const id = req.query.jobId || req.params.jobId;
    const job = id ? await SyncJob.findById(id).lean()
      : await SyncJob.findOne({ status: { $in: ['pending', 'running', 'paused'] } }).sort({ updatedAt: -1 }).lean();
    if (!job) return res.status(200).json({ success: true, status: 'idle' });
    const total = Math.max(job.total || 0, job.processed || 0), processed = job.processed || 0;
    const progress = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;
    const hb = job.last_heartbeat_at || job.lastProcessedAt;
    const remaining = total > processed && job.avg_batch_ms && (job.batchSize || 50)
      ? Math.round(((total - processed) / (job.batchSize || 50)) * (job.avg_batch_ms / 60000))
      : null;
    res.status(200).json({
      success: true, jobId: job._id, status: isStale(job, new Date()) && job.status === 'running' ? 'resuming' : job.status,
      sync_type: job.sync_type, phase: job.payload?.phase,
      total, processed, successful: job.successful || 0, failed: job.failed || 0,
      progress, lastHeartbeat: hb, startedAt: job.started_at || job.startedAt,
      estimatedRemaining: remaining == null ? 'calculating' : `~${remaining} minutes`,
      current_page: job.current_page, retry_count: job.retry_count || 0,
      totals: job.payload?.totals || {},
      errors: (job.batch_errors || []).slice(-5)
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * POST /api/sync/cancel — dashboard auth (mounted behind JWT) or worker key.
 */
exports.cancelSync = async (req, res) => {
  try {
    const id = req.query.jobId || req.params.jobId || req.body?.jobId;
    const job = id ? await SyncJob.findById(id)
      : await SyncJob.findOne({ status: { $in: ['pending', 'running', 'paused'] } }).sort({ updatedAt: -1 });
    if (!job) return res.status(404).json({ success: false, error: 'No active sync job found' });
    job.status = 'cancelled';
    job.error_message = `Cancelled by ${req.user?.name || 'admin'}`;
    job.error = job.error_message;
    job.lease_until = null; job.worker_id = null;
    await job.save();
    console.log(`[SYNC] Job ${job._id} cancelled`);
    res.status(200).json({ success: true, jobId: job._id, status: 'cancelled' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
