const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(authMiddleware.protect);

router.get('/stats', dashboardController.getStats);
router.get('/lead-growth', dashboardController.getLeadGrowth);
router.get('/daily-call-report', authMiddleware.restrictTo('super_admin'), dashboardController.getDailyCallReport);
router.get('/user-performance', authMiddleware.restrictTo('super_admin'), dashboardController.getUserPerformanceReport);
router.get('/bd-leaderboard', authMiddleware.restrictTo('super_admin', 'admin'), dashboardController.getBDLeaderboard);
router.get('/bd-leaderboard-full', authMiddleware.restrictTo('super_admin', 'admin'), dashboardController.getBDLeaderboardFull);
router.get('/bd-leaderboard/:bdId/drill-down', authMiddleware.restrictTo('super_admin', 'admin'), dashboardController.getBDDrillDown);
router.get('/export-report', authMiddleware.restrictTo('super_admin'), dashboardController.getFullExportReport);
router.post('/bulk-upload', authMiddleware.restrictTo('super_admin'), dashboardController.bulkUploadLeads);
router.get('/analytics', dashboardController.getAnalytics);
router.get('/my-analytics', dashboardController.getMyAnalytics);
router.get('/day-detail', authMiddleware.restrictTo('super_admin'), dashboardController.getDayDetail);
router.get('/day-compare', authMiddleware.restrictTo('super_admin'), dashboardController.getDayCompare);
router.get('/week-compare', authMiddleware.restrictTo('super_admin'), dashboardController.getWeekCompare);

// Sync endpoints (super_admin only)
router.post('/sync-all', authMiddleware.restrictTo('super_admin'), dashboardController.triggerFullSync);
router.get('/sync-logs', authMiddleware.restrictTo('super_admin'), dashboardController.getSyncLogs);

module.exports = router;
