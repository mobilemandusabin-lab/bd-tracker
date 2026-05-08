const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config({ path: './.env' });

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB for seeding...');

    const email = 'sabeen684@gmail.com';
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      console.log('User already exists. Updating to Super Admin...');
      existingUser.role = 'super_admin';
      existingUser.password = 'Sabins@12'; // Will be hashed by pre-save hook
      await existingUser.save();
      console.log('Super Admin updated successfully.');
    } else {
      await User.create({
        name: 'Sabeen Admin',
        email: email,
        password: 'Sabins@12',
        role: 'super_admin'
      });
      console.log('Super Admin created successfully.');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error seeding admin:', err.message);
    process.exit(1);
  }
};

seedAdmin();
