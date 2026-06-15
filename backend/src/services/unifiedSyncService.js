const SystemSyncLog = require('../models/SystemSyncLog');
const { checkOverdueFollowups, checkEscalationTriggers } = require('./overdueChecker');
const { syncAllNepalcanData } = require('./nepalcanSyncService');
const { checkAndTakeSnapshots: checkVendorSnapshots } = require('./vendorSnapshotService');
const { checkAndTakeSnapshots: checkListingSnapshots } = require('./listingSnapshotService');

const STALE_SYNC_TIMEOUT_MS = 30 * 60 * 1000;

const runFullSync = async (triggeredBy = 'cron', userId = null) => {
  const existingRunning = await SystemSyncLog.findOne({ status: 'running' });
  if (existingRunning) {
    const age = Date.now() - new Date(existingRunning.createdAt).getTime();
    if (age < STALE_SYNC_TIMEOUT_MS) {
      throw new Error('A sync is already in progress (started ' + new Date(existingRunning.createdAt).toLocaleString() + ')');
    }
    existingRunning.status = 'failed';
    existingRunning.success = false;
    existingRunning.errorMessage = 'Auto-reset — stale sync older than 30min';
    await existingRunning.save();
    console.log('[Full Sync] Reset stale running sync from', existingRunning.createdAt);
  }

  const startTime = Date.now();
  const tasks = {};

  const log = await SystemSyncLog.create({
    status: 'running',
    triggeredBy,
    userId,
    success: null,
    durationMs: 0,
    tasks: {},
    errorMessage: null
  });

  try {
    const overdueStart = Date.now();
    try {
      tasks.overdueCheck = { ran: true };
      const overdueCount = await checkOverdueFollowups();
      if (overdueCount > 0) {
        await checkEscalationTriggers();
      }
      tasks.overdueCheck.success = true;
      tasks.overdueCheck.result = { overdueCount };
      tasks.overdueCheck.durationMs = Date.now() - overdueStart;
    } catch (err) {
      tasks.overdueCheck = { ran: true, success: false, error: err.message, durationMs: Date.now() - overdueStart };
      console.error('[Full Sync] Overdue check failed:', err.message);
    }

    const nepalcanStart = Date.now();
    try {
      tasks.nepalcanOrders = { ran: true };
      tasks.vendorSync = { ran: true };
      const result = await syncAllNepalcanData(userId);
      tasks.nepalcanOrders.success = result.orders?.synced >= 0;
      tasks.nepalcanOrders.ordersSynced = result.orders?.synced || 0;
      tasks.nepalcanOrders.durationMs = Date.now() - nepalcanStart;
      tasks.vendorSync.success = true;
      tasks.vendorSync.vendorsSynced = result.vendors?.synced || 0;
      tasks.vendorSync.vendorsCreated = result.vendors?.created || 0;
      tasks.vendorSync.vendorsUpdated = result.vendors?.updated || 0;
      tasks.vendorSync.durationMs = Date.now() - nepalcanStart;
    } catch (err) {
      tasks.nepalcanOrders = { ran: true, success: false, error: err.message, durationMs: Date.now() - nepalcanStart };
      tasks.vendorSync = { ran: true, success: false, error: err.message, durationMs: Date.now() - nepalcanStart };
      console.error('[Full Sync] Nepalcan sync failed:', err.message);
    }

    const marketplaceStart = Date.now();
    try {
      tasks.marketplaceProducts = { ran: true };
      tasks.marketplaceProducts.total = result?.marketplaceProducts ?? 0;
      tasks.marketplaceProducts.success = true;
      tasks.marketplaceProducts.durationMs = Date.now() - marketplaceStart;
    } catch (err) {
      tasks.marketplaceProducts = { ran: true, success: false, error: err.message, durationMs: Date.now() - marketplaceStart };
      console.error('[Full Sync] Marketplace products fetch failed:', err.message);
    }

    const vendorSnapStart = Date.now();
    try {
      tasks.vendorSnapshots = { ran: true };
      const snapshotResult = await checkVendorSnapshots();
      tasks.vendorSnapshots.success = true;
      tasks.vendorSnapshots.snapshotsTaken = snapshotResult?.snapshots?.length || 0;
      tasks.vendorSnapshots.durationMs = Date.now() - vendorSnapStart;
    } catch (err) {
      tasks.vendorSnapshots = { ran: true, success: false, error: err.message, durationMs: Date.now() - vendorSnapStart };
      console.error('[Full Sync] Vendor snapshots failed:', err.message);
    }

    const listingSnapStart = Date.now();
    try {
      tasks.listingSnapshots = { ran: true };
      const listingResult = await checkListingSnapshots();
      tasks.listingSnapshots.success = true;
      tasks.listingSnapshots.snapshotsTaken = listingResult?.snapshots?.length || 0;
      tasks.listingSnapshots.durationMs = Date.now() - listingSnapStart;
    } catch (err) {
      tasks.listingSnapshots = { ran: true, success: false, error: err.message, durationMs: Date.now() - listingSnapStart };
      console.error('[Full Sync] Listing snapshots failed:', err.message);
    }

    const durationMs = Date.now() - startTime;
    const allSuccess = Object.values(tasks).every(t => t.success !== false);

    // Don't overwrite if manually stopped via sync-stop button
    const currentLog = await SystemSyncLog.findById(log._id);
    if (currentLog?.status === 'failed' && currentLog?.errorMessage?.startsWith('Manually stopped')) {
      console.log('[Full Sync] Skipping final save — sync was manually stopped');
      return currentLog;
    }

    log.status = allSuccess ? 'completed' : 'failed';
    log.success = allSuccess;
    log.durationMs = durationMs;
    log.tasks = tasks;
    log.errorMessage = allSuccess ? null : 'One or more tasks failed';
    await log.save();

    console.log(`[Full Sync] Complete in ${durationMs}ms — success: ${allSuccess}`);
    return log;
  } catch (err) {
    log.status = 'failed';
    log.success = false;
    log.durationMs = Date.now() - startTime;
    log.tasks = tasks;
    log.errorMessage = err.message;
    await log.save();
    throw err;
  }
};

module.exports = { runFullSync };
