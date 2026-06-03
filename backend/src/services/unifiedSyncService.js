const SystemSyncLog = require('../models/SystemSyncLog');
const { checkOverdueFollowups, checkEscalationTriggers } = require('./overdueChecker');
const { syncAllNepalcanData } = require('./nepalcanSyncService');
const { checkAndTakeSnapshots } = require('./vendorSnapshotService');

const runFullSync = async (triggeredBy = 'cron', userId = null) => {
  const existingRunning = await SystemSyncLog.findOne({ status: 'running' });
  if (existingRunning) {
    throw new Error('A sync is already in progress (started ' + new Date(existingRunning.createdAt).toLocaleString() + ')');
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

    const snapshotStart = Date.now();
    try {
      tasks.vendorSnapshots = { ran: true };
      const snapshotResult = await checkAndTakeSnapshots();
      tasks.vendorSnapshots.success = true;
      tasks.vendorSnapshots.snapshotsTaken = snapshotResult?.snapshots?.length || 0;
      tasks.vendorSnapshots.durationMs = Date.now() - snapshotStart;
    } catch (err) {
      tasks.vendorSnapshots = { ran: true, success: false, error: err.message, durationMs: Date.now() - snapshotStart };
      console.error('[Full Sync] Vendor snapshots failed:', err.message);
    }

    const durationMs = Date.now() - startTime;
    const allSuccess = Object.values(tasks).every(t => t.success !== false);

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
