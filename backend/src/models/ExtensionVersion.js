const mongoose = require('mongoose');

const extensionVersionSchema = new mongoose.Schema({
  version: {
    type: String,
    required: [true, 'Please provide version number'],
    trim: true
  },
  changelog: {
    type: String,
    trim: true,
    default: ''
  },
  zip_path: {
    type: String,
    default: '/extension/download'
  },
  is_latest: {
    type: Boolean,
    default: true
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

const ExtensionVersion = mongoose.model('ExtensionVersion', extensionVersionSchema);
module.exports = ExtensionVersion;
