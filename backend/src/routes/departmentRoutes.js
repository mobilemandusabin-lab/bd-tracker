const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');
const { protect, restrictTo } = require('../middlewares/authMiddleware');

// All routes require authentication
router.use(protect);

// GET /api/v1/departments - Get all departments
router.get('/', departmentController.getAllDepartments);

// GET /api/v1/departments/:id/users - Get users in a department
router.get('/:id/users', departmentController.getDepartmentUsers);

// GET /api/v1/departments/users - Get users for task assignment
router.get('/users/for-task', restrictTo('admin', 'super_admin'), departmentController.getDepartmentUsersForTask);

// POST /api/v1/departments - Create department (SuperAdmin only)
router.post('/', restrictTo('super_admin'), departmentController.createDepartment);

// PUT /api/v1/departments/:id - Update department (SuperAdmin only)
router.put('/:id', restrictTo('super_admin'), departmentController.updateDepartment);

// DELETE /api/v1/departments/:id - Delete department (SuperAdmin only)
router.delete('/:id', restrictTo('super_admin'), departmentController.deleteDepartment);

module.exports = router;
