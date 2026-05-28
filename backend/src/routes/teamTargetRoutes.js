const express = require('express');
const teamTargetController = require('../controllers/teamTargetController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');

const router = express.Router();

router.use(authMiddleware.protect);

router.get('/', teamTargetController.getTargets);
router.put('/:team', requirePermission('extension.admin'), teamTargetController.updateTarget);

module.exports = router;
