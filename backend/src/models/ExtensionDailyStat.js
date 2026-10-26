const mongoose = require('mongoose');

const extensionDailyStatSchema = new mongoose.Schema({
  date: {
    type: String,
    required: true
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  event_type: {
    type: String,
    required: true
  },
  count: {
    type: Number,
    required: true,
    default: 0
  }
});

extensionDailyStatSchema.index({ date: 1, user_id: 1, event_type: 1 }, { unique: true });
extensionDailyStatSchema.index({ user_id: 1, date: 1 });

module.exports = mongoose.model('ExtensionDailyStat', extensionDailyStatSchema);
