require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const ExtensionVersion = require('../src/models/ExtensionVersion');
const fs = require('fs');
const path = require('path');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    // Read version + changelog from manifest.json (single source of truth)
    const manifestPath = path.join(__dirname, '../public/extension/manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const version = manifest.version;
    const changelog = process.argv.find((a) => a.startsWith('--changelog='))
      ? process.argv.find((a) => a.startsWith('--changelog=')).split('=').slice(1).join('=')
      : `Extension v${version} — synced from manifest.json`;

    // Show what's there
    const all = await ExtensionVersion.find({}).sort({ created_at: -1 }).lean();
    console.log('Current records:');
    console.log(JSON.stringify(all, null, 2));
    console.log(`\nmanifest.json version: ${version}`);

    if (process.argv.includes('--apply')) {
      const latest = await ExtensionVersion.findOneAndUpdate(
        { is_latest: true },
        {
          version,
          changelog,
          zip_path: '/extension/download',
          is_latest: true
        },
        { new: true }
      );
      console.log('\nUpdated to:', JSON.stringify(latest, null, 2));
    } else {
      console.log('\nDry run. Re-run with --apply to commit the update.');
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
