const express = require('express');
const pipelineStageController = require('../controllers/pipelineStageController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');

const router = express.Router();

router.use(authMiddleware.protect);

// GET is available to all authenticated users (for filters/dropdowns)
router.route('/')
  .get(pipelineStageController.getAllStages)
  .post(requirePermission('pipeline.manage'), pipelineStageController.createStage);

router.patch('/reorder', requirePermission('pipeline.manage'), pipelineStageController.reorderStages);

router.route('/:id')
  .get(pipelineStageController.getStage)
  .patch(requirePermission('pipeline.manage'), pipelineStageController.updateStage)
  .delete(requirePermission('pipeline.manage'), pipelineStageController.deleteStage);

module.exports = router;
