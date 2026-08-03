const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');
const providerPricingController = require('../controllers/providerPricingController');

const router = express.Router();

router.get('/', protect, requirePermission('provider-pricing.view'), providerPricingController.listPricing);
router.post('/sync', protect, requirePermission('provider-pricing.manage'), providerPricingController.syncPricing);
router.get('/resolve', protect, providerPricingController.resolvePricingForOrder);

module.exports = router;
