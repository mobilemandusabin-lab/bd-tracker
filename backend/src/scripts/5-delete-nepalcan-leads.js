const mongoose = require('mongoose');
const Lead = require('../models/Lead');

require('dotenv').config();

async function deleteNepalcanLeads() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const count = await Lead.countDocuments({ lead_source: 'Nepalcan' });
    console.log(`Found ${count} leads with lead_source='Nepalcan'`);

    if (count === 0) {
      console.log('No leads to delete');
      process.exit(0);
    }

    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(`Are you sure you want to delete these ${count} leads? (yes/no): `, async (answer) => {
      if (answer.toLowerCase() === 'yes') {
        const result = await Lead.deleteMany({ lead_source: 'Nepalcan' });
        console.log(`Deleted ${result.deletedCount} leads`);
      } else {
        console.log('Deletion cancelled');
      }
      process.exit(0);
    });
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

deleteNepalcanLeads();