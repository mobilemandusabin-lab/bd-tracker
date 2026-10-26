const path = require('path');
const mongoose = require('mongoose');
const NepalcanOrder = require('../models/NepalcanOrder');
const { fetchOrderDetail, normalizeOrderDetail } = require('../services/nepalcanOrderDetailService');
const { loginToNepalcan } = require('../services/nepalcanAuthService');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const force = args.includes('--force');
const limitArg = args.find((arg) => arg.startsWith('--limit='));
const orderArg = args.find((arg) => arg.startsWith('--order='));
const concurrencyArg = args.find((arg) => arg.startsWith('--concurrency='));
const limit = limitArg ? Math.max(1, parseInt(limitArg.slice('--limit='.length), 10) || 0) : 0;
const orderId = orderArg ? orderArg.slice('--order='.length) : null;
const concurrency = Math.min(20, Math.max(1, parseInt(concurrencyArg?.slice('--concurrency='.length), 10) || 5));

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set');

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 15000,
    family: 4
  });

  const query = { nepalcanId: { $exists: true, $ne: null } };
  if (!force) query.detailData = null;
  if (orderId) query.orderId = orderId;

  let findQuery = NepalcanOrder.find(query)
    .select('_id orderId nepalcanId detailData')
    .sort({ _id: 1 });
  if (limit) findQuery = findQuery.limit(limit);
  const orders = await findQuery.lean();

  console.log(`Orders to fetch: ${orders.length}${force ? ' (force refresh)' : ' (missing detail only)'}`);
  console.log(`Concurrency: ${concurrency}`);
  if (!apply) {
    console.log('Dry run. Re-run with --apply to fetch and save Commerce order details.');
    return;
  }

  await loginToNepalcan();
  let processed = 0;
  let updated = 0;
  let failed = 0;
  const errors = [];

  for (let i = 0; i < orders.length; i += concurrency) {
    const chunk = orders.slice(i, i + concurrency);
    const fetchedAt = new Date();
    const results = await Promise.allSettled(chunk.map(async (order) => {
      const raw = await fetchOrderDetail(order.nepalcanId);
      return { order, detail: normalizeOrderDetail(raw) };
    }));

    const ops = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const { order, detail } = result.value;
        ops.push({
          updateOne: {
            filter: { _id: order._id },
            update: { $set: { detailData: detail, detailFetchedAt: fetchedAt } }
          }
        });
        updated++;
      } else {
        failed++;
        const order = chunk[index];
        const message = result.reason?.response?.data?.message || result.reason?.message || 'Unknown error';
        errors.push(`${order?.orderId || order?._id}: ${message}`);
      }
    });

    if (ops.length) await NepalcanOrder.bulkWrite(ops, { ordered: false });
    processed += chunk.length;
    if (processed % 100 === 0 || processed === orders.length) {
      console.log(`Progress: ${processed}/${orders.length} updated=${updated} failed=${failed}`);
    }
  }

  console.log(`Done: processed=${processed} updated=${updated} failed=${failed}`);
  if (errors.length) {
    console.log('Errors:');
    for (const error of errors.slice(0, 20)) console.log(`  ${error}`);
    if (errors.length > 20) console.log(`  ... ${errors.length - 20} more`);
  }
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
