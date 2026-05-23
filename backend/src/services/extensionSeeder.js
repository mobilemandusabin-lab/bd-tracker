const ExtensionVersion = require('../models/ExtensionVersion');

const seedExtensionVersion = async () => {
  try {
    await ExtensionVersion.findOneAndUpdate(
      { is_latest: true },
      {
        version: '1.0.1',
        changelog: 'Production release — stripped debug logs, all event detection and dedup intact',
        zip_path: '/extension/extension.zip',
        is_latest: true
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    console.error('[Seed] Extension version upsert failed:', err.message);
  }
};

module.exports = seedExtensionVersion;
