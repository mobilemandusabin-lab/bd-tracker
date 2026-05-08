const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { protect, restrictTo } = require('../middlewares/authMiddleware');

// All routes require authentication
router.use(protect);

// GET /api/v1/tasks - Get all tasks based on role
router.get('/', taskController.getAllTasks);

// GET /api/v1/tasks/admin - Get tasks for admin (with view toggle)
router.get('/admin', restrictTo('admin', 'super_admin'), taskController.getAdminTasks);

// GET /api/v1/tasks/:id - Get single task
router.get('/:id', taskController.getTask);

// POST /api/v1/tasks - Create new task
router.post('/', restrictTo('admin', 'super_admin'), taskController.createTask);

// PUT /api/v1/tasks/:id - Update task
router.put('/:id', taskController.updateTask);

// DELETE /api/v1/tasks/:id - Delete task
router.delete('/:id', restrictTo('admin', 'super_admin'), taskController.deleteTask);

module.exports = router;
