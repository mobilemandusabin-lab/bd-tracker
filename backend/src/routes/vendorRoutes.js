const express = require('express');
const vendorController = require('../controllers/vendorController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(authMiddleware.protect);

router.get('/', vendorController.getVendors);
router.get('/:id', vendorController.getVendor);
router.patch('/:id', authMiddleware.restrictTo('super_admin', 'admin', 'user'), vendorController.updateVendor);

module.exports = router;
