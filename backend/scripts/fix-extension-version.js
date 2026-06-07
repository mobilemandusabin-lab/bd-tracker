require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const ExtensionVersion = require('../src/models/ExtensionVersion');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    // Show what's there
    const all = await ExtensionVersion.find({}).sort({ created_at: -1 }).lean();
    console.log('Current records:');
    console.log(JSON.stringify(all, null, 2));

    if (process.argv.includes('--apply')) {
      // Find the is_latest record (there should be exactly one) and update it
      const latest = await ExtensionVersion.findOneAndUpdate(
        { is_latest: true },
        {
          version: '1.0.4',
          changelog: 'Extension v1.0.4 — rolled back from 1.0.8',
          zip_path: '/extension/download',
          is_latest: true
        },
        { new: true }
      );
      console.log('Updated to:', JSON.stringify(latest, null, 2));
    } else {
      console.log('\nDry run. Re-run with --apply to commit the update.');
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
