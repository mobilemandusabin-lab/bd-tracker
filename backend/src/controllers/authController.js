const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getPermissionsForRole } = require('../middlewares/permissionMiddleware');

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

const createSendToken = async (user, statusCode, res) => {
  const token = signToken(user._id);
  user.password = undefined;

  // Resolve permissions from role
  const permissions = await getPermissionsForRole(user.role);

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user: {
        ...user.toObject(),
        permissions
      }
    }
  });
};

exports.signup = async (req, res) => {
  try {
    const newUser = await User.create({
      name: req.body.name,
      email: req.body.email,
      password: req.body.password,
      role: req.body.role || 'user'
    });

    await createSendToken(newUser, 201, res);
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ status: 'fail', message: 'Provide email and password' });
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({ status: 'fail', message: 'User not registered. Please sign up first.' });
    }

    const isPasswordCorrect = await user.comparePassword(password);
    
    if (!isPasswordCorrect) {
      return res.status(401).json({ status: 'fail', message: 'Incorrect email or password' });
    }

    user.last_login = Date.now();
    await user.save({ validateBeforeSave: false });

    await createSendToken(user, 200, res);
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const permissions = req.userPermissions || await getPermissionsForRole(user.role);

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          ...user.toObject(),
          permissions
        }
      }
    });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};
