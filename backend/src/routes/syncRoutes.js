const express = require('express');
const router = express.Router();
const syncController = require('../controllers/syncController');

// POST /api/sync/start — Create sync job and trigger first batch
router.post('/start', syncController.startSync);

// POST /api/sync/process — Process one batch and schedule next
router.post('/process', syncController.processBatch);

// GET /api/sync/status/:jobId — Check sync job status
router.get('/status/:jobId', syncController.getSyncStatus);

// POST /api/sync/cancel/:jobId — Cancel running sync
router.post('/cancel/:jobId', syncController.cancelSync);

module.exports = router;