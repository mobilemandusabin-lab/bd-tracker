const mongoose = require('mongoose');

const operationalGoalSchema = new mongoose.Schema({
  team: {
    type: String,
    enum: ['listing', 'qc'],
    required: [true, 'Team is required']
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // null = team-wide default
  },
  listing_target: {
    type: Number,
    default: 0,
    min: [0, 'Target cannot be negative']
  },
  spec_target: {
    type: Number,
    default: 0,
    min: [0, 'Target cannot be negative']
  },
  qc_target: {
    type: Number,
    default: 0,
    min: [0, 'Target cannot be negative']
  },
  qc_enabled: {
    type: Boolean,
    default: false
  },
  updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

operationalGoalSchema.pre('save', function () {
  this.updated_at = Date.now();
});

operationalGoalSchema.index({ team: 1, user_id: 1 }, { unique: true });

module.exports = mongoose.model('OperationalGoal', operationalGoalSchema);
