const ListingSnapshot = require('../models/ListingSnapshot');

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

async function takeSnapshot(type) {
  const marketplaceTotal = await getMarketplaceTotal();
  const snapshot = await ListingSnapshot.captureSnapshot(type, marketplaceTotal);
  console.log(`[ListingSnapshot] Manual ${type} snapshot captured: ${snapshot.nepaliDate}`);
  return snapshot;
}

module.exports = { takeSnapshot };
