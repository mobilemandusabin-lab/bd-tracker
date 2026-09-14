const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');

dotenv.config({ path: path.join(__dirname, '../.env') });
connectDB().catch(err => {
  console.error('[Server] connectDB failed:', err.message);
  process.exit(1);
});

const app = require('./app');
const seedPipelineStages = require('./services/pipelineStageSeeder');
const seedExtensionVersion = require('./services/extensionSeeder');
const { startSnapshotScheduler } = require('./services/snapshotScheduler');

const port = process.env.PORT || 5000;
const server = app.listen(port, '0.0.0.0', async () => {
  console.log(`App running on port ${port}...`);
  await seedPipelineStages();
  await seedExtensionVersion();
  startSnapshotScheduler();

  // Release stale worker leases on startup so cron can reclaim them —
  // never run sync work from startup itself. SyncJob in MongoDB is source of truth.
  try {
    const SyncJob = require('./models/SyncJob');
    const staleAt = new Date(Date.now() - (parseInt(process.env.SYNC_STALE_AFTER) || 300) * 1000);
    const r = await SyncJob.updateMany(
      { status: 'running', $or: [{ lease_until: { $lt: new Date() } }, { last_heartbeat_at: { $lt: staleAt } }] },
      { $set: { lease_until: null, worker_id: null, last_heartbeat_at: new Date() } }
    );
    if (r.modifiedCount) console.log(`[Startup] Released ${r.modifiedCount} stale sync lease(s)`);
  } catch (err) {
    console.error('[Startup] Failed to release stale sync leases:', err.message);
  }
});

process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});
