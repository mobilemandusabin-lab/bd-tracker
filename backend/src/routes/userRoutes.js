const express = require('express');
const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');

const router = express.Router();

router.use(authMiddleware.protect);

router.route('/')
  .get(requirePermission('users.view'), userController.getAllUsers)
  .post(requirePermission('users.create'), userController.createUser);

router.route('/:id')
  .patch(requirePermission('users.update'), userController.updateUser)
  .delete(requirePermission('users.delete'), userController.deleteUser);

module.exports = router;
