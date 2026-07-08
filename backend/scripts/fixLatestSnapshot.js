require('dotenv').config();
const mongoose = require('mongoose');
const VendorSnapshot = require('../src/models/VendorSnapshot');
const ListingSnapshot = require('../src/models/ListingSnapshot');
const Lead = require('../src/models/Lead');
const NepalcanOrder = require('../src/models/NepalcanOrder');
const ExtensionEvent = require('../src/models/ExtensionEvent');
const NepaliDate = require('nepali-date-converter').default;

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB\n');

  const [vendorSnap, listingSnap] = await Promise.all([
    VendorSnapshot.findOne({ type: 'weekly' }).sort({ snapshotDate: -1 }),
    ListingSnapshot.findOne({ type: 'weekly' }).sort({ snapshotDate: -1 }),
  ]);

  if (!vendorSnap && !listingSnap) {
    console.log('No weekly snapshots found. Nothing to fix.');
    await mongoose.disconnect();
    return;
  }

  if (vendorSnap) {
    console.log(`Vendor weekly: ${vendorSnap.nepaliDate} (${vendorSnap.snapshotDate.toISOString()})`);
    console.log(`  Created at: ${vendorSnap.createdAt.toISOString()}`);
  }
  if (listingSnap) {
    console.log(`Listing weekly: ${listingSnap.nepaliDate} (${listingSnap.snapshotDate.toISOString()})`);
    console.log(`  Created at: ${listingSnap.createdAt.toISOString()}`);
  }
  console.log('');

  if (vendorSnap) {
    console.log('Recalculating vendor data...');
    const [totalVendors, verifiedVendors, activeSellerAgg] = await Promise.all([
      Lead.countDocuments({ type: 'vendor' }),
      Lead.countDocuments({
        type: 'vendor',
        $or: [{ is_verified: true }, { verification_status: 'verified' }]
      }),
      NepalcanOrder.aggregate([
        { $match: { orderStatus: 'Delivered' } },
        { $group: { _id: '$vendor_lead_id' } },
        { $count: 'total' }
      ])
    ]);
    const activeSellers = activeSellerAgg.length > 0 ? activeSellerAgg[0].total : 0;

    vendorSnap.totalVendors = totalVendors;
    vendorSnap.verifiedVendors = verifiedVendors;
    vendorSnap.activeSellers = activeSellers;
    await vendorSnap.save();
    console.log(`  Updated: ${totalVendors} vendors, ${verifiedVendors} verified, ${activeSellers} active sellers\n`);
  }

  if (listingSnap) {
    console.log('Recalculating listing data...');

    const refDate = new Date(listingSnap.snapshotDate);
    const startDate = new Date(refDate);
    startDate.setDate(startDate.getDate() - ((startDate.getDay() + 7 - 0) % 7));
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 5);
    endDate.setHours(23, 59, 59, 999);

    console.log(`  Date range: ${startDate.toISOString()} → ${endDate.toISOString()}`);

    const [specEvents, listingEvents, verifiedProductsAgg] = await Promise.all([
      ExtensionEvent.aggregate([
        { $match: { event_type: 'spec_added', created_at: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$bulk_count', 1] } } } }
      ]),
      ExtensionEvent.aggregate([
        { $match: { event_type: 'listing_created', created_at: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: null, totalListings: { $sum: { $ifNull: ['$bulk_count', 1] } } } }
      ]),
      Lead.aggregate([
        {
          $match: {
            type: 'vendor',
            $or: [{ is_verified: true }, { verification_status: 'verified' }]
          }
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: {
                $max: [
                  { $ifNull: ['$total_products_listed', 0] },
                  { $ifNull: ['$expected_product_count', 0] }
                ]
              }
            }
          }
        }
      ])
    ]);

    let totalMarketplaceProducts;
    try {
      const { fetchTotalMarketplaceProducts } = require('../src/services/nepalcanSyncService');
      totalMarketplaceProducts = await fetchTotalMarketplaceProducts();
    } catch {
      totalMarketplaceProducts = verifiedProductsAgg.length > 0 ? verifiedProductsAgg[0].total : 0;
    }

    const verifiedMarketplaceProducts = verifiedProductsAgg.length > 0 ? verifiedProductsAgg[0].total : 0;
    const totalSpecificationsAdded = specEvents.length > 0 ? specEvents[0].total : 0;
    const weeklyListings = listingEvents.length > 0 ? listingEvents[0].totalListings : 0;
    const dailyAverageListings = Math.round(weeklyListings / 6);

    listingSnap.totalMarketplaceProducts = totalMarketplaceProducts;
    listingSnap.verifiedMarketplaceProducts = verifiedMarketplaceProducts;
    listingSnap.totalListings = weeklyListings;
    listingSnap.dailyAverageListings = dailyAverageListings;
    listingSnap.totalSpecificationsAdded = totalSpecificationsAdded;
    await listingSnap.save();

    console.log(`  Updated: ${totalMarketplaceProducts} products, ${weeklyListings} listings, ${totalSpecificationsAdded} specs`);
    console.log(`  Daily avg: ${dailyAverageListings}`);
  }

  await mongoose.disconnect();
  console.log('\nDone — latest weekly snapshots updated with current data.');
}

main().catch(err => { console.error(err); process.exit(1); });
