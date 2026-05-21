const mongoose = require('mongoose');

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
    enum: ['call', 'whatsapp', 'email', 'meeting', 'demo', 'follow_up', 'note'],
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

const Activity = mongoose.model('Activity', activitySchema);
module.exports = Activity;
