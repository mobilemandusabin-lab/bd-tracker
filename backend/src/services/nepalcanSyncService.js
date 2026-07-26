const NepalcanSyncLog = require('../models/NepalcanSyncLog');
const { loginToNepalcan } = require('./nepalcanAuthService');
const { syncNepalcanOrders } = require('./nepalcanOrderSyncService');
const { syncNepalcanVendors, syncServiceBranches } = require('./nepalcanVendorSyncService');
const { fetchTotalMarketplaceProducts } = require('./nepalcanMarketplaceService');

const syncAllNepalcanData = async (userId = null) => {
  const startTime = Date.now();
  let loginToken = null;
  let ordersResult = { synced: 0, message: '' };
  let vendorsResult = { synced: 0, updated: 0, created: 0, message: '' };
  let errorMessage = null;
  let marketplaceProductsCount = 0;

  try {
    console.log('[Full Sync] Getting Nepalcan token...');
    loginToken = await loginToNepalcan();
    console.log('[Full Sync] Login successful');

    console.log('[Full Sync] Starting orders sync...');
    ordersResult = await syncNepalcanOrders(loginToken);
    console.log(`[Full Sync] Orders sync complete: ${ordersResult.synced} orders`);

    console.log('[Full Sync] Starting vendors sync...');
    vendorsResult = await syncNepalcanVendors(loginToken, userId);
    console.log(`[Full Sync] Vendors sync complete: ${vendorsResult.synced} vendors`);

    console.log('[Full Sync] Starting service branches sync...');
    const branchesResult = await syncServiceBranches(loginToken);
    console.log(`[Full Sync] Service branches sync complete: ${branchesResult.updated} vendors updated`);

    console.log('[Full Sync] Fetching marketplace products count...');
    marketplaceProductsCount = await fetchTotalMarketplaceProducts(loginToken);
    console.log(`[Full Sync] Marketplace products count: ${marketplaceProductsCount}`);
  } catch (err) {
    errorMessage = err.message;
    console.error('[Full Sync] Error:', errorMessage);
  }

  const durationMs = Date.now() - startTime;

  await NepalcanSyncLog.create({
    type: 'full',
    success: !errorMessage,
    ordersSynced: ordersResult.synced || 0,
    vendorsSynced: vendorsResult.synced || 0,
    leadsSynced: vendorsResult.created || 0,
    mergedRecords: vendorsResult.updated || 0,
    marketplaceProducts: marketplaceProductsCount,
    errorMessage,
    durationMs
  });

  return {
    success: !errorMessage,
    orders: ordersResult,
    vendors: vendorsResult,
    marketplaceProducts: marketplaceProductsCount,
    durationMs
  };
};

module.exports = { syncAllNepalcanData };