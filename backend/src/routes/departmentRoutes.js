const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');
const { protect } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');

// All routes require authentication
router.use(protect);

// GET /api/v1/departments - Get all departments
router.get('/', departmentController.getAllDepartments);

// GET /api/v1/departments/:id/users - Get users in a department
router.get('/:id/users', departmentController.getDepartmentUsers);

// GET /api/v1/departments/users - Get users for task assignment
router.get('/users/for-task', requirePermission('departments.view'), departmentController.getDepartmentUsersForTask);

// POST /api/v1/departments - Create department
router.post('/', requirePermission('departments.create'), departmentController.createDepartment);

// PUT /api/v1/departments/:id - Update department
router.put('/:id', requirePermission('departments.update'), departmentController.updateDepartment);

// DELETE /api/v1/departments/:id - Delete department
router.delete('/:id', requirePermission('departments.delete'), departmentController.deleteDepartment);

module.exports = router;
