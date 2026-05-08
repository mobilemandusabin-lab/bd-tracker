const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Please provide user ID']
  },
  action_type: {
    type: String,
    required: [true, 'Please provide action type']
  },
  module_name: {
    type: String,
    required: [true, 'Please provide module name']
  },
  record_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, 'Please provide record ID']
  },
  previous_value: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  updated_value: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  ip_address: String
});

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
module.exports = AuditLog;
