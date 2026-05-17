const mongoose = require('mongoose');

const pipelineStageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide stage name'],
    unique: true,
    trim: true
  },
  category: {
    type: String,
    enum: ['lead', 'vendor'],
    default: 'lead'
  },
  order: {
    type: Number,
    required: true
  },
  color: {
    type: String,
    default: '#3B82F6'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

pipelineStageSchema.index({ order: 1 });

module.exports = mongoose.model('PipelineStage', pipelineStageSchema);