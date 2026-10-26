const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { pipeline } = require('stream/promises');
const mongoose = require('mongoose');
const { EJSON } = require('bson');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(__dirname, '../../backups', stamp);

const writeLine = (stream, line) => new Promise((resolve, reject) => {
  stream.write(line, (err) => (err ? reject(err) : resolve()));
});

const connect = () => mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 15000,
  family: 4
});

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set');

  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  await connect();
  const db = mongoose.connection.db;
  const names = (await db.listCollections({}, { nameOnly: true }).toArray())
    .map((c) => c.name)
    .filter((name) => !name.startsWith('system.'))
    .sort();

  const manifest = {
    version: 1,
    createdAt: new Date().toISOString(),
    database: db.databaseName,
    backupDir,
    collections: [],
    restore: {
      command: 'cd backend && node src/scripts/restoreDb.js <backup-dir> --apply',
      selected: 'cd backend && node src/scripts/restoreDb.js <backup-dir> --only=activities,extensionevents --apply',
      replace: 'cd backend && node src/scripts/restoreDb.js <backup-dir> --drop --apply'
    }
  };

  console.log(`Backing up database "${db.databaseName}" to ${backupDir}`);

  for (const name of names) {
    const file = `${name}.ndjson.gz`;
    const fullPath = path.join(backupDir, file);
    const collection = db.collection(name);
    const hash = crypto.createHash('sha256');
    const gzip = zlib.createGzip({ level: 6 });
    const out = fs.createWriteStream(fullPath, { mode: 0o600 });
    const done = pipeline(gzip, out);
    let count = 0;


    for await (const doc of collection.find({})) {
      const line = `${EJSON.stringify(doc, { relaxed: false })}\n`;
      hash.update(line);
      await writeLine(gzip, line);
      count += 1;
      if (count % 50000 === 0) process.stdout.write(`  ${name}: ${count}\n`);
    }

    gzip.end();
    await done;

    let indexes = [];
    try {
      indexes = (await collection.indexes())
        .filter((idx) => idx.name !== '_id_')
        .map((idx) => ({
          name: idx.name,
          key: idx.key,
          unique: idx.unique || false,
          sparse: idx.sparse || false,
          ...(idx.partialFilterExpression ? { partialFilterExpression: idx.partialFilterExpression } : {}),
          ...(idx.expireAfterSeconds !== undefined ? { expireAfterSeconds: idx.expireAfterSeconds } : {})
        }));
    } catch (err) {
      console.warn(`  ${name}: could not read indexes (${err.message})`);
    }

    const stat = fs.statSync(fullPath);
    manifest.collections.push({
      name,
      file,
      count,
      bytes: stat.size,
      sha256: hash.digest('hex'),
      indexes
    });
    console.log(`  ${name}: ${count} docs, ${(stat.size / 1048576).toFixed(2)} MB`);
  }

  fs.writeFileSync(
    path.join(backupDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    { mode: 0o600 }
  );

  fs.writeFileSync(
    path.join(backupDir, 'RESTORE.md'),
    [
      '# Database backup',
      '',
      `Created: ${manifest.createdAt}`,
      `Database: ${manifest.database}`,
      `Backup: ${backupDir}`,
      '',
      'Contains user password hashes and business data. Keep this directory private.',
      '',
      '## Restore everything',
      '',
      '```bash',
      'cd backend',
      `node src/scripts/restoreDb.js ${backupDir} --apply`,
      '```',
      '',
      '## Restore selected collections',
      '',
      '```bash',
      'cd backend',
      `node src/scripts/restoreDb.js ${backupDir} --only=activities,extensionevents --apply`,
      '```',
      '',
      '## Replace target collections first',
      '',
      '`--drop` deletes the target collection before restoring. This also removes events created after the backup.',
      '',
      '```bash',
      'cd backend',
      `node src/scripts/restoreDb.js ${backupDir} --drop --apply`,
      '```',
      '',
      'Restore is an upsert by `_id` by default, so newer documents not present in the backup are kept.',
      ''
    ].join('\n'),
    { mode: 0o600 }
  );

  console.log(`Backup complete: ${backupDir}`);
  console.log(`Collections: ${manifest.collections.length}`);
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
