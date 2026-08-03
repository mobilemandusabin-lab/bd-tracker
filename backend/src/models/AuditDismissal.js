const mongoose = require('mongoose');

const auditDismissalSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  dismissedAt: { type: Date, default: Date.now },
  dismissedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

module.exports = mongoose.model('AuditDismissal', auditDismissalSchema);
