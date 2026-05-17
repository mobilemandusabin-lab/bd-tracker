const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Lead = require('../models/Lead');
const { getVendorModel, initVendorsDB, getVendorsConnection } = require('../models/Vendor');

require('dotenv').config();

async function backupData() {
  try {
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
    const backupDir = path.join(__dirname, '../../db/backups', `${timestamp}`);
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to main database');
    
    await initVendorsDB();
    console.log('Connected to vendors database');
    
    const Vendor = await getVendorModel();
    
    console.log('Loading leads...');
    const leads = await Lead.find({}).lean();
    console.log(`Loaded ${leads.length} leads`);
    
    console.log('Loading vendors...');
    const vendors = await Vendor.find({}).lean();
    console.log(`Loaded ${vendors.length} vendors`);
    
    fs.mkdirSync(backupDir, { recursive: true });
    
    const leadsFile = path.join(backupDir, 'leads.json');
    fs.writeFileSync(leadsFile, JSON.stringify(leads, null, 2));
    console.log(`Saved leads to ${leadsFile}`);
    
    const vendorsFile = path.join(backupDir, 'vendors.json');
    fs.writeFileSync(vendorsFile, JSON.stringify(vendors, null, 2));
    console.log(`Saved vendors to ${vendorsFile}`);
    
    console.log(`\nBackup complete: ${backupDir}`);
    console.log(`Total records: ${leads.length + vendors.length}`);
    
    await mongoose.disconnect();
    const vendorsConn = getVendorsConnection();
    if (vendorsConn) await vendorsConn.close();
    process.exit(0);
  } catch (err) {
    console.error('Backup failed:', err.message);
    process.exit(1);
  }
}

backupData();