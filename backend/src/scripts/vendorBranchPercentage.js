require('dotenv').config({ path: '/home/sabin/Desktop/Projects/BD Tracker/backend/.env' });
const mongoose = require('mongoose');
const Lead = require('/home/sabin/Desktop/Projects/BD Tracker/backend/src/models/Lead');

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set in environment');
    process.exit(1);
  }

  await mongoose.connect(uri);

  const vendors = await Lead.find({ type: 'vendor', 'service_branches.0': { $exists: true } }).lean();

  const branchMap = new Map();
  const noBranch = new Set();

  for (const v of vendors) {
    const branches = v.service_branches || [];
    if (branches.length === 0) {
      noBranch.add(String(v._id));
      continue;
    }
    const seen = new Set();
    for (const b of branches) {
      const key = (b.name || b.branchId || 'Unnamed').trim();
      if (!seen.has(key)) {
        seen.add(key);
        branchMap.set(key, (branchMap.get(key) || 0) + 1);
      }
    }
  }

  const totalVendors = vendors.length;
  const rows = Array.from(branchMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({
      branch: name,
      vendor_count: count,
      percentage: `${((count / totalVendors) * 100).toFixed(1)}%`
    }));

  console.log(JSON.stringify({ total_vendors: totalVendors, service_branches: rows }, null, 2));

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
