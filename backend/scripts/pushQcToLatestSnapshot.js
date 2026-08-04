require('dotenv').config();
const mongoose = require('mongoose');
const ListingSnapshot = require('../src/models/ListingSnapshot');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB\n');

  const snapshot = await ListingSnapshot.findOne({ type: 'weekly' }).sort({ snapshotDate: -1 });
  if (!snapshot) {
    console.log('No weekly listing snapshot found. Nothing to do.');
    await mongoose.disconnect();
    return;
  }

  const qc = await ListingSnapshot.computeQcPrevWeek(snapshot.snapshotDate);
  const before = snapshot.previousWeek;
  snapshot.previousWeek = { ...(snapshot.previousWeek || {}), ...qc };
  await snapshot.save();

  console.log(`Latest weekly snapshot: ${snapshot.nepaliDate} (${snapshot.snapshotDate.toISOString()})`);
  console.log('Before:', JSON.stringify(before));
  console.log('After: ', JSON.stringify(snapshot.previousWeek));

  await mongoose.disconnect();
  console.log('\nDone.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
