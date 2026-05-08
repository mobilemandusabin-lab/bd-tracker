const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please provide task title'],
    trim: true,
    maxlength: [255, 'Title cannot exceed 255 characters']
  },
  description: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['Open', 'In Progress', 'Done'],
    default: 'Open'
  },
  priority: {
    type: Number,
    default: 2,
    min: [1, 'Priority must be between 1 (highest) and 5 (lowest)'],
    max: [5, 'Priority must be between 1 (highest) and 5 (lowest)']
  },
  due_date: {
    type: Date,
    default: null
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator is required']
  },
  assigned_to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    default: null
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
taskSchema.pre('save', function() {
  this.updated_at = Date.now();
});

// Index for efficient querying
taskSchema.index({ department: 1 });
taskSchema.index({ assigned_to: 1 });
taskSchema.index({ created_by: 1 });
taskSchema.index({ status: 1 });

const Task = mongoose.model('Task', taskSchema);
module.exports = Task;
