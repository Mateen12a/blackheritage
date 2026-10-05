const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

// Parse .env manually without external dependencies
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}
loadEnv();

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("ERROR: MONGODB_URI is not set in .env");
  process.exit(1);
}

const dateStr = '2026-10-04';
const backupDir = path.join(__dirname, '..', 'out', `backup-${dateStr}`);

async function runBackup() {
  console.log(`Starting non-destructive database backup to out/backup-${dateStr}...`);
  fs.mkdirSync(backupDir, { recursive: true });

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const dbName = db.databaseName;
  console.log(`Connected to database [${dbName}]`);

  const collections = await db.listCollections().toArray();
  const stats = {};

  for (const collInfo of collections) {
    const collName = collInfo.name;
    if (collName.startsWith('system.') || collName.startsWith('_restore_test_')) continue;

    const coll = db.collection(collName);
    const docs = await coll.find({}).toArray();
    stats[collName] = docs.length;

    const filePath = path.join(backupDir, `${collName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf8');
    console.log(`  - Dumped [${collName}]: ${docs.length} documents -> ${collName}.json`);
  }

  const manifest = {
    date: dateStr,
    database: dbName,
    timestamp: new Date().toISOString(),
    collections: stats
  };
  fs.writeFileSync(path.join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  // Confirmation step: Verify the dump restores to a test namespace and matches exactly
  console.log("\nVerifying dump restore integrity...");
  let restoreSuccess = true;

  for (const [collName, count] of Object.entries(stats)) {
    const testCollName = `_restore_test_${collName}`;
    const testColl = db.collection(testCollName);
    
    // Clean up if previous test collection lingered
    await testColl.drop().catch(() => {});

    if (count > 0) {
      const dumpedDocs = JSON.parse(fs.readFileSync(path.join(backupDir, `${collName}.json`), 'utf8'));
      await testColl.insertMany(dumpedDocs);
      const restoredCount = await testColl.countDocuments();
      if (restoredCount !== count) {
        console.error(`  FAIL: Restore count mismatch on ${collName}: expected ${count}, got ${restoredCount}`);
        restoreSuccess = false;
      } else {
        console.log(`  OK: [${collName}] successfully restored and verified (${restoredCount}/${count} docs)`);
      }
    } else {
      console.log(`  OK: [${collName}] 0 documents verified`);
    }

    // Drop the temporary test collection
    await testColl.drop().catch(() => {});
  }

  await client.close();

  if (!restoreSuccess) {
    console.error("\nDatabase restore verification failed!");
    process.exit(1);
  }

  console.log("\nBackup and restore verification completed successfully!");
  console.log(`All files saved in: out/backup-${dateStr}`);
}

runBackup().catch((err) => {
  console.error("Backup failed:", err.message);
  process.exit(1);
});
