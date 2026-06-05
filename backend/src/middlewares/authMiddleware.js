const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getPermissionsForRole } = require('./permissionMiddleware');

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

// In-memory cache for User.findById — keyed by user id, TTL 30s
// Halves the DB load on protected endpoints without changing login flow
const USER_CACHE_TTL_MS = 30 * 1000;
const userCache = new Map();

function getCachedUser(userId) {
  const entry = userCache.get(String(userId));
  if (entry && Date.now() - entry.at < USER_CACHE_TTL_MS) return entry.user;
  userCache.delete(String(userId));
  return null;
}

function setCachedUser(userId, user) {
  userCache.set(String(userId), { user, at: Date.now() });
  // Soft cap to keep memory bounded
  if (userCache.size > 1000) {
    const firstKey = userCache.keys().next().value;
    if (firstKey !== undefined) userCache.delete(firstKey);
  }
}

exports.invalidateUserCache = (userId) => {
  if (userId) userCache.delete(String(userId));
  else userCache.clear();
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

    let currentUser = getCachedUser(decoded.id);

    if (!currentUser) {
      currentUser = await User.findById(decoded.id).lean();
      if (currentUser) {
        setCachedUser(decoded.id, currentUser);
      }
    }

    if (!currentUser) {
      return res.status(401).json({ status: 'fail', message: 'User no longer exists' });
    }

    // Permissions derive from role string — also cached on the user entry
    const userPermissions = currentUser._cachedPermissions || await (async () => {
      const p = await getPermissionsForRole(currentUser.role);
      currentUser._cachedPermissions = p;
      return p;
    })();

    req.user = currentUser;
    req.userPermissions = userPermissions;
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
