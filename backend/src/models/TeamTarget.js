const mongoose = require('mongoose');

const teamTargetSchema = new mongoose.Schema({
  team: {
    type: String,
    enum: ['listing', 'qc'],
    required: true,
    unique: true
  },
  daily_target: {
    type: Number,
    required: true,
    default: 30,
    min: [1, 'Target must be at least 1']
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

teamTargetSchema.pre('save', function() {
  this.updated_at = Date.now();
});

module.exports = mongoose.model('TeamTarget', teamTargetSchema);
