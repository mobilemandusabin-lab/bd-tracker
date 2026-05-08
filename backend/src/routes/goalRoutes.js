const express = require('express');
const goalController = require('../controllers/goalController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

// Protect all goal routes
router.use(authMiddleware.protect);

router.route('/')
  .get(goalController.getAllGoals)
  .post(authMiddleware.restrictTo('super_admin', 'admin'), goalController.createGoal);

router.route('/:id')
  .get(goalController.getGoal)
  .patch(authMiddleware.restrictTo('super_admin', 'admin'), goalController.updateGoal)
  .delete(authMiddleware.restrictTo('super_admin', 'admin'), goalController.deleteGoal);

router.route('/:id/progress')
  .patch(goalController.updateGoalProgress);

module.exports = router;