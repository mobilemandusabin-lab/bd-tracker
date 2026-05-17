const mongoose = require('mongoose');
const { getVendorModel, getVendorsConnection } = require('../models/Vendor');

require('dotenv').config();

async function dropVendors() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to main database');

    const Vendor = await getVendorModel();
    console.log('Connected to vendors database');

    const vendorsConnection = getVendorsConnection();
    await vendorsConnection.dropCollection('vendors');
    console.log('Vendors collection dropped');

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

dropVendors();