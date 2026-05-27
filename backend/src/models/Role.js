const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Role name is required'],
    unique: true,
    enum: ['super_admin', 'admin', 'user', 'viewer']
  },
  description: {
    type: String,
    default: ''
  },
  permissions: [{
    type: String
  }],
  created_at: {
    type: Date,
    default: Date.now
  }
});

const Role = mongoose.model('Role', roleSchema);
module.exports = Role;
