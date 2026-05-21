const express = require('express');
const { protect, restrictTo } = require('../middlewares/authMiddleware');
const deliveryZoneController = require('../controllers/deliveryZoneController');

const router = express.Router();

router.use(protect);
router.use(restrictTo('super_admin'));

router.get('/', deliveryZoneController.getZoneGroups);
router.post('/sync', deliveryZoneController.syncZoneGroups);

module.exports = router;
