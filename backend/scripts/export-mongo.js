/**
 * scripts/export-mongo.js
 * STEP 1 of migration — run this on a machine that CAN reach MongoDB Atlas
 * (e.g. your local PC). It dumps every collection to backend/migration-data/<name>.json
 * with ObjectIds/Dates/Binary converted to portable forms.
 *
 * Usage:
 *   1. In backend/.env set MONGO_URI to the cluster that HOLDS YOUR DATA.
 *   2. node scripts/export-mongo.js
 *   3. Upload the whole backend/migration-data/ folder to the server.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId, Binary } = require('mongodb');

const OUT = path.join(__dirname, '..', 'migration-data');

function sanitize(v) {
  if (v == null) return v;
  if (v instanceof ObjectId) return v.toHexString();
  if (v instanceof Date) return v.toISOString();
  if (v instanceof Binary) return { $b64: Buffer.from(v.buffer).toString('base64') };
  if (Buffer.isBuffer(v)) return { $b64: v.toString('base64') };
  if (Array.isArray(v)) return v.map(sanitize);
  if (typeof v === 'object') {
    const o = {};
    for (const [k, val] of Object.entries(v)) o[k] = sanitize(val);
    return o;
  }
  return v;
}

(async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('❌ Set MONGO_URI in backend/.env to the MongoDB Atlas cluster that holds your data.');
    process.exit(1);
  }
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(); // database is taken from the URI path
  const cols = await db.listCollections().toArray();
  fs.mkdirSync(OUT, { recursive: true });

  let total = 0;
  for (const c of cols) {
    const name = c.name;
    if (name.startsWith('system.')) continue;
    const docs = await db.collection(name).find({}).toArray();
    const clean = docs.map(sanitize);
    fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(clean));
    console.log(`  exported ${name}: ${clean.length} docs`);
    total += clean.length;
  }

  console.log(`\n✅ DONE. ${cols.length} collections, ${total} docs → ${OUT}`);
  console.log('Next: upload the migration-data/ folder to the server, then run scripts/import-mysql.js there.');
  await client.close();
})().catch((e) => { console.error('EXPORT FAILED:', e); process.exit(1); });
