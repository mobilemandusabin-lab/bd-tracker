const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const { protect } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');

router.use(protect);

router.get('/', requirePermission('users.view'), roleController.getAllRoles);
router.put('/:id', requirePermission('users.update'), roleController.updateRolePermissions);

module.exports = router;
