const express = require('express');
const pipelineStageController = require('../controllers/pipelineStageController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(authMiddleware.protect);
router.use(authMiddleware.restrictTo('super_admin'));

router.route('/')
  .get(pipelineStageController.getAllStages)
  .post(pipelineStageController.createStage);

router.patch('/reorder', pipelineStageController.reorderStages);

router.route('/:id')
  .get(pipelineStageController.getStage)
  .patch(pipelineStageController.updateStage)
  .delete(pipelineStageController.deleteStage);

module.exports = router;