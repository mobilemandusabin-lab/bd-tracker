const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['follow_up', 'follow_up_overdue', 'follow_up_critical', 'escalation', 'lead_assigned', 'system'],
    default: 'system'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  related_id: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'related_model'
  },
  related_model: {
    type: String,
    enum: ['Lead', 'Activity', 'Vendor']
  },
  is_read: {
    type: Boolean,
    default: false
  },
  scheduled_for: {
    type: Date,
    default: Date.now
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;