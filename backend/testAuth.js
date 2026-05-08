const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');
require('dotenv').config({ path: './.env' });

const testAuth = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGODB_URI);
    console.log('Connected to MongoDB...');
    
    // Delete test user if exists
    await User.deleteOne({ email: 'test@gmail.com' });
    
    // Create a test user
    console.log('\n1. Creating test user...');
    const user = await User.create({
      name: 'Test User',
      email: 'test@gmail.com',
      password: 'Password@12',
      role: 'user'
    });
    console.log('User created successfully');
    console.log('Stored password (should be hashed):', user.password);
    
    // Fetch user with password
    const fetchedUser = await User.findOne({ email: 'test@gmail.com' }).select('+password');
    console.log('\n2. Fetched user password:', fetchedUser.password);
    console.log('Is password hashed (starts with $2):', fetchedUser.password.startsWith('$2'));
    
    // Test password comparison
    console.log('\n3. Testing password comparison...');
    const isMatch = await fetchedUser.comparePassword('Password@12');
    console.log('Password match result:', isMatch);
    
    // Clean up
    await User.deleteOne({ email: 'test@gmail.com' });
    console.log('\nTest completed. Cleaned up test user.');
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
};

testAuth();
