const Task = require('../models/Task');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

// Logging helper
const logAction = async (userId, action, details) => {
  try {
    await AuditLog.create({
      user: userId,
      action,
      details,
      created_at: new Date()
    });
  } catch (err) {
    console.error('Failed to log action:', err);
  }
};

// Get all tasks based on user role
exports.getAllTasks = async (req, res) => {
  try {
    const { department_id, status } = req.query;
    const userRole = req.user.role;
    const userId = req.user._id;
    let query = {};

    // Role-based filtering
    if (userRole === 'super_admin') {
      // SuperAdmin can view all tasks, optionally filter by department
      if (department_id) {
        query.department = department_id;
      }
    } else if (userRole === 'admin') {
      // Admin can view all tasks in their department
      const adminDepartment = req.user.department?._id || req.user.department;
      if (adminDepartment) {
        query.department = adminDepartment;
      }
    } else {
      // Regular user can only view their own tasks
      query.assigned_to = userId;
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    const tasks = await Task.find(query)
      .populate('created_by', 'name email')
      .populate('assigned_to', 'name email')
      .populate('department', 'name')
      .sort({ created_at: -1 });

    res.status(200).json({
      status: 'success',
      results: tasks.length,
      data: tasks
    });
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
};

// Get tasks for Admin - toggle between My Tasks and All Department Tasks
exports.getAdminTasks = async (req, res) => {
  try {
    const { view } = req.query; // 'my' or 'all'
    const userRole = req.user.role;
    const userId = req.user._id;
    let query = {};

    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({
        status: 'fail',
        message: 'Admin access required'
      });
    }

    const adminDepartment = req.user.department?._id || req.user.department;

    if (view === 'my') {
      // Show tasks created by or assigned to this admin
      query.$or = [
        { created_by: userId },
        { assigned_to: userId }
      ];
    } else {
      // Show all department tasks
      if (adminDepartment) {
        query.department = adminDepartment;
      }
    }

    const tasks = await Task.find(query)
      .populate('created_by', 'name email')
      .populate('assigned_to', 'name email')
      .populate('department', 'name')
      .sort({ created_at: -1 });

    res.status(200).json({
      status: 'success',
      results: tasks.length,
      data: tasks
    });
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
};

// Get single task
exports.getTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('created_by', 'name email')
      .populate('assigned_to', 'name email')
      .populate('department', 'name');

    if (!task) {
      return res.status(404).json({ status: 'fail', message: 'Task not found' });
    }

    res.status(200).json({
      status: 'success',
      data: task
    });
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
};

// Create new task
exports.createTask = async (req, res) => {
  try {
    const { title, description, assigned_to, priority, due_date, department_id } = req.body;
    const userRole = req.user.role;
    const userId = req.user._id;

    // Validation
    if (!title || title.trim().length === 0) {
      return res.status(400).json({ status: 'fail', message: 'Title is required' });
    }

    if (title.length > 255) {
      return res.status(400).json({ status: 'fail', message: 'Title cannot exceed 255 characters' });
    }

    // Determine department and assignee
    let taskDepartment = department_id;
    let assignee = assigned_to;

    if (userRole === 'super_admin') {
      // SuperAdmin must assign to Admin
      if (!assigned_to) {
        return res.status(400).json({ status: 'fail', message: 'SuperAdmin must assign a task to an Admin' });
      }
      const targetUser = await User.findById(assigned_to);
      if (!targetUser || targetUser.role !== 'admin') {
        return res.status(403).json({
          status: 'fail',
          message: 'SuperAdmin can only assign tasks to Admin users'
        });
      }
      taskDepartment = targetUser.department?._id || targetUser.department;
    } else if (userRole === 'admin') {
      // Admin can only assign to users in same department
      if (!assigned_to) {
        return res.status(400).json({ status: 'fail', message: 'Please assign a user to the task' });
      }
      const targetUser = await User.findById(assigned_to);
      if (!targetUser) {
        return res.status(404).json({ status: 'fail', message: 'Assigned user not found' });
      }
      
      const adminDepartment = req.user.department?._id?.toString() || req.user.department?.toString();
      const targetDepartment = targetUser.department?._id?.toString() || targetUser.department?.toString();
      
      if (adminDepartment !== targetDepartment) {
        return res.status(403).json({
          status: 'fail',
          message: 'You can only assign tasks to users in your department'
        });
      }
      
      taskDepartment = adminDepartment;
    } else {
      // Regular users cannot create tasks
      return res.status(403).json({
        status: 'fail',
        message: 'You do not have permission to create tasks'
      });
    }

    const task = await Task.create({
      title,
      description,
      assigned_to: assignee,
      priority: priority || 2,
      due_date,
      department: taskDepartment,
      created_by: userId
    });

    await task.populate('created_by', 'name email');
    await task.populate('assigned_to', 'name email');
    await task.populate('department', 'name');

    // Log the action
    logAction(userId, 'task_created', {
      taskId: task._id,
      title: task.title,
      assigned_to: assignee
    });

    res.status(201).json({
      status: 'success',
      data: task
    });
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
};

// Update task
exports.updateTask = async (req, res) => {
  try {
    const { status, priority, due_date, description, updated_at } = req.body;
    const taskId = req.params.id;
    const userId = req.user._id;
    const userRole = req.user.role;

    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({ status: 'fail', message: 'Task not found' });
    }

    // Authorization check
    const isCreator = task.created_by?.toString() === userId.toString();
    const isAssignee = task.assigned_to?.toString() === userId.toString();
    const isSuperAdmin = userRole === 'super_admin';

    if (!isCreator && !isAssignee && !isSuperAdmin) {
      return res.status(403).json({
        status: 'fail',
        message: 'You do not have permission to update this task'
      });
    }

    // Optimistic locking check
    if (updated_at) {
      const taskUpdatedAt = new Date(task.updated_at).getTime();
      const clientUpdatedAt = new Date(updated_at).getTime();
      
      if (taskUpdatedAt > clientUpdatedAt) {
        return res.status(409).json({
          status: 'fail',
          message: 'Conflict: Task was modified by another user',
          serverUpdatedAt: task.updated_at
        });
      }
    }

    // Update fields
    if (status) task.status = status;
    if (priority) task.priority = priority;
    if (due_date) task.due_date = due_date;
    if (description !== undefined) task.description = description;

    await task.save();
    await task.populate('created_by', 'name email');
    await task.populate('assigned_to', 'name email');
    await task.populate('department', 'name');

    // Log the action
    logAction(userId, 'task_updated', {
      taskId: task._id,
      changes: { status, priority, due_date, description }
    });

    res.status(200).json({
      status: 'success',
      data: task
    });
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
};

// Delete task
exports.deleteTask = async (req, res) => {
  try {
    const taskId = req.params.id;
    const userId = req.user._id;
    const userRole = req.user.role;

    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({ status: 'fail', message: 'Task not found' });
    }

    // Authorization check
    const isCreator = task.created_by?.toString() === userId.toString();
    const isSuperAdmin = userRole === 'super_admin';

    // Only SuperAdmin or task creator (if admin) can delete
    if (!isSuperAdmin && !(isCreator && userRole === 'admin')) {
      return res.status(403).json({
        status: 'fail',
        message: 'You do not have permission to delete this task'
      });
    }

    await Task.findByIdAndDelete(taskId);

    // Log the action
    logAction(userId, 'task_deleted', {
      taskId,
      title: task.title
    });

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
};
