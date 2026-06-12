const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');
const listingSnapshotController = require('../controllers/listingSnapshotController');

const router = express.Router();

router.use(protect);
router.use(requirePermission('listing.snapshots'));

router.get('/', listingSnapshotController.getSnapshots);
router.get('/live', listingSnapshotController.getLiveData);
router.get('/latest', listingSnapshotController.getLatestSnapshot);
router.get('/next-schedule', listingSnapshotController.getNextSchedule);
router.get('/compare', listingSnapshotController.getComparison);
router.post('/capture', listingSnapshotController.triggerSnapshot);
router.patch('/targets', listingSnapshotController.updateTargets);
router.delete('/', listingSnapshotController.deleteSnapshots);

module.exports = router;
