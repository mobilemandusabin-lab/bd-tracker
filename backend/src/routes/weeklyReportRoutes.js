const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');
const reportController = require('../controllers/weeklyReportController');

const router = express.Router();

router.use(protect);

router.get('/', reportController.getReports);
router.get('/auto-fill', reportController.getAutoFill);
router.get('/:id', reportController.getReport);
router.post('/', reportController.createReport);
router.put('/:id', requirePermission('reports.manage'), reportController.updateReport);
router.delete('/:id', requirePermission('reports.manage'), reportController.deleteReport);
router.post('/:id/generate-pptx', requirePermission('reports.manage'), reportController.generatePptx);
router.post('/:id/generate-pdf', requirePermission('reports.manage'), reportController.generatePdf);

module.exports = router;
