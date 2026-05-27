const express = require('express');
const activityController = require('../controllers/activityController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(authMiddleware.protect);

router.post('/', activityController.createActivity);
router.post('/log-call', activityController.logCallWithFollowupCheck);
router.patch('/followup/:activity_id/decision', activityController.handleEarlyCallDecision);
router.patch('/followup/:activity_id/cancel', activityController.handleEarlyCallDecision);
router.get('/lead/:leadId', activityController.getActivitiesByLead);
router.get('/pending-followups', activityController.getPendingFollowups);
router.get('/today', activityController.getTodayFollowups);
router.get('/auto-followups', activityController.getAutoFollowUps);

module.exports = router;
