const express = require('express');
const {
  syncNepalcanOrders,
  getNepalcanOrders,
  getNepalcanStats,
  fetchFromNepalcan,
  getNepalcanOrderById,
  getLastSyncLog,
  getSyncLogs,
  getOrderTracking,
  getNepalcanAnalytics,
  getMonthlyData,
  checkReturnedOrders
} = require('../controllers/nepalcanOrderController');
const { protect } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');

const router = express.Router();

// All routes require authentication and nepalcan permission
router.use(protect);
router.use(requirePermission('nepalcan.manage'));

// Sync orders from Nepalcan to database
router.post('/sync', syncNepalcanOrders);

// Get orders with filtering
router.get('/orders', getNepalcanOrders);

// Get statistics and processing times
router.get('/stats', getNepalcanStats);

// Get comprehensive analytics
router.get('/analytics', getNepalcanAnalytics);

// Get monthly aggregated data
router.get('/monthly', getMonthlyData);

// Get single order by ID with status history
router.get('/order/:id', getNepalcanOrderById);

// Fetch orders directly from Nepalcan API
router.post('/fetch', fetchFromNepalcan);

// Get last sync log
router.get('/sync-log/last', getLastSyncLog);

// Get recent sync logs
router.get('/sync-logs', getSyncLogs);

// Get order tracking details from external logistics API
router.get('/tracking/:orderId', getOrderTracking);

// Manually check delivered orders for returns
router.post('/check-returns', checkReturnedOrders);

module.exports = router;
