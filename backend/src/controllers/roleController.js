const Role = require('../models/Role');
const { invalidateCache, DEFAULT_ROLE_PERMISSIONS } = require('../config/permissions');

// GET /roles — list all roles with permissions
exports.getAllRoles = async (req, res) => {
  try {
    const roles = await Role.find({}).sort({ name: 1 });
    res.status(200).json({
      status: 'success',
      data: { roles }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// PUT /roles/:id — update role permissions
exports.updateRolePermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body;

    if (!Array.isArray(permissions)) {
      return res.status(400).json({ status: 'fail', message: 'permissions must be an array of strings' });
    }

    const role = await Role.findById(id);
    if (!role) {
      return res.status(404).json({ status: 'fail', message: 'Role not found' });
    }

    // Don't allow editing super_admin permissions
    if (role.name === 'super_admin') {
      return res.status(403).json({ status: 'fail', message: 'Cannot modify super_admin permissions' });
    }

    role.permissions = permissions;
    await role.save();

    // Invalidate permission cache so changes take effect immediately
    invalidateCache();

    res.status(200).json({
      status: 'success',
      data: { role }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};
