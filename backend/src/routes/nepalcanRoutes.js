const express = require('express');
const router = express.Router();
const nepalcanController = require('../controllers/nepalcanController');
const authMiddleware = require('../middlewares/authMiddleware');

// All routes require authentication
router.use(authMiddleware.protect);
router.use(authMiddleware.restrictTo('super_admin'));

// Login to Nepalcan.com
router.post('/login', nepalcanController.loginToNepalcan);

// Get sales/orders data
router.get('/sales', nepalcanController.getNepalcanSales);

module.exports = router;
