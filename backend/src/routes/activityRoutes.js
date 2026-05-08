const express = require('express');
const activityController = require('../controllers/activityController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(authMiddleware.protect);

router.post('/', activityController.createActivity);
router.get('/lead/:leadId', activityController.getActivitiesByLead);
router.get('/pending-followups', activityController.getPendingFollowups);
router.get('/today', activityController.getTodayFollowups);

module.exports = router;
