const express = require('express');
const router = express.Router();
const syncController = require('../controllers/syncController');

// POST /api/sync/process?key=... — external cron, ONE batch per call (key auth inside controller)
router.post('/process', syncController.processBatch);
router.get('/process', syncController.processBatch);

// GET /api/sync/kick?key=...&type=full — single URL pinger: create job if none + run one batch
router.get('/kick', syncController.kickSync);
router.post('/kick', syncController.kickSync);

// GET /api/sync/status?jobId=... — dashboard polling (JWT not required here; no sensitive data)
router.get('/status', syncController.getSyncStatus);
router.get('/status/:jobId', syncController.getSyncStatus);

// POST /api/sync/cancel — dashboard calls with JWT via app-level mount; key also accepted
router.post('/cancel', syncController.cancelSync);
router.post('/cancel/:jobId', syncController.cancelSync);

module.exports = router;
