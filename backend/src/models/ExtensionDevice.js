const mongoose = require('mongoose');

const extensionDeviceSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Please provide user ID']
  },
  device_id: {
    type: String,
    required: [true, 'Please provide device ID'],
    trim: true
  },
  extension_version: {
    type: String,
    default: '1.0.0'
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  last_heartbeat: {
    type: Date,
    default: Date.now
  },
  registered_at: {
    type: Date,
    default: Date.now
  }
});

extensionDeviceSchema.index({ user_id: 1, device_id: 1 }, { unique: true });

const ExtensionDevice = mongoose.model('ExtensionDevice', extensionDeviceSchema);
module.exports = ExtensionDevice;
