const express = require('express');
const leadController = require('../controllers/leadController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');
const multer = require('multer');

const router = express.Router();

// Configure multer for file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv' // .csv
    ];
    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel and CSV files are allowed.'));
    }
  }
});

router.use(authMiddleware.protect);

router.route('/')
  .get(leadController.getAllLeads)
  .post(requirePermission('leads.create'), leadController.createLead);

// Bulk upload route
router.post('/bulk-upload',
  requirePermission('leads.upload'),
  upload.single('file'),
  leadController.bulkUploadLeads
);

router.get('/check-duplicity', requirePermission('leads.check-duplicity'), leadController.checkDuplicity);
router.patch('/:id/accept', leadController.acceptAssignment);
router.get('/unassigned/nepalcan', requirePermission('leads.view'), leadController.getUnassignedNepalcanLeads);
router.get('/category/:category', requirePermission('leads.view'), leadController.getLeadsByCategory);

// Handover / bulk transfer routes - must come before /:id route
router.get('/handover-preview', requirePermission('leads.assign'), leadController.handoverPreview);
router.post('/bulk-transfer', requirePermission('leads.assign'), leadController.bulkTransfer);

// Active sellers route - must come before /:id route
router.get('/active-sellers', requirePermission('leads.view'), leadController.getActiveSellers);

router.route('/:id')
  .get(leadController.getLead)
  .patch(requirePermission('leads.update'), leadController.updateLead)
  .delete(requirePermission('leads.delete'), leadController.deleteLead);

module.exports = router;
