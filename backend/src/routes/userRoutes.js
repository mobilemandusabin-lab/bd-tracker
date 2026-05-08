const express = require('express');
const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(authMiddleware.protect);

router.route('/')
  .get(authMiddleware.restrictTo('super_admin', 'admin'), userController.getAllUsers)
  .post(authMiddleware.restrictTo('super_admin', 'admin'), userController.createUser);

router.route('/:id')
  .patch(authMiddleware.restrictTo('super_admin', 'admin'), userController.updateUser)
  .delete(authMiddleware.restrictTo('super_admin', 'admin'), userController.deleteUser);

module.exports = router;
