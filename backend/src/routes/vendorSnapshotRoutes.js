const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');
const vendorSnapshotController = require('../controllers/vendorSnapshotController');

const router = express.Router();

router.use(protect);
router.use(requirePermission('vendors.snapshots'));

router.get('/', vendorSnapshotController.getSnapshots);
router.get('/live', vendorSnapshotController.getLiveData);
router.get('/latest', vendorSnapshotController.getLatestSnapshot);
router.get('/next-schedule', vendorSnapshotController.getNextSchedule);
router.get('/compare', vendorSnapshotController.getComparison);
router.post('/capture', vendorSnapshotController.triggerSnapshot);
router.patch('/targets', vendorSnapshotController.updateTargets);
router.delete('/', vendorSnapshotController.deleteSnapshots);

module.exports = router;
