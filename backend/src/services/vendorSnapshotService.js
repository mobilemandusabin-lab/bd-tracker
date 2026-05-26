const VendorSnapshot = require('../models/VendorSnapshot');
const NepaliDate = require('nepali-date-converter').default;

/**
 * Check if today is Sunday or last day of Nepali month,
 * and take snapshots accordingly.
 */
async function checkAndTakeSnapshots() {
  const results = { snapshots: [] };

  const today = new Date();
  const bsToday = new NepaliDate(today);
  const isFriday = bsToday.getDay() === 5;

  // Check if tomorrow is a different BS month (i.e., today is last day of month)
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const bsTomorrow = new NepaliDate(tomorrow);
  const isLastDayOfMonth = bsTomorrow.getMonth() !== bsToday.getMonth()
    || bsTomorrow.getYear() !== bsToday.getYear();

  if (isFriday) {
    try {
      const snapshot = await VendorSnapshot.captureSnapshot('weekly');
      results.snapshots.push({ type: 'weekly', nepaliDate: snapshot.nepaliDate });
      console.log(`[Snapshot] Weekly snapshot captured: ${snapshot.nepaliDate}`);
    } catch (err) {
      console.error('[Snapshot] Weekly snapshot error:', err.message);
      results.errors = results.errors || [];
      results.errors.push({ type: 'weekly', error: err.message });
    }
  }

  if (isLastDayOfMonth) {
    try {
      const snapshot = await VendorSnapshot.captureSnapshot('monthly');
      results.snapshots.push({ type: 'monthly', nepaliDate: snapshot.nepaliDate });
      console.log(`[Snapshot] Monthly snapshot captured: ${snapshot.nepaliDate}`);
    } catch (err) {
      console.error('[Snapshot] Monthly snapshot error:', err.message);
      results.errors = results.errors || [];
      results.errors.push({ type: 'monthly', error: err.message });
    }
  }

  if (!isFriday && !isLastDayOfMonth) {
    console.log('[Snapshot] No snapshot needed today (not Friday or month-end)');
    results.message = 'No snapshot needed today';
  }

  return results;
}

/**
 * Manually take a snapshot of the given type
 */
async function takeSnapshot(type) {
  const snapshot = await VendorSnapshot.captureSnapshot(type);
  console.log(`[Snapshot] Manual ${type} snapshot captured: ${snapshot.nepaliDate}`);
  return snapshot;
}

module.exports = { checkAndTakeSnapshots, takeSnapshot };
