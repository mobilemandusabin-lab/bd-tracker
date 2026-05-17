const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Lead = require('../models/Lead');
const { getVendorModel } = require('../models/Vendor');
const Activity = require('../models/Activity');
const Notification = require('../models/Notification');
const Task = require('../models/Task');
const AuditLog = require('../models/AuditLog');
const ProductReadiness = require('../models/ProductReadiness');

dotenv.config({ path: 'backend/.env' });

const resetDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB for database reset...');

    console.log('Clearing Lead Repository...');
    await Lead.deleteMany({});
    
    console.log('Clearing Onboarded Vendors...');
    const Vendor = await getVendorModel();
    await Vendor.deleteMany({});
    
    console.log('Clearing Activity Logs...');
    await Activity.deleteMany({});
    
    console.log('Clearing System Notifications...');
    await Notification.deleteMany({});
    
    console.log('Clearing Tasks...');
    await Task.deleteMany({});
    
    console.log('Clearing Audit Logs...');
    await AuditLog.deleteMany({});
    
    console.log('Clearing Product Readiness data...');
    await ProductReadiness.deleteMany({});

    console.log('Database reset completed successfully. Ready for production.');
    process.exit(0);
  } catch (err) {
    console.error('Error during database reset:', err.message);
    process.exit(1);
  }
};

resetDB();
