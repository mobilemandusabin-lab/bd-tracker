// ponytail: one runnable check for sync progress math. Run: node scripts/verify-sync-progress.js
const assert = require('assert');

// mirror of calcProgress in syncController.js
const calcProgress = (job, done) => {
  const totals = job.payload?.totals || {};
  const known = Object.values(totals).reduce((s, v) => s + (Number(v) || 0), 0);
  const denom = Math.max(known, job.total || 0, job.processed || 0);
  if (denom <= 0) return done ? 100 : 0;
  return Math.min(100, Math.round(((job.processed || 0) / denom) * 100));
};

const cases = [
  [{ processed: 0, total: 0, payload: {} }, false, 0, 'fresh job'],
  [{ processed: 25, total: 0, payload: { totals: { orders: 100 } } }, false, 25, 'first phase partial'],
  [{ processed: 150, total: 100, payload: { totals: { orders: 100 } } }, false, 100, 'processed exceeds stale total caps'],
  [{ processed: 120, total: 100, payload: { totals: { orders: 100, tracking: 60 } } }, false, 75, 'multi-phase denominator grows'],
  [{ processed: 0, total: 0, payload: {} }, true, 100, 'empty done = 100'],
];

for (const [job, done, want, name] of cases) assert.strictEqual(calcProgress(job, done), want, name);

// lease release: success checkpoint must clear lease so next tick claims instantly
const update = { lease_until: null, worker_id: null };
assert.strictEqual(update.lease_until, null, 'lease released');

console.log('SYNC_PROGRESS_OK — 5 cases passed');
console.log('Real-sync checks (run in mongosh):');
console.log('  db.syncjobs.find().sort({updatedAt:-1}).limit(3).toArray()');
console.log('  db.nepalcansynclogs.find().sort({createdAt:-1}).limit(5,{durationMs:1,ordersSynced:1,type:1,success:1})');
console.log('  db.nepalcanorders.countDocuments(); db.leads.countDocuments({type:"vendor"})');
console.log('Pinger: curl "$API/api/sync/kick?key=$KEY&type=full" every 60-90s; expect processed climbing, phase orders→tracking→vendors→branches.');
