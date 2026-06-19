const ListingSnapshot = require('../models/ListingSnapshot');
const NepaliDate = require('nepali-date-converter').default;

async function getMarketplaceTotal() {
  try {
    const { fetchTotalMarketplaceProducts } = require('./nepalcanSyncService');
    const total = await fetchTotalMarketplaceProducts();
    return total;
  } catch (err) {
    console.error('[ListingSnapshot] Failed to fetch marketplace total from Nepalcan:', err.message);
    return null;
  }
}

async function checkAndTakeSnapshots() {
  const results = { snapshots: [] };

  const today = new Date();
  const bsToday = new NepaliDate(today);
  const isFriday = bsToday.getDay() === 5;

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const bsTomorrow = new NepaliDate(tomorrow);
  const isLastDayOfMonth = bsTomorrow.getMonth() !== bsToday.getMonth()
    || bsTomorrow.getYear() !== bsToday.getYear();

  if (isFriday) {
    const marketplaceTotal = await getMarketplaceTotal();
    try {
      const snapshot = await ListingSnapshot.captureSnapshot('weekly', marketplaceTotal);
      results.snapshots.push({ type: 'weekly', nepaliDate: snapshot.nepaliDate });
      console.log(`[ListingSnapshot] Weekly snapshot captured: ${snapshot.nepaliDate}`);
    } catch (err) {
      console.error('[ListingSnapshot] Weekly snapshot error:', err.message);
      results.errors = results.errors || [];
      results.errors.push({ type: 'weekly', error: err.message });
    }
  }

  if (isLastDayOfMonth) {
    const marketplaceTotal = await getMarketplaceTotal();
    try {
      const snapshot = await ListingSnapshot.captureSnapshot('monthly', marketplaceTotal);
      results.snapshots.push({ type: 'monthly', nepaliDate: snapshot.nepaliDate });
      console.log(`[ListingSnapshot] Monthly snapshot captured: ${snapshot.nepaliDate}`);
    } catch (err) {
      console.error('[ListingSnapshot] Monthly snapshot error:', err.message);
      results.errors = results.errors || [];
      results.errors.push({ type: 'monthly', error: err.message });
    }
  }

  if (!isFriday && !isLastDayOfMonth) {
    console.log('[ListingSnapshot] No snapshot needed today (not Friday or month-end)');
    results.message = 'No snapshot needed today';
  }

  return results;
}

async function takeSnapshot(type) {
  const marketplaceTotal = await getMarketplaceTotal();
  const snapshot = await ListingSnapshot.captureSnapshot(type, marketplaceTotal);
  console.log(`[ListingSnapshot] Manual ${type} snapshot captured: ${snapshot.nepaliDate}`);
  return snapshot;
}

module.exports = { checkAndTakeSnapshots, takeSnapshot };
