const express = require('express');
const { 
  syncNepalcanOrders, 
  getNepalcanOrders, 
  getNepalcanStats,
  fetchFromNepalcan,
  getNepalcanOrderById
} = require('../controllers/nepalcanOrderController');
const { protect, restrictTo } = require('../middlewares/authMiddleware');

const router = express.Router();

// All routes require authentication and super_admin role
router.use(protect);
router.use(restrictTo('super_admin'));

// Sync orders from Nepalcan to database
router.post('/sync', syncNepalcanOrders);

// Get orders with filtering
router.get('/orders', getNepalcanOrders);

// Get statistics and processing times
router.get('/stats', getNepalcanStats);

// Get single order by ID with status history
router.get('/order/:id', getNepalcanOrderById);

// Fetch orders directly from Nepalcan API
router.post('/fetch', fetchFromNepalcan);

module.exports = router;
