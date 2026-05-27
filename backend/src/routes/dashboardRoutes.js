const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');

const router = express.Router();

router.use(authMiddleware.protect);

router.get('/stats', dashboardController.getStats);
router.get('/lead-growth', dashboardController.getLeadGrowth);
router.get('/daily-call-report', requirePermission('dashboard.daily-report'), dashboardController.getDailyCallReport);
router.get('/user-performance', requirePermission('dashboard.user-performance'), dashboardController.getUserPerformanceReport);
router.get('/bd-tiers', dashboardController.getBDTiers);
router.get('/bd-leaderboard', requirePermission('analytics.leaderboard'), dashboardController.getBDLeaderboard);
router.get('/bd-leaderboard-full', requirePermission('analytics.leaderboard'), dashboardController.getBDLeaderboardFull);
router.get('/bd-leaderboard/:bdId/drill-down', requirePermission('analytics.leaderboard'), dashboardController.getBDDrillDown);
router.get('/export-report', requirePermission('analytics.export'), dashboardController.getFullExportReport);
router.post('/bulk-upload', requirePermission('leads.upload'), dashboardController.bulkUploadLeads);
router.get('/analytics', dashboardController.getAnalytics);
router.get('/my-analytics', dashboardController.getMyAnalytics);
router.get('/day-detail', requirePermission('dashboard.day-detail'), dashboardController.getDayDetail);
router.get('/day-compare', requirePermission('dashboard.day-compare'), dashboardController.getDayCompare);
router.get('/week-compare', requirePermission('dashboard.week-compare'), dashboardController.getWeekCompare);

// Sync endpoints
router.post('/sync-all', requirePermission('sync.manage'), dashboardController.triggerFullSync);
router.get('/sync-logs', requirePermission('sync.manage'), dashboardController.getSyncLogs);

// One-time backfill: set last_activity_at from most recent Activity
router.post('/backfill-last-activity', async (req, res) => {
  if (req.user.role !== 'super_admin') return res.status(403).json({ status: 'fail', message: 'Super admin only' });
  const Activity = require('../models/Activity');
  const Lead = require('../models/Lead');
  try {
    const leads = await Lead.find({}).select('_id').lean();
    let updated = 0;
    for (const lead of leads) {
      const lastActivity = await Activity.findOne({ lead_id: lead._id })
        .sort({ created_at: -1 })
        .select('created_at')
        .lean();
      if (lastActivity) {
        await Lead.findByIdAndUpdate(lead._id, { $set: { last_activity_at: lastActivity.created_at } });
        updated++;
      }
    }
    res.json({ status: 'success', message: `Updated ${updated} leads`, updated });
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
});

module.exports = router;
