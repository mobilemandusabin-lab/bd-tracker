const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const { protect } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');

router.use(protect);

router.get('/', requirePermission('users.view'), roleController.getAllRoles);
router.post('/', requirePermission('users.create'), roleController.createRole);
router.put('/:id', requirePermission('users.update'), roleController.updateRolePermissions);
router.delete('/:id', requirePermission('users.delete'), roleController.deleteRole);

module.exports = router;
