const express = require('express');
const leadController = require('../controllers/leadController');
const authMiddleware = require('../middlewares/authMiddleware');
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
  .post(authMiddleware.restrictTo('super_admin', 'admin', 'user'), leadController.createLead);

// Bulk upload route
router.post('/bulk-upload',
  authMiddleware.restrictTo('super_admin', 'admin'),
  upload.single('file'),
  leadController.bulkUploadLeads
);

router.get('/check-duplicity', leadController.checkDuplicity);
router.patch('/:id/accept', leadController.acceptAssignment);
router.get('/unassigned/nepalcan', authMiddleware.restrictTo('super_admin', 'admin'), leadController.getUnassignedNepalcanLeads);
router.get('/category/:category', authMiddleware.restrictTo('super_admin', 'admin'), leadController.getLeadsByCategory);

// Active sellers route - must come before /:id route
router.get('/active-sellers', authMiddleware.restrictTo('super_admin', 'admin'), leadController.getActiveSellers);

router.route('/:id')
  .get(leadController.getLead)
  .patch(authMiddleware.restrictTo('super_admin', 'admin', 'user'), leadController.updateLead)
  .delete(authMiddleware.restrictTo('super_admin', 'admin'), leadController.deleteLead);

module.exports = router;
