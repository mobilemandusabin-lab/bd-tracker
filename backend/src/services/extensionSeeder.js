const ExtensionVersion = require('../models/ExtensionVersion');
const fs = require('fs');
const path = require('path');

const seedExtensionVersion = async () => {
  try {
    const manifestPath = path.join(__dirname, '../../public/extension/manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const version = manifest.version || '1.0.0';

    await ExtensionVersion.findOneAndUpdate(
      { is_latest: true },
      {
        version,
        changelog: `Extension v${version} — auto-synced from manifest.json`,
        zip_path: '/extension/download',
        is_latest: true
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    console.error('[Seed] Extension version upsert failed:', err.message);
  }
};

module.exports = seedExtensionVersion;
