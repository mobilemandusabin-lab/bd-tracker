const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const { getVendorModel, initVendorsDB } = require('../models/Vendor');

require('dotenv').config();

async function deleteUnassigned() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to main database');

    await initVendorsDB();
    console.log('Connected to vendors database');

    const Vendor = await getVendorModel();

    const leadDeleteResult = await Lead.deleteMany({ assigned_user: { $exists: false } });
    console.log(`Deleted ${leadDeleteResult.deletedCount} unassigned leads`);

    const vendorDeleteResult = await Vendor.deleteMany({ assigned_user: { $exists: false } });
    console.log(`Deleted ${vendorDeleteResult.deletedCount} unassigned vendors`);

    console.log('Cleanup complete');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

deleteUnassigned();