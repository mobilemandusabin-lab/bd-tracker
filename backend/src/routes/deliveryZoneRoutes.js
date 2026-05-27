const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');
const deliveryZoneController = require('../controllers/deliveryZoneController');

const router = express.Router();

router.use(protect);
router.use(requirePermission('delivery-zones.manage'));

router.get('/', deliveryZoneController.getZoneGroups);
router.post('/sync', deliveryZoneController.syncZoneGroups);

module.exports = router;
