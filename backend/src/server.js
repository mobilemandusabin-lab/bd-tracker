const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');

dotenv.config({ path: path.join(__dirname, '../.env') });
connectDB();

const app = require('./app');
const { checkOverdueFollowups, checkEscalationTriggers } = require('./services/overdueChecker');

const port = process.env.PORT || 5000;
const server = app.listen(port, () => {
  console.log(`App running on port ${port}...`);
});

// Run overdue check every 15 minutes (900000 ms)
const OVERDUE_CHECK_INTERVAL = 15 * 60 * 1000; // 15 minutes

setInterval(async () => {
  console.log('[Cron] Running overdue follow-up check...');
  const overdueCount = await checkOverdueFollowups();
  if (overdueCount > 0) {
    console.log(`[Cron] Found and processed ${overdueCount} overdue follow-ups`);
    // Also check escalation triggers
    await checkEscalationTriggers();
  }
}, OVERDUE_CHECK_INTERVAL);

// Also run once on server start (after 30 seconds to let DB connect)
setTimeout(async () => {
  console.log('[Cron] Initial overdue check...');
  await checkOverdueFollowups();
}, 30000);

process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});
