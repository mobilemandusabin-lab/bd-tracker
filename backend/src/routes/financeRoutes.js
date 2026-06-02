const express = require('express');
const financeController = require('../controllers/financeController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');

const router = express.Router();

router.use(authMiddleware.protect);

router.get('/summary', requirePermission('finance.view'), financeController.getSummary);
router.post('/sync', requirePermission('finance.create'), financeController.syncFromNepalcan);
router.post('/bulk-import', requirePermission('finance.create'), financeController.bulkImport);

router.route('/')
  .get(requirePermission('finance.view'), financeController.getAllFinance)
  .post(requirePermission('finance.create'), financeController.createFinance);

router.route('/:id')
  .get(requirePermission('finance.view'), financeController.getFinanceById)
  .patch(requirePermission('finance.update'), financeController.updateFinance)
  .delete(requirePermission('finance.delete'), financeController.deleteFinance);

module.exports = router;
