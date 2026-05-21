const mongoose = require('mongoose');

const qcRecordSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product is required']
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required']
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead'
  },
  status: {
    type: String,
    enum: ['passed', 'failed'],
    required: [true, 'QC status is required']
  },
  failureReason: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  inspector: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Inspector is required']
  },
  inspectedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
qcRecordSchema.index({ productId: 1 });
qcRecordSchema.index({ categoryId: 1 });
qcRecordSchema.index({ vendorId: 1 });
qcRecordSchema.index({ status: 1 });
qcRecordSchema.index({ inspector: 1 });
qcRecordSchema.index({ inspectedAt: -1 });

const QCRecord = mongoose.model('QCRecord', qcRecordSchema);
module.exports = QCRecord;
