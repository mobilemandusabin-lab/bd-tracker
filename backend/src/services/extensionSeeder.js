const ExtensionVersion = require('../models/ExtensionVersion');

const seedExtensionVersion = async () => {
  try {
    const existing = await ExtensionVersion.findOne({ is_latest: true });
    if (!existing) {
      await ExtensionVersion.create({
        version: '1.0.0',
        changelog: 'Initial release — captures listing, QC approve/reject, and product update events',
        zip_path: '/extension/extension.zip',
        is_latest: true
      });
      console.log('[Seed] Extension version 1.0.0 created');
    }
  } catch (err) {
    console.error('[Seed] Extension version seeding failed:', err.message);
  }
};

module.exports = seedExtensionVersion;
