const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { EJSON } = require('bson');
const ExtensionDailyStat = require('../models/ExtensionDailyStat');
const {
  EXTENSION_RAW_DAYS,
  ACTIVITY_RAW_DAYS,
  ORDER_PAYLOAD_DAYS,
  LOG_RETENTION_DAYS,
  NOTIFICATION_RETENTION_DAYS,
  CHAT_RETENTION_DAYS,
  AUDIT_RETENTION_DAYS,
  daysAgo,
  dateKey
} = require('../config/retention');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const backupArg = args.find((arg) => arg.startsWith('--backup='));
const backupDir = backupArg ? path.resolve(backupArg.slice('--backup='.length)) : null;
const rollupFile = backupDir ? path.join(backupDir, `extension-rollup-${dateKey(daysAgo(EXTENSION_RAW_DAYS))}.ndjson`) : null;

const extensionCutoff = daysAgo(EXTENSION_RAW_DAYS);
const activityCutoff = daysAgo(ACTIVITY_RAW_DAYS);
const orderCutoff = daysAgo(ORDER_PAYLOAD_DAYS);
const logCutoff = daysAgo(LOG_RETENTION_DAYS);
const notificationCutoff = daysAgo(NOTIFICATION_RETENTION_DAYS);
const chatCutoff = daysAgo(CHAT_RETENTION_DAYS);
const auditCutoff = daysAgo(AUDIT_RETENTION_DAYS);

const terminalOrderStatuses = ['Delivered', 'Cancelled', 'Returned'];
const deadCollections = ['vendors', 'productreadinesses', 'weeklytargets', 'BD', 'tzprobes'];

const extensionDeleteFilter = {
  created_at: { $lt: extensionCutoff },
  event_type: { $ne: 'qc_pending' }
};
const extensionRollupFilter = {
  ...extensionDeleteFilter,
  product_id: { $ne: 'b' }
};
const activityDeleteFilter = {
  created_at: { $lt: activityCutoff },
  $or: [
    { follow_up_required: { $ne: true } },
    { status: { $nin: ['pending', 'overdue'] } }
  ]
};
const orderStripFilter = {
  createdAt: { $lt: orderCutoff },
  orderStatus: { $in: terminalOrderStatuses }
};

async function latestIds(collection, limit = 20, match = {}) {
  return collection.find(match).sort({ createdAt: -1 }).limit(limit).project({ _id: 1 }).toArray();
}

async function getDeletePlan(db) {
  const events = db.collection('extensionevents');
  const activities = db.collection('activities');
  const orders = db.collection('nepalcanorders');
  const nsl = db.collection('nepalcansynclogs');
  const ssl = db.collection('systemsynclogs');
  const jobs = db.collection('syncjobs');
  const notifications = db.collection('notifications');
  const audit = db.collection('auditlogs');
  const chats = db.collection('chatsessions');

  const nslKeep = (await latestIds(nsl)).map((x) => x._id);
  const sslKeep = (await latestIds(ssl)).map((x) => x._id);
  const jobActive = await jobs.find({ status: { $in: ['pending', 'running', 'paused'] } }).project({ _id: 1 }).toArray();
  const jobKeep = [...jobActive, ...(await latestIds(jobs))].map((x) => x._id);

  const counts = {};
  for (const name of deadCollections) {
    counts[`drop.${name}`] = await db.collection(name).countDocuments().catch(() => 0);
  }

  return {
    extensionEventsDelete: await events.countDocuments(extensionDeleteFilter),
    extensionEventsKeepQcPending: await events.countDocuments({ created_at: { $lt: extensionCutoff }, event_type: 'qc_pending' }),
    activitiesDelete: await activities.countDocuments(activityDeleteFilter),
    ordersStripPayload: await orders.countDocuments({
      ...orderStripFilter,
      $or: [{ rawData: { $exists: true } }, { trackingData: { $exists: true } }]
    }),
    nepalcanSyncLogsDelete: await nsl.countDocuments({ createdAt: { $lt: logCutoff }, _id: { $nin: nslKeep } }),
    systemSyncLogsDelete: await ssl.countDocuments({ createdAt: { $lt: logCutoff }, _id: { $nin: sslKeep } }),
    syncJobsDelete: await jobs.countDocuments({
      createdAt: { $lt: logCutoff },
      status: { $in: ['completed', 'failed', 'cancelled'] },
      _id: { $nin: jobKeep }
    }),
    notificationsDelete: await notifications.countDocuments({ is_read: true, created_at: { $lt: notificationCutoff } }),
    auditLogsDelete: await audit.countDocuments({ timestamp: { $lt: auditCutoff } }),
    chatSessionsDelete: await chats.countDocuments({ updatedAt: { $lt: chatCutoff } }),
    ...counts
  };
}

