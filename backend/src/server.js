const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');

dotenv.config({ path: path.join(__dirname, '../.env') });
connectDB();

const app = require('./app');
const seedPipelineStages = require('./services/pipelineStageSeeder');
const seedExtensionVersion = require('./services/extensionSeeder');

const port = process.env.PORT || 5000;
const server = app.listen(port, '0.0.0.0', async () => {
  console.log(`App running on port ${port}...`);
  await seedPipelineStages();
  await seedExtensionVersion();

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
