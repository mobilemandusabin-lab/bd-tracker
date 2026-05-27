const express = require('express');
const goalController = require('../controllers/goalController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');

const router = express.Router();

// Protect all goal routes
router.use(authMiddleware.protect);

router.route('/')
  .get(goalController.getAllGoals)
  .post(requirePermission('goals.create'), goalController.createGoal);

router.route('/:id')
  .get(goalController.getGoal)
  .patch(requirePermission('goals.update'), goalController.updateGoal)
  .delete(requirePermission('goals.delete'), goalController.deleteGoal);

router.route('/:id/progress')
  .patch(goalController.updateGoalProgress);

module.exports = router;
