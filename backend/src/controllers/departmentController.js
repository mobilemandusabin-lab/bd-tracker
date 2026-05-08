const Department = require('../models/Department');
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

// Get all departments
exports.getAllDepartments = async (req, res) => {
  try {
    const departments = await Department.find().sort({ name: 1 });

    res.status(200).json({
      status: 'success',
      results: departments.length,
      data: departments
    });
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
};

// Create department (SuperAdmin only)
exports.createDepartment = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ status: 'fail', message: 'Department name is required' });
    }

    // Check for duplicate
    const existing = await Department.findOne({ name: name.trim() });
    if (existing) {
      return res.status(400).json({ status: 'fail', message: 'Department already exists' });
    }

    const department = await Department.create({ name: name.trim() });

    // Log the action
    logAction(req.user._id, 'department_created', {
      departmentId: department._id,
      name: department.name
    });

    res.status(201).json({
      status: 'success',
      data: department
    });
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
};

// Update department (SuperAdmin only)
exports.updateDepartment = async (req, res) => {
  try {
    const { name } = req.body;
    const departmentId = req.params.id;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ status: 'fail', message: 'Department name is required' });
    }

    const department = await Department.findById(departmentId);
    if (!department) {
      return res.status(404).json({ status: 'fail', message: 'Department not found' });
    }

    // Check for duplicate name
    const existing = await Department.findOne({ name: name.trim(), _id: { $ne: departmentId } });
    if (existing) {
      return res.status(400).json({ status: 'fail', message: 'Department name already exists' });
    }

    department.name = name.trim();
    await department.save();

    // Log the action
    logAction(req.user._id, 'department_updated', {
      departmentId: department._id,
      name: department.name
    });

    res.status(200).json({
      status: 'success',
      data: department
    });
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
};

// Delete department (SuperAdmin only)
exports.deleteDepartment = async (req, res) => {
  try {
    const departmentId = req.params.id;

    const department = await Department.findById(departmentId);
    if (!department) {
      return res.status(404).json({ status: 'fail', message: 'Department not found' });
    }

    // Check if department has users
    const usersInDept = await User.countDocuments({ department: departmentId });
    if (usersInDept > 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Cannot delete department with existing users. Please reassign users first.'
      });
    }

    await Department.findByIdAndDelete(departmentId);

    // Log the action
    logAction(req.user._id, 'department_deleted', {
      departmentId,
      name: department.name
    });

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
};

// Get users by department
exports.getDepartmentUsers = async (req, res) => {
  try {
    const departmentId = req.params.id;

    const users = await User.find({ department: departmentId })
      .select('name email role status')
      .sort({ name: 1 });

    res.status(200).json({
      status: 'success',
      results: users.length,
      data: users
    });
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
};

// Get users in current user's department (for admin task assignment)
exports.getDepartmentUsersForTask = async (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user._id;

    // Only admins can get department users
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({
        status: 'fail',
        message: 'Access denied'
      });
    }

    let departmentId;

    if (userRole === 'super_admin') {
      // SuperAdmin can specify department or get all users
      departmentId = req.query.department_id;
    } else {
      // Admin can only get users from their department
      departmentId = req.user.department?._id || req.user.department;
    }

    if (!departmentId) {
      return res.status(400).json({
        status: 'fail',
        message: 'Department not found'
      });
    }

    const users = await User.find({ 
      department: departmentId,
      status: 'active',
      role: 'user' // Only regular users for task assignment
    }).select('name email');

    res.status(200).json({
      status: 'success',
      results: users.length,
      data: users
    });
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
};
