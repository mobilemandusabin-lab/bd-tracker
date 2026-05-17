const mongoose = require('mongoose');
const Lead = require('../models/Lead');

require('dotenv').config();

async function addTypeField() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const result = await Lead.updateMany(
      { type: { $exists: false } },
      { $set: { type: 'lead' } }
    );
    console.log(`Updated ${result.modifiedCount} leads with type field`);

    console.log('Done');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

addTypeField();