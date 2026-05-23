const ExtensionVersion = require('../models/ExtensionVersion');

const seedExtensionVersion = async () => {
  try {
    const existing = await ExtensionVersion.findOne({ is_latest: true });
    if (!existing) {
      await ExtensionVersion.create({
        version: '1.0.1',
        changelog: 'Production release — stripped debug logs, all event detection and dedup intact',
        zip_path: '/extension/extension.zip',
        is_latest: true
      });
    } else if (existing.version !== '1.0.1') {
      existing.version = '1.0.1';
      existing.changelog = 'Production release — stripped debug logs, all event detection and dedup intact';
      await existing.save();
    }
  } catch (err) {}
};

module.exports = seedExtensionVersion;
