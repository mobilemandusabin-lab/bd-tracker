const express = require('express');
const { protect, restrictTo } = require('../middlewares/authMiddleware');
const vendorSnapshotController = require('../controllers/vendorSnapshotController');

const router = express.Router();

router.use(protect);
router.use(restrictTo('super_admin'));

router.get('/', vendorSnapshotController.getSnapshots);
router.get('/latest', vendorSnapshotController.getLatestSnapshot);
router.get('/compare', vendorSnapshotController.getComparison);
router.post('/capture', vendorSnapshotController.triggerSnapshot);

module.exports = router;
