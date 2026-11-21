/**
 * Copy a MongoDB database from one cluster (or database) to another.
 *
 *   node scripts/db-migrate.cjs            dry run: connects to both, lists what would move
 *   node scripts/db-migrate.cjs --run      copies every collection + its indexes, then verifies counts
 *   node scripts/db-migrate.cjs --run --overwrite   also replaces collections that already have data in the target
 *   node scripts/db-migrate.cjs --run --sync        brings a target up to date: every source document is
 *                                                   inserted or replaced by _id; documents only the target has are kept
 *
 * Connection strings come from .env (never typed on the command line, never printed):
 *   MIGRATE_SOURCE_URI=mongodb+srv://.../BlacHeritage      (copy FROM, read only)
 *   MIGRATE_TARGET_URI=mongodb+srv://.../BlacHeritage      (copy TO)
 * The database name is the path part of each URI. If a URI has no path, the
 * name comes from MIGRATE_SOURCE_DB / MIGRATE_TARGET_DB when set (e.g. BlacHeritage_dev), else the URI path.
 *
 * Safety:
 *  - The source is only ever read. Nothing is deleted from it.
 *  - Without --overwrite, a target collection that already holds documents is
 *    skipped and reported, never mixed or duplicated.
 *  - _id values are kept, so references between collections stay intact.
 *  - After copying, document counts are compared collection by collection.
 */
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}
loadEnv();

const RUN = process.argv.includes("--run");
const OVERWRITE = process.argv.includes("--overwrite");
const SYNC = process.argv.includes("--sync");
if (SYNC && OVERWRITE) {
  console.error("Use --sync or --overwrite, not both.");
  process.exit(1);
}
const BATCH = 1000;

