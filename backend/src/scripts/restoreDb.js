const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const readline = require('readline');
const mongoose = require('mongoose');
const { EJSON } = require('bson');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const args = process.argv.slice(2);
const backupDirArg = args.find((arg) => !arg.startsWith('--'));
const apply = args.includes('--apply');
const drop = args.includes('--drop');
const onlyArg = args.find((arg) => arg.startsWith('--only='));
const only = onlyArg ? new Set(onlyArg.slice('--only='.length).split(',').filter(Boolean)) : null;
const dbArg = args.find((arg) => arg.startsWith('--db='));
const dbName = dbArg ? dbArg.slice('--db='.length) : undefined;

async function main() {
  if (!backupDirArg) {
    throw new Error('Usage: node src/scripts/restoreDb.js <backup-dir> [--only=a,b] [--drop] --apply');
  }
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set');

  const backupDir = path.resolve(backupDirArg);
  const manifestPath = path.join(backupDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Backup manifest not found: ${manifestPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const collections = manifest.collections.filter((c) => !only || only.has(c.name));

  console.log(`Backup: ${backupDir}`);
  console.log(`Collections: ${collections.map((c) => c.name).join(', ')}`);
  console.log(drop ? 'Mode: replace target collections' : 'Mode: upsert by _id');

  if (!apply) {
    console.log('Dry run. Re-run with --apply to restore.');
    return;
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    dbName,
    serverSelectionTimeoutMS: 15000,
    family: 4
  });
  const db = mongoose.connection.db;
  console.log(`Target database: ${db.databaseName}`);

  for (const item of collections) {
    const file = path.join(backupDir, item.file);
    if (!fs.existsSync(file)) throw new Error(`Missing backup file: ${file}`);

    const collection = db.collection(item.name);
    if (drop) {
      await collection.drop().catch((err) => {
        if (err.codeName !== 'NamespaceNotFound') throw err;
      });
    }

    let restored = 0;
    let batch = [];
    const input = fs.createReadStream(file).pipe(zlib.createGunzip());
    const lines = readline.createInterface({ input, crlfDelay: Infinity });

    const flush = async () => {
      if (!batch.length) return;
      const ops = batch.map((doc) => ({
        replaceOne: {
          filter: { _id: doc._id },
          replacement: doc,
          upsert: true
        }
      }));
      await collection.bulkWrite(ops, { ordered: false });
      restored += batch.length;
      batch = [];
    };

    for await (const line of lines) {
      if (!line.trim()) continue;
      batch.push(EJSON.parse(line, { relaxed: false }));
      if (batch.length >= 500) await flush();
    }
    await flush();

    if (item.indexes && item.indexes.length) {
      await collection.createIndexes(item.indexes).catch((err) => {
        console.warn(`  ${item.name}: index restore warning: ${err.message}`);
      });
    }

    console.log(`  ${item.name}: restored ${restored} docs (backup had ${item.count})`);
  }

  console.log('Restore complete.');
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
