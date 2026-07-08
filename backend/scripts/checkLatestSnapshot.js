require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

// Load models
const VendorSnapshot = require('../src/models/VendorSnapshot');
const ListingSnapshot = require('../src/models/ListingSnapshot');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB\n');

  // Vendor snapshots
  const [vWeekly, vMonthly] = await Promise.all([
    VendorSnapshot.findOne({ type: 'weekly' }).sort({ snapshotDate: -1 }),
    VendorSnapshot.findOne({ type: 'monthly' }).sort({ snapshotDate: -1 }),
  ]);

  const fmt = (d, c) => `${d.nepaliDate} (${d.snapshotDate.toISOString()}) created at ${c.toISOString()}`;

  console.log('=== Vendor Snapshots ===');
  if (vWeekly) {
    console.log(` Weekly latest:  ${fmt(vWeekly, vWeekly.createdAt)}`);
    console.log(`   Vendors: ${vWeekly.totalVendors} | Verified: ${vWeekly.verifiedVendors} | Active Sellers: ${vWeekly.activeSellers}`);
  } else {
    console.log(' Weekly latest:  (none)');
  }
  if (vMonthly) {
    console.log(` Monthly latest: ${fmt(vMonthly, vMonthly.createdAt)}`);
    console.log(`   Vendors: ${vMonthly.totalVendors} | Verified: ${vMonthly.verifiedVendors} | Active Sellers: ${vMonthly.activeSellers}`);
  } else {
    console.log(' Monthly latest: (none)');
  }

  // Listing snapshots
  const [lWeekly, lMonthly] = await Promise.all([
    ListingSnapshot.findOne({ type: 'weekly' }).sort({ snapshotDate: -1 }),
    ListingSnapshot.findOne({ type: 'monthly' }).sort({ snapshotDate: -1 }),
  ]);

  console.log('\n=== Listing Snapshots ===');
  if (lWeekly) {
    console.log(` Weekly latest:  ${fmt(lWeekly, lWeekly.createdAt)}`);
    console.log(`   MarketProducts: ${lWeekly.totalMarketplaceProducts} | Listings: ${lWeekly.totalListings} | Specs: ${lWeekly.totalSpecificationsAdded}`);
  } else {
    console.log(' Weekly latest:  (none)');
  }
  if (lMonthly) {
    console.log(` Monthly latest: ${fmt(lMonthly, lMonthly.createdAt)}`);
    console.log(`   MarketProducts: ${lMonthly.totalMarketplaceProducts} | Listings: ${lMonthly.totalListings} | Specs: ${lMonthly.totalSpecificationsAdded}`);
  } else {
    console.log(' Monthly latest: (none)');
  }

  await mongoose.disconnect();
  console.log('\nDone.');
}

main().catch(err => { console.error(err); process.exit(1); });
