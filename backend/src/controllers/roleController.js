const Role = require('../models/Role');
const { invalidateCache } = require('../middlewares/permissionMiddleware');

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

// POST /roles — create a new role
exports.createRole = async (req, res) => {
  try {
    const { name, description, permissions } = req.body;

    if (!name) {
      return res.status(400).json({ status: 'fail', message: 'Role name is required' });
    }

    // Prevent creating super_admin or duplicate roles
    if (name === 'super_admin') {
      return res.status(400).json({ status: 'fail', message: 'Cannot create super_admin role' });
    }

    const existing = await Role.findOne({ name });
    if (existing) {
      return res.status(400).json({ status: 'fail', message: 'Role already exists' });
    }

    // Use raw collection to bypass any cached mongoose schema validation
    const result = await Role.collection.insertOne({
      name,
      description: description || '',
      permissions: permissions || [],
      created_at: new Date()
    });

    invalidateCache();

    const role = await Role.findById(result.insertedId);
    res.status(201).json({ status: 'success', data: { role } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// DELETE /roles/:id — delete a role
exports.deleteRole = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ status: 'fail', message: 'Role not found' });
    }
    if (role.name === 'super_admin' || role.name === 'admin' || role.name === 'user') {
      return res.status(400).json({ status: 'fail', message: 'Cannot delete built-in roles' });
    }

    await Role.findByIdAndDelete(req.params.id);
    invalidateCache();

    res.status(204).json({ status: 'success', data: null });
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

    // Use updateOne to bypass mongoose schema validation (avoids cached enum issues)
    await Role.updateOne({ _id: id }, { $set: { permissions } });
    const updated = await Role.findById(id);

    // Invalidate permission cache so changes take effect immediately
    invalidateCache();

    res.status(200).json({
      status: 'success',
      data: { role: updated }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};
