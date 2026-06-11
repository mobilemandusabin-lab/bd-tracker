const mongoose = require('mongoose');

const sectionValueSchema = new mongoose.Schema({
  headingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ReportHeading'
  },
  headingName: { type: String },
  headingKey: { type: String },
  previousValue: { type: mongoose.Schema.Types.Mixed, default: null },
  currentValue: { type: mongoose.Schema.Types.Mixed, default: null },
  targetValue: { type: mongoose.Schema.Types.Mixed, default: null }
}, { _id: false });

const reportSectionSchema = new mongoose.Schema({
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true
  },
  departmentName: { type: String },
  order: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  values: [sectionValueSchema]
}, { _id: false });

const weeklyReportSchema = new mongoose.Schema({
  weekStart: {
    type: Date,
    required: true
  },
  weekEnd: {
    type: Date,
    required: true
  },
  nepaliDate: {
    type: String,
    required: true
  },
  nepaliYear: {
    type: Number
  },
  nepaliMonth: {
    type: Number
  },
  title: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastEditedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  sections: [reportSectionSchema],
  summary: {
    totalVendors: { type: Number, default: 0 },
    totalVerifiedVendors: { type: Number, default: 0 },
    totalMarketplaceProducts: { type: Number, default: 0 },
    dailyAverageListings: { type: Number, default: 0 }
  }
}, { timestamps: true });

weeklyReportSchema.index({ weekStart: -1 });
weeklyReportSchema.index({ weekEnd: -1 });
weeklyReportSchema.index({ status: 1, weekStart: -1 });
weeklyReportSchema.index({ weekStart: 1, weekEnd: 1 }, { unique: true });

module.exports = mongoose.model('WeeklyReport', weeklyReportSchema);
