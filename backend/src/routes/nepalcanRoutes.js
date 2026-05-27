const express = require('express');
const router = express.Router();
const nepalcanController = require('../controllers/nepalcanController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');

// All routes require authentication
router.use(authMiddleware.protect);
router.use(requirePermission('nepalcan.manage'));

// Login to Nepalcan.com
router.post('/login', nepalcanController.loginToNepalcan);

// Get sales/orders data
router.get('/sales', nepalcanController.getNepalcanSales);

// Sync vendors from Nepalcan (uses configured credentials)
router.post('/sync-vendors', nepalcanController.syncVendorsFromNepalcan);

// Manual sync vendors
router.post('/sync-vendors-manual', nepalcanController.syncVendorsManual);

// Fetch vendors directly from Nepalcan API (requires token in body)
router.post('/fetch-vendors', nepalcanController.fetchVendorsFromNepalcan);

// Get vendor sync logs
router.get('/vendor-sync-logs', nepalcanController.getVendorSyncLogs);

// Full sync - sync both orders and vendors
router.post('/sync-all', nepalcanController.syncAllNepalcanData);

// Sync service branches for all vendors
router.post('/sync-service-branches', nepalcanController.syncServiceBranches);

module.exports = router;
