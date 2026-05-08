const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Lead = require('../models/Lead');
const Activity = require('../models/Activity');
const Notification = require('../models/Notification');

dotenv.config({ path: './.env' });

const setupFreshDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB (nepalcan database)...');

    // Clear all existing data
    console.log('Clearing all existing data...');
    await User.deleteMany({});
    await Lead.deleteMany({});
    await Activity.deleteMany({});
    await Notification.deleteMany({});
    console.log('All data cleared successfully.');

    // Create fresh Super Admin
    const email = 'sabeen684@gmail.com';
    const password = 'Password@12';
    
    const superAdmin = await User.create({
      name: 'Sabeen Admin',
      email: email,
      password: password,
      role: 'super_admin',
      status: 'active'
    });
    
    console.log('Fresh Super Admin created successfully:');
    console.log('Email:', email);
    console.log('Password: Password@12');
    console.log('Role:', superAdmin.role);
    console.log('\nYou can now log in with these credentials.');

    process.exit(0);
  } catch (err) {
    console.error('Error setting up database:', err.message);
    process.exit(1);
  }
};

setupFreshDatabase();
