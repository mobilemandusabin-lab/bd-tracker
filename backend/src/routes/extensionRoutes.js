const express = require('express');
const extensionController = require('../controllers/extensionController');
const authMiddleware = require('../middlewares/authMiddleware');

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
router.delete('/qc-pending', authMiddleware.restrictTo('super_admin', 'admin'), extensionController.deleteQcPending);
router.get('/devices', authMiddleware.restrictTo('super_admin', 'admin'), extensionController.getDevices);
router.get('/stats', authMiddleware.restrictTo('super_admin', 'admin'), extensionController.getStats);
router.get('/analytics', authMiddleware.restrictTo('super_admin', 'admin'), extensionController.getAnalytics);
router.get('/debug', authMiddleware.restrictTo('super_admin', 'admin'), extensionController.debugEvents);

module.exports = router;
