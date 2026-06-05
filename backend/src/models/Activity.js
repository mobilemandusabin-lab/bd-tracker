const mongoose = require('mongoose');
const Lead = require('./Lead');

const activitySchema = new mongoose.Schema({
  lead_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    default: null
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Please provide user ID']
  },
  activity_type: {
    type: String,
    enum: ['call', 'whatsapp', 'email', 'meeting', 'demo', 'follow_up', 'note', 'status_change'],
    required: [true, 'Please provide activity type']
  },
  description: {
    type: String,
    required: [true, 'Please provide description'],
    trim: true
  },
  follow_up_required: {
    type: Boolean,
    default: false
  },
  follow_up_date: {
    type: Date,
    default: null
  },
  follow_up_time: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'overdue'],
    default: 'completed'
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

// Update parent Lead's last_activity_at whenever an Activity is saved
// Fire-and-forget so it doesn't block the Activity save roundtrip
activitySchema.post('save', function(doc) {
  if (doc.lead_id) {
    setImmediate(() => {
      Lead.findByIdAndUpdate(doc.lead_id, { $set: { last_activity_at: doc.created_at || new Date() } }).catch(() => {});
    });
  }
});

// Indexes for common queries
activitySchema.index({ created_at: -1 });
activitySchema.index({ user_id: 1, created_at: -1 });
activitySchema.index({ lead_id: 1, created_at: -1 });
activitySchema.index({ activity_type: 1, created_at: -1 });
activitySchema.index({ follow_up_required: 1, status: 1 });

const Activity = mongoose.model('Activity', activitySchema);
module.exports = Activity;
