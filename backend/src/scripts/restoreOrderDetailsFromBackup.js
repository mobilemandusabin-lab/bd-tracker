const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const readline = require('readline');
const mongoose = require('mongoose');
const { EJSON } = require('bson');
const NepalcanOrder = require('../models/NepalcanOrder');
const { normalizeOrderDetail } = require('../services/nepalcanOrderDetailService');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const args = process.argv.slice(2);
const backupDirArg = args.find((arg) => !arg.startsWith('--'));
const apply = args.includes('--apply');

async function main() {
  if (!backupDirArg) {
    throw new Error('Usage: node src/scripts/restoreOrderDetailsFromBackup.js <backup-dir> [--apply]');
  }
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set');

  const backupFile = path.join(path.resolve(backupDirArg), 'nepalcanorders.ndjson.gz');
  if (!fs.existsSync(backupFile)) throw new Error(`Backup file not found: ${backupFile}`);

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 15000,
    family: 4
  });

  const orders = await NepalcanOrder.find({
    $or: [{ detailData: null }, { 'detailData.items.0': { $exists: false } }]
  }).select('_id orderId detailData').lean();
  const ids = new Set(orders.map((order) => order.orderId));
  console.log(`Orders missing Commerce detail or items: ${orders.length}`);

  const backups = new Map();
  const lines = readline.createInterface({
    input: fs.createReadStream(backupFile).pipe(zlib.createGunzip()),
    crlfDelay: Infinity
  });
  for await (const line of lines) {
    if (!line.trim()) continue;
    const doc = EJSON.parse(line, { relaxed: false });
    if (ids.has(doc.orderId)) backups.set(doc.orderId, doc);
  }

  const updates = [];
  const fetchedAt = new Date();
  let restoredNew = 0, filledItems = 0;
  for (const order of orders) {
    const backup = backups.get(order.orderId);
    if (!backup) continue;
    const source = backup.rawData || backup.trackingData || {};
    const backupDetail = normalizeOrderDetail(source);
    if (!backupDetail.items?.length) continue;

    const set = {};
    if (backup.rawData) set.rawData = backup.rawData;
    if (backup.trackingData) set.trackingData = backup.trackingData;
    if (!order.detailData) {
      set.detailData = { ...backupDetail, detailSource: 'backup' };
      set.detailFetchedAt = fetchedAt;
      restoredNew++;
    } else {
      set['detailData.items'] = backupDetail.items;
      filledItems++;
    }
    updates.push({ updateOne: { filter: { _id: order._id }, update: { $set: set } } });
  }

  console.log(`Backup matches: ${updates.length} (new: ${restoredNew}, filled items: ${filledItems})`);
  if (!apply) {
    console.log('Dry run. Re-run with --apply to restore missing details/items from backup.');
    return;
  }

  if (updates.length) await NepalcanOrder.bulkWrite(updates, { ordered: false });
  console.log(`Restored ${updates.length} order details from backup.`);
}

main()
  .then(async () => {
    await mongoose.disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
