const express = require('express');
const pipelineStageController = require('../controllers/pipelineStageController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');

const router = express.Router();

router.use(authMiddleware.protect);
router.use(requirePermission('pipeline.manage'));

router.route('/')
  .get(pipelineStageController.getAllStages)
  .post(pipelineStageController.createStage);

router.patch('/reorder', pipelineStageController.reorderStages);

router.route('/:id')
  .get(pipelineStageController.getStage)
  .patch(pipelineStageController.updateStage)
  .delete(pipelineStageController.deleteStage);

module.exports = router;
