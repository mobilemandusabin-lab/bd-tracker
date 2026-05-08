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
router.get('/export-report', authMiddleware.restrictTo('super_admin'), dashboardController.getFullExportReport);
router.post('/bulk-upload', authMiddleware.restrictTo('super_admin'), dashboardController.bulkUploadLeads);

module.exports = router;
