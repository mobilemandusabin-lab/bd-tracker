// Recompute the dashboard running totals from the orders collection.
//
// Usage: node src/scripts/rebuildOrderStats.js
const path = require('path');
const mongoose = require('mongoose');
const { rebuildOrderStats } = require('../services/nepalcanOrderStatsService');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set');

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 15000,
    family: 4
  });

  const result = await rebuildOrderStats();
  console.log('Order stats rebuilt:', result);
}

main()
  .catch((error) => {
    console.error('Rebuild failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