async function buildExtensionRollup(db) {
  const groups = await db.collection('extensionevents').aggregate([
    { $match: extensionRollupFilter },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } },
          user_id: '$user_id',
          event_type: '$event_type'
        },
        count: { $sum: { $ifNull: ['$bulk_count', 1] } },
        docs: { $sum: 1 }
      }
    }
  ]).toArray();

  let rows = groups.map((row) => ({
    date: row._id.date,
    user_id: row._id.user_id,
    event_type: row._id.event_type,
    count: row.count,
    docs: row.docs
  }));
  const groupedDocs = rows.reduce((sum, row) => sum + row.docs, 0);
  const rawDocs = await db.collection('extensionevents').countDocuments(extensionRollupFilter);
  if (rawDocs !== groupedDocs) {
    throw new Error(`Rollup check failed: raw=${rawDocs}, grouped=${groupedDocs}`);
  }

  if (!rollupFile) throw new Error('Rollup file requires --backup=<backup-dir>');

  if (!rows.length && fs.existsSync(rollupFile)) {
    rows = fs.readFileSync(rollupFile, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => EJSON.parse(line, { relaxed: false }));
    console.log(`  loaded existing rollup file: ${rollupFile}`);
  }

  if (rows.length && (!fs.existsSync(rollupFile) || groupedDocs > 0)) {
    fs.writeFileSync(
      rollupFile,
      `${rows.map((row) => EJSON.stringify(row, { relaxed: false })).join('\n')}\n`,
      { mode: 0o600 }
    );
  }

  return { rows, days: new Set(rows.map((row) => row.date)).size, groupedDocs, file: rollupFile };
}

async function pruneLowRisk(db) {
  const nsl = db.collection('nepalcansynclogs');
  const nslKeep = (await latestIds(nsl)).map((x) => x._id);
  const nslDeleted = await nsl.deleteMany({ createdAt: { $lt: logCutoff }, _id: { $nin: nslKeep } });
  console.log(`  nepalcan sync logs deleted: ${nslDeleted.deletedCount}`);

  const ssl = db.collection('systemsynclogs');
  const sslKeep = (await latestIds(ssl)).map((x) => x._id);
  const sslDeleted = await ssl.deleteMany({ createdAt: { $lt: logCutoff }, _id: { $nin: sslKeep } });
  console.log(`  system sync logs deleted: ${sslDeleted.deletedCount}`);

  const jobs = db.collection('syncjobs');
  const jobActive = await jobs.find({ status: { $in: ['pending', 'running', 'paused'] } }).project({ _id: 1 }).toArray();
  const jobKeep = [...jobActive, ...(await latestIds(jobs))].map((x) => x._id);
  const jobsDeleted = await jobs.deleteMany({
    createdAt: { $lt: logCutoff },
    status: { $in: ['completed', 'failed', 'cancelled'] },
    _id: { $nin: jobKeep }
  });
  console.log(`  sync jobs deleted: ${jobsDeleted.deletedCount}`);

  const notifications = await db.collection('notifications').deleteMany({
    is_read: true,
    created_at: { $lt: notificationCutoff }
  });
  console.log(`  notifications deleted: ${notifications.deletedCount}`);

  const audit = await db.collection('auditlogs').deleteMany({ timestamp: { $lt: auditCutoff } });
  console.log(`  audit logs deleted: ${audit.deletedCount}`);

  const chats = await db.collection('chatsessions').deleteMany({ updatedAt: { $lt: chatCutoff } });
  console.log(`  chat sessions deleted: ${chats.deletedCount}`);

  for (const name of deadCollections) {
    const result = await db.collection(name).drop().catch((err) => {
      if (err.codeName === 'NamespaceNotFound') return null;
      throw err;
    });
    if (result) console.log(`  dropped collection: ${name}`);
  }
}

