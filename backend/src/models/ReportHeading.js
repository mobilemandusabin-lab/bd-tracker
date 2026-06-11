const mongoose = require('mongoose');

const reportHeadingSchema = new mongoose.Schema({
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Heading name is required'],
    trim: true
  },
  key: {
    type: String,
    required: true,
    trim: true
  },
  dataType: {
    type: String,
    enum: ['number', 'percentage', 'text'],
    default: 'number'
  },
  order: {
    type: Number,
    default: 0
  },
  hasChart: {
    type: Boolean,
    default: false
  },
  hasPrevValue: {
    type: Boolean,
    default: true
  },
  hasCurrentValue: {
    type: Boolean,
    default: true
  },
  hasTargetValue: {
    type: Boolean,
    default: true
  },
  hasNotes: {
    type: Boolean,
    default: false
  },
  suffix: {
    type: String,
    default: ''
  }
}, { timestamps: true });

reportHeadingSchema.index({ departmentId: 1, order: 1 });
reportHeadingSchema.index({ departmentId: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('ReportHeading', reportHeadingSchema);