/** Host only, so a log never shows a username or password. */
function where(uri) {
  try {
    const u = new URL(uri.replace(/^mongodb(\+srv)?:\/\//, "http://"));
    return u.host;
  } catch {
    return "(unparseable URI)";
  }
}
/** MIGRATE_*_DB, when set, wins over the URI path (lets one pair of URIs copy prod or dev). */
function dbNameOf(uri, override) {
  if (override) return override;
  try {
    const u = new URL(uri.replace(/^mongodb(\+srv)?:\/\//, "http://"));
    const name = decodeURIComponent(u.pathname.replace(/^\//, ""));
    return name || "";
  } catch {
    return "";
  }
}

async function main() {
  const srcUri = process.env.MIGRATE_SOURCE_URI;
  const dstUri = process.env.MIGRATE_TARGET_URI;
  if (!srcUri || !dstUri) {
    console.error("Add MIGRATE_SOURCE_URI and MIGRATE_TARGET_URI to .env first (see the top of this file).");
    process.exit(1);
  }
  const srcDb = dbNameOf(srcUri, process.env.MIGRATE_SOURCE_DB);
  const dstDb = dbNameOf(dstUri, process.env.MIGRATE_TARGET_DB);
  if (!srcDb || !dstDb) {
    console.error("Could not tell the database name. Put it in the URI path (…mongodb.net/DBNAME?…) or set MIGRATE_SOURCE_DB / MIGRATE_TARGET_DB.");
    process.exit(1);
  }
  if (srcUri === dstUri && srcDb === dstDb) {
    console.error("Source and target are the same database. Nothing to do.");
    process.exit(1);
  }

  console.log(`FROM  ${where(srcUri)} / ${srcDb}   (read only)`);
  console.log(`TO    ${where(dstUri)} / ${dstDb}`);
  console.log(RUN && SYNC ? "MODE  sync: insert/replace every source document by _id, keep target-only documents\n" : RUN ? (OVERWRITE ? "MODE  copy, replacing target collections that already have data\n" : "MODE  copy (target collections with data are skipped)\n") : "MODE  dry run (nothing is written). Add --run to copy.\n");

  const src = new MongoClient(srcUri, { readPreference: "secondaryPreferred" });
  const dst = new MongoClient(dstUri);
  await src.connect();
  await dst.connect();
  const s = src.db(srcDb);
  const d = dst.db(dstDb);

  const colls = (await s.listCollections({}, { nameOnly: false }).toArray())
    .filter((c) => c.type !== "view" && !c.name.startsWith("system.") && !c.name.startsWith("_restore_test_"));
  if (colls.length === 0) console.log("The source database has no collections. Check the database name.");

  const report = [];
  for (const c of colls) {
    const name = c.name;
    const srcCount = await s.collection(name).estimatedDocumentCount();
    const existing = await d.listCollections({ name }).toArray();
    const dstCount = existing.length ? await d.collection(name).countDocuments() : 0;

    if (!RUN) {
      report.push({ name, srcCount, dstCount, action: dstCount > 0 ? (OVERWRITE ? "would replace" : SYNC ? "would sync" : "would skip (target has data)") : "would copy" });
      continue;
    }
    if (dstCount > 0 && SYNC) {
      let done = 0;
      let ops = [];
      const flush = async () => {
        if (!ops.length) return;
        await d.collection(name).bulkWrite(ops, { ordered: false });
        done += ops.length;
        ops = [];
        process.stdout.write(`  ${name}: ${done}/${srcCount} synced`);
      };
      for await (const doc of s.collection(name).find({}, { batchSize: BATCH })) {
        ops.push({ replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true } });
        if (ops.length >= BATCH) await flush();
      }
      await flush();
      process.stdout.write("\n");
      // Every source _id must now exist in the target.
      const exact = await s.collection(name).countDocuments();
      const ids = await s.collection(name).distinct("_id");
      const present = await d.collection(name).countDocuments({ _id: { $in: ids } });
      const after = await d.collection(name).countDocuments();
      report.push({ name, srcCount: exact, dstCount: after, action: present === exact ? `synced (${after - exact} target-only kept)` : "COUNT MISMATCH" });
      continue;
    }
    if (dstCount > 0 && !OVERWRITE) {
      report.push({ name, srcCount, dstCount, action: "skipped (target has data)" });
      continue;
    }
    if (dstCount > 0 && OVERWRITE) await d.collection(name).drop();

    // Same collection options (capped, validators, collation) where possible.
    const opts = { ...(c.options || {}) };
    try { await d.createCollection(name, opts); } catch (e) { if (e.codeName !== "NamespaceExists") throw e; }

    let copied = 0;
    let buf = [];
    const cursor = s.collection(name).find({}, { batchSize: BATCH });
    for await (const doc of cursor) {
      buf.push(doc);
      if (buf.length >= BATCH) {
        await d.collection(name).insertMany(buf, { ordered: false });
        copied += buf.length;
        buf = [];
        process.stdout.write(`\r  ${name}: ${copied}/${srcCount}`);
      }
    }
    if (buf.length) { await d.collection(name).insertMany(buf, { ordered: false }); copied += buf.length; }
    process.stdout.write(`\r  ${name}: ${copied}/${srcCount}\n`);

    // Indexes (the _id index exists already).
    const idx = (await s.collection(name).indexes()).filter((i) => i.name !== "_id_");
    for (const i of idx) {
      const { key, v, ns, ...rest } = i;
      try { await d.collection(name).createIndex(key, rest); }
      catch (e) { console.warn(`  index ${i.name} on ${name} not copied: ${e.message}`); }
    }

    const after = await d.collection(name).countDocuments();
    const exact = await s.collection(name).countDocuments();
    report.push({ name, srcCount: exact, dstCount: after, action: after === exact ? "copied, counts match" : "COUNT MISMATCH" });
  }

  console.log("");
  console.table(report);
  const bad = report.filter((r) => r.action === "COUNT MISMATCH");
  if (RUN) console.log(bad.length ? `\n${bad.length} collection(s) did not match. Do not switch the app over yet.` : "\nDone. Every copied collection matches the source.");
  await src.close();
  await dst.close();
  process.exit(bad.length ? 2 : 0);
}

main().catch((e) => {
  // Driver errors can echo the URI; print only the message class and code.
  console.error("Migration stopped:", e.codeName || e.name, "-", String(e.message || "").replace(/mongodb(\+srv)?:\/\/[^\s]+/g, "<uri hidden>"));
  process.exit(1);
});
