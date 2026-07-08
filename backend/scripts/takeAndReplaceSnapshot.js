require('dotenv').config();
const mongoose = require('mongoose');
const VendorSnapshot = require('../src/models/VendorSnapshot');
const ListingSnapshot = require('../src/models/ListingSnapshot');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB\n');

  // 1. Capture fresh weekly snapshots (creates new docs for today)
  console.log('Capturing vendor weekly snapshot...');
  const vSnapshot = await VendorSnapshot.captureSnapshot('weekly');
  console.log(`  Created: ${vSnapshot.nepaliDate} (${vSnapshot.snapshotDate.toISOString().split('T')[0]})`);
  console.log(`  Vendors: ${vSnapshot.totalVendors} | Verified: ${vSnapshot.verifiedVendors} | Active: ${vSnapshot.activeSellers}`);

  console.log('\nCapturing listing weekly snapshot...');
  const lSnapshot = await ListingSnapshot.captureSnapshot('weekly', null);
  console.log(`  Created: ${lSnapshot.nepaliDate} (${lSnapshot.snapshotDate.toISOString().split('T')[0]})`);
  console.log(`  MarketProducts: ${lSnapshot.totalMarketplaceProducts} | Listings: ${lSnapshot.totalListings} | Specs: ${lSnapshot.totalSpecificationsAdded}`);

  // 2. Delete old 5 Asar 2083 weekly snapshots
  const oldDate = new Date('2026-06-19T00:00:00.000Z');
  const [vDel, lDel] = await Promise.all([
    VendorSnapshot.deleteMany({ type: 'weekly', snapshotDate: oldDate }),
    ListingSnapshot.deleteMany({ type: 'weekly', snapshotDate: oldDate }),
  ]);
  console.log(`\nDeleted ${vDel.deletedCount} old vendor weekly (5 Asar) snapshots`);
  console.log('Deleted ' + lDel.deletedCount + ' old listing weekly (5 Asar) snapshots');

  await mongoose.disconnect();
  console.log('\nDone — weekly snapshot replaced with today\'s data.');
}

main().catch(err => { console.error(err); process.exit(1); });
