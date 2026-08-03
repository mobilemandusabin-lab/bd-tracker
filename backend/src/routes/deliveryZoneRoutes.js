const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');
const deliveryZoneController = require('../controllers/deliveryZoneController');

const router = express.Router();

router.get('/', protect, requirePermission('delivery-zones.view'), deliveryZoneController.getZoneGroups);
router.post('/sync', protect, requirePermission('delivery-zones.manage'), deliveryZoneController.syncZoneGroups);

module.exports = router;
