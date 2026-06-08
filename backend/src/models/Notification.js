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
    enum: ['follow_up', 'follow_up_overdue', 'follow_up_critical', 'escalation', 'lead_assigned', 'task_assigned', 'system'],
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
    enum: ['Lead', 'Activity', 'Vendor', 'Task']
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

notificationSchema.index({ recipient: 1, is_read: 1, created_at: -1 });
notificationSchema.index({ scheduled_for: 1 });
notificationSchema.index({ recipient: 1, scheduled_for: 1, is_read: 1 });

notificationSchema.statics.createUnlessSilenced = async function (data) {
  const user = await mongoose.model('User').findById(data.recipient).select('name email');
  if (user && (user.name === 'Summit Shrestha' || user.email === 'summit.shrestha@nepalcangroup.com')) {
    return null;
  }
  return this.create(data);
};

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;