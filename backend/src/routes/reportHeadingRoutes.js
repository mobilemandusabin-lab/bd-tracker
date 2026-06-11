const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');
const headingController = require('../controllers/reportHeadingController');

const router = express.Router();

router.use(protect);

router.get('/', headingController.getHeadings);
router.get('/:id', headingController.getHeading);
router.post('/', requirePermission('reports.manage'), headingController.createHeading);
router.put('/:id', requirePermission('reports.manage'), headingController.updateHeading);
router.delete('/:id', requirePermission('reports.manage'), headingController.deleteHeading);
router.patch('/reorder', requirePermission('reports.manage'), headingController.reorderHeadings);

module.exports = router;
