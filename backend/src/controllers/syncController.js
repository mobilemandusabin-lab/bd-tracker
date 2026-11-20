const crypto = require('crypto');
const SyncJob = require('../models/SyncJob');
const { loginToNepalcan } = require('../services/nepalcanAuthService');
const {
  processOrdersPage, processDetailsBatch, processTrackingBatch, processVendorsPage, processBranchesBatch
} = require('../services/syncBatchService');

const STALE_AFTER = parseInt(process.env.SYNC_STALE_AFTER) || 300;
const LEASE_DURATION = parseInt(process.env.SYNC_LEASE_DURATION) || 240;
const MAX_RETRIES = parseInt(process.env.SYNC_MAX_RETRIES) || 3;

// Full sync intentionally stops after vendors. Service branches are managed
// separately and are not part of the routine sales/vendor sync.
const PHASES = ['orders', 'details', 'tracking', 'vendors'];
const SYNC_TYPES = ['full', 'nepalcan_orders', 'details', 'tracking', 'nepalcan_vendors', 'branches'];
const phaseFor = (syncType, payloadPhase) =>
  syncType === 'full' ? (payloadPhase || 'orders') : (
    { nepalcan_orders: 'orders', details: 'details', tracking: 'tracking', nepalcan_vendors: 'vendors', branches: 'branches' }[syncType] || 'orders'
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

const claimJob = async (workerId, now, syncType = null) => {
  const staleAt = new Date(now.getTime() - STALE_AFTER * 1000);
  return SyncJob.findOneAndUpdate(
    {
      status: { $in: ['pending', 'running', 'paused'] },
      ...(syncType ? { sync_type: syncType } : {}),
      $or: [
        { lease_until: null }, { lease_until: { $exists: false } },
        { lease_until: { $lt: now } },
        { last_heartbeat_at: null }, { last_heartbeat_at: { $lt: staleAt } }
      ]
    },
    {
      $set: { status: 'running', worker_id: workerId, lease_until: new Date(now.getTime() + LEASE_DURATION * 1000), last_heartbeat_at: now, batch_started_at: now },
    },
    { returnDocument: 'after', sort: { updatedAt: 1 } }
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

const syncLogType = (syncType) =>
  syncType === 'nepalcan_vendors' ? 'vendors' : syncType === 'full' ? 'full' : 'orders';

const phaseSuccessful = (job, phase) => Number(job.payload?.phaseStats?.[phase]?.successful) || 0;

const writeSyncLog = async (job, success, errorMessage = null) => {
  try {
    const NepalcanSyncLog = require('../models/NepalcanSyncLog');
    await NepalcanSyncLog.create({
      type: syncLogType(job.sync_type),
      success,
      ordersSynced: phaseSuccessful(job, 'orders'),
      vendorsSynced: phaseSuccessful(job, 'vendors'),
      totalProcessed: job.processed || 0,
      errorMessage,
      durationMs: Date.now() - new Date(job.started_at || job.createdAt).getTime()
    });
  } catch (error) {
    console.error('[SYNC] history log failed:', error.message);
  }
};

// All entry points use the same failure checkpoint so a thrown batch never
// leaves a lease stuck. Contract violations are non-retryable; transient
// failures are released for the next tick and fail after MAX_RETRIES.
const recordBatchFailure = async (job, error) => {
  const retryCount = (job.retry_count || 0) + 1;
  const fatal = Boolean(error.nonRetryable) ||
    error.code === 'NEPALCAN_ORDER_RESPONSE_INVALID' ||
    retryCount >= MAX_RETRIES;
  const message = String(error.message || 'Sync batch failed').slice(0, 1000);
  const batchErrors = [
    ...(job.batch_errors || []).slice(-19),
    { recordId: job.payload?.phase || job.sync_type, message, at: new Date() }
  ];
  const update = {
    retry_count: retryCount,
    last_heartbeat_at: new Date(),
    lastProcessedAt: new Date(),
    lease_until: null,
    worker_id: null,
    error_message: message,
    error: message,
    batch_errors: batchErrors,
    ...(fatal ? { status: 'failed', completed_at: new Date(), completedAt: new Date() } : {})
  };
  const saved = await SyncJob.findByIdAndUpdate(job._id, { $set: update }, { returnDocument: 'after' }).lean();
  if (fatal) await writeSyncLog(saved, false, message);
  console.log(`[SYNC] Job ${job._id} ${fatal ? 'failed' : 'released for resume'} retry=${retryCount}`);
  return { saved, fatal, retryCount };
};

// Core: run exactly ONE batch on an already-claimed job. Shared by process + kick.
const doBatch = async (job, workerId) => {
  const started = Date.now();
  const now = new Date();
  if (!job.started_at) { job.started_at = job.started_at || now; job.startedAt = job.startedAt || now; }
  const phase = phaseFor(job.sync_type, job.payload?.phase);

  // Guard: if an orders/vendors job's checkpoint is older than the sync window
  // (19 days), its page cursor points into a date range the API no longer returns.
  // Reset to page 1 so this batch starts fresh against today's window.
  const ORDER_SYNC_DAYS = parseInt(process.env.NEPALCAN_ORDER_FETCH_DAYS) || 60;
  const jobAgeMs = now - new Date(job.started_at || job.createdAt);
  const windowMs = ORDER_SYNC_DAYS * 24 * 60 * 60 * 1000;
  if ((phase === 'orders' || phase === 'vendors') && jobAgeMs > windowMs && (job.current_page || 1) > 1) {
    console.warn(`[SYNC] Job ${job._id} checkpoint is ${Math.round(jobAgeMs / 86400000)}d old (window=${ORDER_SYNC_DAYS}d) — resetting page to 1`);
    await SyncJob.findByIdAndUpdate(job._id, { $set: { current_page: 1, processed: 0, successful: 0, failed: 0, 'payload.phaseStats': {}, 'payload.totals': {}, total: 0 } });
    job.current_page = 1;
    job.processed = 0; job.successful = 0; job.failed = 0;
  }

  console.log(`[SYNC] ${phase} batch started job=${job._id} page=${job.current_page}`);

  let token = null;
  // Only phases that call the Nepalcan Commerce API need a token.
  // details and tracking use their own APIs/DB — login cost is wasted there.
  const needsToken = phase === 'orders' || phase === 'vendors' || phase === 'branches';
  if (needsToken) {
    try {
      token = await loginToNepalcan();
    } catch (e) {
      console.error(`[SYNC] login failed: ${e.message}`);
      const status = e.response?.status;
      const err = new Error(`Nepalcan login failed: ${e.response?.data?.message || e.message}`);
      // Bad credentials/config won't recover by retrying the same batch.
      err.nonRetryable = status === 400 || status === 401 || status === 403;
      err.causeStatus = status;
      throw err;
    }
    if (!token) {
      const err = new Error('Nepalcan login failed: no token received');
      err.nonRetryable = true;
      throw err;
    }
  }

  let r;
  if (phase === 'orders') r = await processOrdersPage(job, token);
  else if (phase === 'details') r = await processDetailsBatch(job);
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
  const phaseStats = { ...(job.payload?.phaseStats || {}) };
  const previousPhaseStats = phaseStats[phase] || {};
  phaseStats[phase] = {
    processed: (previousPhaseStats.processed || 0) + (r.count || 0),
    successful: (previousPhaseStats.successful || 0) + (r.successful || 0),
    failed: (previousPhaseStats.failed || 0) + (r.failed || 0)
  };
  const knownSum = Object.values(totals).reduce((s, v) => s + (Number(v) || 0), 0);
  const total = Math.max(job.total || 0, knownSum, processed);
  const update = {
    processed, successful, failed, total,
    'payload.totals': totals,
    'payload.phaseStats': phaseStats,
    last_heartbeat_at: new Date(),
    lastProcessedAt: new Date(),
    lease_until: null, // ponytail: release immediately so next tick claims instantly
    worker_id: null,
    retry_count: 0,
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
        // Reset per-phase cursors when entering a new phase
        update['payload.phase'] = nextPhase;
        update.current_page = 1;
        update.last_processed_id = null;
        update.cursor = null;
        console.log(`[SYNC] phase ${phase} complete → ${nextPhase} job=${job._id}`);
      } else { jobDone = true; }
    } else { jobDone = true; }
    // When done=true but not transitioning phases (single-type jobs that just finished
    // their last record), these are already set above or irrelevant for jobDone=true.
    // Do NOT double-increment page here — the page reset above already handles phase transitions.
  } else {
    // Batch returned more work to do: advance the cursor for this phase
    if (phase === 'orders' || phase === 'vendors') update.current_page = (job.current_page || 1) + 1;
    else update.last_processed_id = r.last_processed_id || job.last_processed_id;
    if (job.sync_type === 'full') update['payload.phase'] = phase;
  }
  if (r.totalApi && job.sync_type === 'full') update['payload.totalApi'] = r.totalApi;
  if (jobDone) {
    update.status = 'completed';
    update.completed_at = new Date(); update.completedAt = new Date();
    console.log(`[SYNC] Job ${job._id} completed processed=${processed}`);
  }
  const saved = await SyncJob.findByIdAndUpdate(job._id, { $set: update }, { returnDocument: 'after' }).lean();
  console.log(`[SYNC] checkpoint saved job=${job._id} phase=${nextPhase} processed=${processed}/${saved.total} +${r.count} (${elapsedMs}ms)`);
  if (jobDone) {
    // Keep legacy sales history working, but do not mix tracking/vendor work
    // into the order count.
    await writeSyncLog(saved, true);
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
    // Use findOneAndUpdate upsert to avoid duplicate-key race between concurrent calls
    active = await SyncJob.findOneAndUpdate(
      { sync_type: syncType, status: { $in: ['pending', 'running', 'paused'] } },
      {
        $setOnInsert: {
          sync_type: syncType, status: 'pending', total: 0, processed: 0, successful: 0, failed: 0, skipped: 0,
          batchSize: parseInt(process.env.SYNC_BATCH_SIZE) || 50,
          current_page: 1, last_processed_id: null, cursor: null,
          payload: { phase: phaseFor(syncType, null), pages: {}, totals: {}, phaseStats: {}, totalApi: null },
          started_at: now, startedAt: now, last_heartbeat_at: now, lastProcessedAt: now,
          retry_count: 0
        }
      },
      { upsert: true, returnDocument: 'after' }
    );
    console.log(`[SYNC] ensure upserted job ${active._id} type=${syncType}`);
  }
  const now = new Date();
  const workerId = `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const job = await claimJob(workerId, now, syncType);
  if (!job) {
    const cur = await SyncJob.findById(active._id).lean();
    return { ...jobShape(cur, false), note: 'busy — next tick resumes' };
  }
  try {
    const { saved, nextPhase, jobDone } = await doBatch(job, workerId);
    return { ...jobShape(saved, jobDone), phase: nextPhase };
  } catch (error) {
    await recordBatchFailure(job, error);
    throw error;
  }
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
    const { fatal } = await recordBatchFailure(job, err);
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
  let job = null;
  try {
    // Filter by sync_type so a running 'nepalcan_orders' job doesn't block a 'full' kick
    let active = await SyncJob.findOne({ status: { $in: ['pending', 'running', 'paused'] }, sync_type: syncType }).sort({ updatedAt: -1 });
    if (!active) {
      const now = new Date();
      const phase = phaseFor(syncType, null);
      // Use findOneAndUpdate upsert to avoid duplicate-key race between concurrent kicks
      active = await SyncJob.findOneAndUpdate(
        { sync_type: syncType, status: { $in: ['pending', 'running', 'paused'] } },
        {
          $setOnInsert: {
            sync_type: syncType, status: 'pending', total: 0, processed: 0, successful: 0, failed: 0,
            batchSize: parseInt(process.env.SYNC_BATCH_SIZE) || 50,
            current_page: 1, last_processed_id: null, cursor: null,
            payload: { phase, pages: {}, totals: {}, phaseStats: {}, totalApi: null },
            started_at: now, startedAt: now, last_heartbeat_at: now, lastProcessedAt: now,
            retry_count: 0
          }
        },
        { upsert: true, returnDocument: 'after' }
      );
      console.log(`[SYNC] Kick upserted job ${active._id} type=${syncType}`);
    }
    // Reuse process path: claim then run one batch
    const now = new Date();
    const workerId = `k_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    job = await claimJob(workerId, now, syncType);
    if (!job) {
      const cur = await SyncJob.findById(active._id).lean();
      return res.status(200).json({ ...jobShape(cur, false), note: 'busy — next tick resumes' });
    }
    if (job.status === 'cancelled') return res.status(200).json({ success: true, jobId: job._id, status: 'cancelled' });
    const { saved, nextPhase, jobDone } = await doBatch(job, workerId);
    return res.status(200).json({ ...jobShape(saved, jobDone), phase: nextPhase });
  } catch (err) {
    console.error(`[SYNC] kick failed: ${err.message}`);
    const failure = job ? await recordBatchFailure(job, err) : null;
    return res.status(failure && !failure.fatal ? 200 : 500).json({
      success: false,
      jobId: job?._id,
      status: failure?.fatal ? 'failed' : job ? 'running' : 'error',
      error: err.message,
      resumed: Boolean(failure && !failure.fatal)
    });
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
