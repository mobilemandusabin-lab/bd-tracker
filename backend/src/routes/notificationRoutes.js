const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware.protect);

router.get('/', notificationController.getMyNotifications);
router.get('/unread-count', notificationController.getUnreadCount);
router.get('/follow-ups/today', notificationController.getTodayFollowUps);
router.patch('/mark-all-read', notificationController.markAllAsRead);
router.patch('/:id/mark-read', notificationController.markAsRead);

module.exports = router;