const User = require('../models/User');

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort('-created_at');
    res.status(200).json({ status: 'success', data: { users } });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    // RBAC: Admins cannot create super_admin or viewer (finance) roles
    if (req.user.role === 'admin' && (req.body.role === 'super_admin' || req.body.role === 'viewer')) {
      return res.status(403).json({
        status: 'fail',
        message: 'Managers do not have permission to create Super Admin or Finance roles'
      });
    }

    const newUser = await User.create({
      name: req.body.name,
      email: req.body.email,
      password: req.body.password,
      role: req.body.role || 'user',
      status: req.body.status || 'active',
      team: req.body.team || null
    });

    newUser.password = undefined;

    res.status(201).json({
      status: 'success',
      data: { user: newUser }
    });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ status: 'fail', message: 'User not found' });
    }

    // RBAC: Admins cannot update to super_admin or viewer roles, or update existing super_admins
    if (req.user.role === 'admin') {
      if (user.role === 'super_admin' || req.body.role === 'super_admin' || req.body.role === 'viewer') {
        return res.status(403).json({
          status: 'fail',
          message: 'Managers do not have permission to manage Super Admin or Finance roles'
        });
      }
    }

    // Manually update fields to trigger pre-save hook for password
    if (req.body.name) user.name = req.body.name;
    if (req.body.email) user.email = req.body.email;
    if (req.body.role) user.role = req.body.role;
    if (req.body.status) user.status = req.body.status;
    if (req.body.password) user.password = req.body.password;
    if (req.body.team !== undefined) user.team = req.body.team || null;

    await user.save();

    res.status(200).json({ status: 'success', data: { user } });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ status: 'fail', message: 'User not found' });
    }

    // RBAC: Admins cannot delete Super Admins or Finance roles
    if (req.user.role === 'admin' && (user.role === 'super_admin' || user.role === 'viewer')) {
      return res.status(403).json({
        status: 'fail',
        message: 'Managers do not have permission to delete Super Admin or Finance roles'
      });
    }

    await User.findByIdAndDelete(req.params.id);
    res.status(204).json({ status: 'success', data: null });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};
