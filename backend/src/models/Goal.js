const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please provide goal title'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  target_value: {
    type: Number,
    required: [true, 'Please provide target value'],
    min: [0, 'Target value must be positive']
  },
  current_value: {
    type: Number,
    default: 0
  },
  unit: {
    type: String,
    default: 'leads',
    enum: ['leads', 'conversions', 'revenue', 'activities', 'calls']
  },
  pipeline_stage: {
    type: String,
    enum: [
      'New', 'Contacted', 'Interested', 'Meeting Scheduled', 
      'Negotiation', 'Document Pending', 'Verification', 
      'Onboarding', 'Activated', 'Active Seller', 'Lost', 'all'
    ],
    default: 'all'
  },
  period: {
    type: String,
    required: [true, 'Please provide period'],
    enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
    default: 'monthly'
  },
  start_date: {
    type: Date,
    required: [true, 'Please provide start date']
  },
  end_date: {
    type: Date,
    required: [true, 'Please provide end date']
  },
  assigned_to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Please assign goal to a user']
  },
  set_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Please specify who set the goal']
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'failed', 'paused'],
    default: 'active'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

// Update updated_at on every save
goalSchema.pre('save', function() {
  this.updated_at = Date.now();
});

// Calculate progress percentage
goalSchema.virtual('progress_percentage').get(function() {
  if (this.target_value === 0) return 0;
  return Math.min(100, Math.round((this.current_value / this.target_value) * 100));
});

// Check if goal is achieved
goalSchema.virtual('is_achieved').get(function() {
  return this.current_value >= this.target_value;
});

const Goal = mongoose.model('Goal', goalSchema);
module.exports = Goal;