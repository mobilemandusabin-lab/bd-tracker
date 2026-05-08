const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Role hierarchy: higher number = more privileges
const ROLE_HIERARCHY = {
  'user': 1,
  'admin': 2,
  'super_admin': 3
};

exports.ROLE_HIERARCHY = ROLE_HIERARCHY;

// Check if user has required role or higher
const hasRole = (userRole, requiredRoles) => {
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  return requiredRoles.some(role => {
    const requiredLevel = ROLE_HIERARCHY[role] || 0;
    return userLevel >= requiredLevel;
  });
};

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
    const currentUser = await User.findById(decoded.id);

    if (!currentUser) {
      return res.status(401).json({ status: 'fail', message: 'User no longer exists' });
    }

    req.user = currentUser;
    next();
  } catch (err) {
    res.status(401).json({ status: 'fail', message: 'Invalid token' });
  }
};

// Restrict to specific roles OR higher roles in hierarchy
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!hasRole(req.user.role, roles)) {
      return res.status(403).json({
        status: 'fail',
        message: 'You do not have permission to perform this action'
      });
    }
    next();
  };
};

// Get users that the current user can manage (for assignment dropdown)
exports.getManageableUsers = (req) => {
  const userRole = req.user.role;
  
  if (userRole === 'super_admin') {
    // Can assign to anyone
    return {}; // empty filter = all users
  }
  
  if (userRole === 'admin') {
    // Can assign to 'user' role only
    return { role: 'user' };
  }
  
  // Regular users can't assign to others
  return { _id: req.user._id };
};
