const Role = require('../models/Role');

// Cache role permissions in memory (refreshed every 5 min)
let rolePermissionsCache = {};
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function loadRolePermissions() {
  const now = Date.now();
  if (now - cacheTimestamp < CACHE_TTL && Object.keys(rolePermissionsCache).length > 0) {
    return rolePermissionsCache;
  }

  try {
    const roles = await Role.find({});
    rolePermissionsCache = {};
    for (const role of roles) {
      rolePermissionsCache[role.name] = role.permissions || [];
    }
    cacheTimestamp = now;
    return rolePermissionsCache;
  } catch (err) {
    console.error('[RBAC] Failed to load role permissions:', err.message);
    return rolePermissionsCache; // return stale cache on error
  }
}

// Get permissions for a specific role
async function getPermissionsForRole(roleName) {
  const cache = await loadRolePermissions();
  return cache[roleName] || [];
}

// ── Middleware: require ANY of the listed permissions ──────────
const requirePermission = (...perms) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ status: 'fail', message: 'Not authenticated' });
      }

      // super_admin always passes — safety net
      if (req.user.role === 'super_admin') {
        return next();
      }

      // Use cached permissions from protect() if available, otherwise load
      const userPerms = req.userPermissions || await getPermissionsForRole(req.user.role);
      req.userPermissions = userPerms;

      const hasPermission = perms.some(p => userPerms.includes(p));

      if (!hasPermission) {
        return res.status(403).json({
          status: 'fail',
          message: 'You do not have permission to perform this action',
          required: perms,
          role: req.user.role
        });
      }

      next();
    } catch (err) {
      res.status(500).json({ status: 'fail', message: err.message });
    }
  };
};

// ── Middleware: require ALL of the listed permissions ──────────
const requireAllPermissions = (...perms) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ status: 'fail', message: 'Not authenticated' });
      }

      // super_admin always passes
      if (req.user.role === 'super_admin') {
        return next();
      }

      const userPerms = req.userPermissions || await getPermissionsForRole(req.user.role);
      req.userPermissions = userPerms;

      const hasAll = perms.every(p => userPerms.includes(p));

      if (!hasAll) {
        return res.status(403).json({
          status: 'fail',
          message: 'You do not have all required permissions',
          required: perms,
          role: req.user.role
        });
      }

      next();
    } catch (err) {
      res.status(500).json({ status: 'fail', message: err.message });
    }
  };
};

// Helper: check if user has a specific permission (for use in controllers)
function hasPermission(userPermissions, perm) {
  return Array.isArray(userPermissions) && userPermissions.includes(perm);
}

// Invalidate cache (call after role permissions are updated)
function invalidateCache() {
  rolePermissionsCache = {};
  cacheTimestamp = 0;
}

module.exports = {
  requirePermission,
  requireAllPermissions,
  getPermissionsForRole,
  hasPermission,
  invalidateCache,
  loadRolePermissions
};
