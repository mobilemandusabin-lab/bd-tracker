const express = require('express');
const extensionController = require('../controllers/extensionController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');

const router = express.Router();

// Public endpoints (no auth required)
router.get('/latest-version', extensionController.getLatestVersion);
router.post('/login', extensionController.extensionLogin);

// Protected endpoints
router.use(authMiddleware.protect);

router.get('/download', extensionController.downloadExtension);
router.post('/register', extensionController.registerDevice);
router.post('/heartbeat', extensionController.heartbeat);
router.post('/activity-log', extensionController.logActivity);

// Admin-only endpoints
router.delete('/qc-pending', requirePermission('extension.admin'), extensionController.deleteQcPending);
router.delete('/events/user/:userId', requirePermission('extension.admin'), extensionController.deleteUserEvents);
router.delete('/events/:eventId', requirePermission('extension.admin'), extensionController.deleteEvent);
router.patch('/events/:eventId', requirePermission('extension.admin'), extensionController.patchEvent);
router.get('/devices', requirePermission('extension.admin'), extensionController.getDevices);
router.get('/stats', requirePermission('extension.admin'), extensionController.getStats);
router.get('/analytics', extensionController.getAnalytics);
router.get('/analytics/details', extensionController.getAnalyticsDetails);
router.get('/my-stats', extensionController.getMyStats);

// Operational Goals
router.get('/operational-goals', extensionController.getOperationalGoals);
router.put('/operational-goals', requirePermission('extension.admin'), extensionController.updateOperationalGoal);
router.delete('/operational-goals/:id', requirePermission('extension.admin'), extensionController.deleteOperationalGoal);
router.get('/user/:userId/detail', extensionController.getUserDetail);
router.get('/team-performance', extensionController.getTeamPerformance);
router.get('/debug', requirePermission('extension.admin'), extensionController.debugEvents);

module.exports = router;
