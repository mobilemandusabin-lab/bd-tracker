const NepaliDate = require('nepali-date-converter').default;
const { takeSnapshot } = require('./vendorSnapshotService');

const timers = {};
const nextSchedule = { weekly: null, monthly: null };

function getNextSchedule() {
  return {
    weekly: nextSchedule.weekly ? { ...nextSchedule.weekly } : null,
    monthly: nextSchedule.monthly ? { ...nextSchedule.monthly } : null
  };
}

function startSnapshotScheduler() {
  console.log('[SnapshotScheduler] Starting Nepali calendar-based scheduler...');
  scheduleNext('weekly');
  scheduleNext('monthly');
}

function stopSnapshotScheduler() {
  Object.values(timers).forEach(clearTimeout);
  console.log('[SnapshotScheduler] Stopped');
}

function scheduleNext(type) {
  if (timers[type]) clearTimeout(timers[type]);

  const now = new Date();
  const bsNow = new NepaliDate(now);
  let targetDate = getTargetDate(type, bsNow);
  targetDate.setHours(23, 59, 59, 999);
  let delay = targetDate.getTime() - now.getTime();

  if (delay < 0) {
    targetDate = getNextPeriodTarget(type, targetDate);
    delay = targetDate.getTime() - now.getTime();
  }

  nextSchedule[type] = {
    type,
    targetDate: targetDate.toISOString(),
    delayMs: delay,
    scheduledAt: new Date().toISOString()
  };

  const hours = Math.round(delay / 3600000 * 10) / 10;
  const targetStr = targetDate.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  });
  console.log(`[SnapshotScheduler] Next ${type} at end of ${targetStr} (in ${hours}h)`);

  timers[type] = setTimeout(async () => {
    try {
      const snapshot = await takeSnapshot(type);
      console.log(`[SnapshotScheduler] Auto-captured ${type}: ${snapshot.nepaliDate}`);
    } catch (err) {
      console.error(`[SnapshotScheduler] ${type} failed:`, err.message);
    }
    scheduleNext(type);
  }, delay);
}

function getTargetDate(type, bsDate) {
  if (type === 'weekly') {
    const daysUntilFriday = bsDate.getDay() === 5 ? 0 : (5 - bsDate.getDay() + 7) % 7;
    const target = bsDate.toJsDate();
    target.setDate(target.getDate() + daysUntilFriday);
    return target;
  }
  let nextMonth = bsDate.getMonth() + 1;
  let nextYear = bsDate.getYear();
  if (nextMonth > 11) { nextMonth = 0; nextYear++; }
  const firstOfNext = new NepaliDate(nextYear, nextMonth, 1);
  const firstOfNextAD = firstOfNext.toJsDate();
  return new Date(firstOfNextAD.getTime() - 86400000);
}

function getNextPeriodTarget(type, currentTarget) {
  if (type === 'weekly') {
    const next = new Date(currentTarget);
    next.setDate(next.getDate() + 7);
    next.setHours(23, 59, 59, 999);
    return next;
  }
  const bsTarget = new NepaliDate(currentTarget);
  let nextMonth = bsTarget.getMonth() + 2;
  let nextYear = bsTarget.getYear();
  if (nextMonth > 11) { nextMonth -= 12; nextYear++; }
  const firstOfNext = new NepaliDate(nextYear, nextMonth, 1);
  const firstOfNextAD = firstOfNext.toJsDate();
  const next = new Date(firstOfNextAD.getTime() - 86400000);
  next.setHours(23, 59, 59, 999);
  return next;
}

module.exports = { startSnapshotScheduler, stopSnapshotScheduler, getNextSchedule };
