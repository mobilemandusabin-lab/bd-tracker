const SystemSyncLog = require('../models/SystemSyncLog');
const { checkOverdueFollowups, checkEscalationTriggers } = require('./overdueChecker');
const { syncAllNepalcanData } = require('./nepalcanSyncService');
const { checkAndTakeSnapshots } = require('./vendorSnapshotService');

/**
 * Run all sync tasks in sequence and log results.
 * @param {string} triggeredBy - 'cron' | 'manual' | 'startup'
 * @param {string|null} userId - User ID for manual triggers
 * @returns {object} Sync log with task results
 */
const runFullSync = async (triggeredBy = 'cron', userId = null) => {
  const startTime = Date.now();
  const tasks = {};

  // 1. Overdue follow-up check
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
    console.log(`[Full Sync] Overdue check done: ${overdueCount} overdue`);
  } catch (err) {
    tasks.overdueCheck = { ran: true, success: false, error: err.message, durationMs: Date.now() - overdueStart };
    console.error('[Full Sync] Overdue check failed:', err.message);
  }

  // 2. Nepalcan full sync (orders + vendors + branches)
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
    console.log(`[Full Sync] Nepalcan sync done: ${tasks.nepalcanOrders.ordersSynced} orders, ${tasks.vendorSync.vendorsSynced} vendors`);
  } catch (err) {
    tasks.nepalcanOrders = { ran: true, success: false, error: err.message, durationMs: Date.now() - nepalcanStart };
    tasks.vendorSync = { ran: true, success: false, error: err.message, durationMs: Date.now() - nepalcanStart };
    console.error('[Full Sync] Nepalcan sync failed:', err.message);
  }

  // 3. Vendor snapshots
  const snapshotStart = Date.now();
  try {
    tasks.vendorSnapshots = { ran: true };
    const snapshotResult = await checkAndTakeSnapshots();
    tasks.vendorSnapshots.success = true;
    tasks.vendorSnapshots.snapshotsTaken = snapshotResult?.snapshots?.length || 0;
    tasks.vendorSnapshots.durationMs = Date.now() - snapshotStart;
    console.log(`[Full Sync] Vendor snapshots done: ${tasks.vendorSnapshots.snapshotsTaken} taken`);
  } catch (err) {
    tasks.vendorSnapshots = { ran: true, success: false, error: err.message, durationMs: Date.now() - snapshotStart };
    console.error('[Full Sync] Vendor snapshots failed:', err.message);
  }

  const durationMs = Date.now() - startTime;
  const allSuccess = Object.values(tasks).every(t => t.success !== false);

  const log = await SystemSyncLog.create({
    triggeredBy,
    userId,
    success: allSuccess,
    durationMs,
    tasks,
    errorMessage: allSuccess ? null : 'One or more tasks failed'
  });

  console.log(`[Full Sync] Complete in ${durationMs}ms — success: ${allSuccess}`);
  return log;
};

module.exports = { runFullSync };
