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

  // Reset any stale running syncs on startup
  try {
    const SystemSyncLog = require('./models/SystemSyncLog');
    const stale = await SystemSyncLog.findOne({ status: 'running' });
    if (stale) {
      stale.status = 'failed';
      stale.success = false;
      stale.errorMessage = 'Auto-reset on server restart';
      await stale.save();
      console.log('[Startup] Reset stale running sync from', stale.createdAt);
    }
  } catch (err) {
    console.error('[Startup] Failed to reset stale syncs:', err.message);
  }

  // Run full sync on startup (after 30s to let DB connect)
  setTimeout(async () => {
    try {
      const { runFullSync } = require('./services/unifiedSyncService');
      console.log('[Startup] Running initial full sync...');
      await runFullSync('startup');
    } catch (err) {
      console.error('[Startup] Initial sync failed:', err.message);
    }
  }, 30000);
});

process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});
