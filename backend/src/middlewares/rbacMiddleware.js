const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Authentication middleware
exports.protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ status: 'fail', message: 'You are not logged in' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const currentUser = await User.findById(decoded.id).populate('department');

    if (!currentUser) {
      return res.status(401).json({ status: 'fail', message: 'User no longer exists' });
    }

    req.user = currentUser;
    next();
  } catch (err) {
    res.status(401).json({ status: 'fail', message: 'Invalid token' });
  }
};

// Role-based access control middleware
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'fail',
        message: 'You do not have permission to perform this action'
      });
    }
    next();
  };
};

// Check if user is SuperAdmin
exports.isSuperAdmin = (req, res, next) => {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({
      status: 'fail',
      message: 'This action requires SuperAdmin privileges'
    });
  }
  next();
};

// Check if user is Admin
exports.isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({
      status: 'fail',
      message: 'This action requires Admin privileges'
    });
  }
  next();
};

// Department constraint middleware - ensures admin can only assign to same department
exports.checkDepartmentConstraint = async (req, res, next) => {
  try {
    const { assigned_to, department_id } = req.body;
    
    // If no assignment specified, skip check
    if (!assigned_to) {
      return next();
    }

    const userRole = req.user.role;
    
    // SuperAdmin can assign to any admin
    if (userRole === 'super_admin') {
      const targetUser = await User.findById(assigned_to);
      if (!targetUser) {
        return res.status(404).json({ status: 'fail', message: 'Target user not found' });
      }
      if (targetUser.role !== 'admin') {
        return res.status(403).json({
          status: 'fail',
          message: 'SuperAdmin can only assign tasks to Admin users'
        });
      }
      return next();
    }

    // Admin can only assign to users in their department
    if (userRole === 'admin') {
      const targetUser = await User.findById(assigned_to).populate('department');
      if (!targetUser) {
        return res.status(404).json({ status: 'fail', message: 'Target user not found' });
      }
      
      const adminDepartment = req.user.department?._id?.toString() || req.user.department?.toString();
      const targetDepartment = targetUser.department?._id?.toString() || targetUser.department?.toString();
      
      if (adminDepartment !== targetDepartment) {
        return res.status(403).json({
          status: 'fail',
          message: 'You can only assign tasks to users in your department'
        });
      }
      
      // Admin cannot assign to other admins
      if (targetUser.role === 'admin') {
        return res.status(403).json({
          status: 'fail',
          message: 'Admin cannot assign tasks to other admins. Use tickets for cross-department communication.'
        });
      }
      
      return next();
    }

    // Regular users cannot assign tasks
    if (userRole === 'user') {
      return res.status(403).json({
        status: 'fail',
        message: 'You do not have permission to assign tasks'
      });
    }

    next();
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
};

// Validate ticket creation - only admin to admin
exports.validateTicketCreation = async (req, res, next) => {
  try {
    const { to_admin_id } = req.body;
    const userRole = req.user.role;

    // Only admins and super admins can create tickets
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({
        status: 'fail',
        message: 'Only admins can create tickets'
      });
    }

    // Check if target user is an admin
    const targetUser = await User.findById(to_admin_id);
    if (!targetUser) {
      return res.status(404).json({ status: 'fail', message: 'Target admin not found' });
    }

    if (targetUser.role !== 'admin' && targetUser.role !== 'super_admin') {
      return res.status(403).json({
        status: 'fail',
        message: 'Tickets can only be sent to admins'
      });
    }

    // Cannot create ticket to self
    if (to_admin_id === req.user._id.toString()) {
      return res.status(400).json({
        status: 'fail',
        message: 'Cannot create ticket to yourself'
      });
    }

    next();
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
};