async function applyExtensionRollup(db, rollup) {
  if (!rollup.rows.length) return { inserted: 0, ...rollup };

  const deleted = await db.collection('extensionevents').deleteMany(extensionDeleteFilter);
  console.log(`  raw extension events deleted: ${deleted.deletedCount}`);

  await ExtensionDailyStat.init();
  await ExtensionDailyStat.deleteMany({});
  for (let i = 0; i < rollup.rows.length; i += 1000) {
    await ExtensionDailyStat.insertMany(
      rollup.rows.slice(i, i + 1000).map((row) => ({
        date: row.date,
        user_id: row.user_id,
        event_type: row.event_type,
        count: row.count
      })),
      { ordered: false }
    );
  }

  const stats = await ExtensionDailyStat.aggregate([
    { $group: { _id: null, rows: { $sum: 1 }, count: { $sum: '$count' } } }
  ]);
  const inserted = stats[0] || { rows: 0, count: 0 };
  const expectedCount = rollup.rows.reduce((sum, row) => sum + row.count, 0);
  if (inserted.rows !== rollup.rows.length || inserted.count !== expectedCount) {
    throw new Error(`Stats check failed: rows=${inserted.rows}/${rollup.rows.length}, count=${inserted.count}/${expectedCount}. Rollup file: ${rollup.file}`);
  }

  return { inserted: inserted.rows, ...rollup };
}

async function applyRetention(db) {
  console.log('Building extension rollup...');
  const rollup = await buildExtensionRollup(db);
  console.log(`  rollup saved: ${rollup.file} (${rollup.days} days, ${rollup.rows.length} rows)`);

  console.log('Pruning logs and stale collections...');
  await pruneLowRisk(db);

  console.log('Deleting old extension events and writing daily stats...');
  const applied = await applyExtensionRollup(db, rollup);
  console.log(`  daily stats inserted: ${applied.inserted}`);

  const activities = await db.collection('activities').deleteMany(activityDeleteFilter);
  console.log(`  activities deleted: ${activities.deletedCount}`);

  const orders = await db.collection('nepalcanorders').updateMany(
    orderStripFilter,
    { $unset: { rawData: '', trackingData: '' } }
  );
  console.log(`  order payloads stripped: ${orders.modifiedCount}`);

  return applied;
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set');

  if (apply) {
    if (!backupDir) throw new Error('--apply requires --backup=<backup-dir>');
    const manifestPath = path.join(backupDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) throw new Error(`Backup manifest not found: ${manifestPath}`);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const names = new Set(manifest.collections.map((c) => c.name));
    const required = ['extensionevents', 'activities', 'nepalcanorders', 'nepalcansynclogs', 'systemsynclogs', 'syncjobs', 'notifications', 'auditlogs', 'chatsessions', ...deadCollections];
    const missing = required.filter((name) => !names.has(name) && !['BD', 'tzprobes'].includes(name));
    if (missing.length) throw new Error(`Backup is missing collections: ${missing.join(', ')}`);
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 15000,
    family: 4
  });
  const db = mongoose.connection.db;

  console.log(`Database: ${db.databaseName}`);
  console.log(`Extension cutoff: ${dateKey(extensionCutoff)}`);
  console.log(`Activity cutoff: ${dateKey(activityCutoff)}`);
  console.log(`Audit cutoff: ${dateKey(auditCutoff)}`);

  const plan = await getDeletePlan(db);
  console.log(JSON.stringify(plan, null, 2));

  if (!apply) {
    console.log('Dry run. Re-run with --apply --backup=<backup-dir> to delete.');
    return;
  }

  const rollup = await applyRetention(db);
  console.log(`Extension rollup: ${rollup.days} days, ${rollup.inserted} stat rows`);

  const after = await getDeletePlan(db);
  console.log('Remaining targeted data:');
  console.log(JSON.stringify(after, null, 2));
}

main()
  .then(async () => {
    await mongoose.disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
