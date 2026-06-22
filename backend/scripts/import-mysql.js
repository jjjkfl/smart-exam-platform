/**
 * scripts/import-mysql.js
 * STEP 2 of migration — run this ON THE SERVER (which can reach MySQL).
 * It reads backend/migration-data/<name>.json and bulk-inserts each collection
 * into the matching MySQL table, preserving _id values and references.
 *
 * Passwords are imported AS-IS (already hashed in Mongo) — hooks are disabled so
 * they are not re-hashed. Safe to re-run: existing rows are skipped (ignoreDuplicates).
 *
 * Usage (on server):
 *   1. Ensure backend/.env has DB_HOST/DB_NAME/DB_USER/DB_PASS set.
 *   2. node scripts/import-mysql.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const sequelize = require('../src/config/sequelize');
const models = require('../src/models');

const DIR = path.join(__dirname, '..', 'migration-data');
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

function normalize(v) {
  if (v == null) return v;
  if (Array.isArray(v)) return v.map(normalize);
  if (typeof v === 'string') return ISO_DATE.test(v) ? new Date(v) : v;
  if (typeof v === 'object') {
    if (typeof v.$b64 === 'string') return Buffer.from(v.$b64, 'base64');
    const o = {};
    for (const [k, val] of Object.entries(v)) o[k] = normalize(val);
    return o;
  }
  return v;
}

(async () => {
  if (!fs.existsSync(DIR)) {
    console.error(`❌ ${DIR} not found. Upload the migration-data/ folder exported in step 1.`);
    process.exit(1);
  }
  await sequelize.authenticate();
  await sequelize.sync(); // make sure all tables exist
  console.log(`✅ Connected (${sequelize.getDialect()}) and schema synced.`);

  // Map MySQL table name → model
  const map = {};
  for (const m of Object.values(models)) {
    if (m && m.tableName) map[m.tableName] = m;
  }

  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json'));
  let grand = 0;
  for (const f of files) {
    const name = f.replace(/\.json$/, '');
    const model = map[name];
    if (!model) { console.warn(`  ⚠ skip ${name}: no matching table`); continue; }

    const rows = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')).map(normalize);
    if (!rows.length) { console.log(`  ${name}: 0`); continue; }

    const CHUNK = 200;
    let n = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      await model.bulkCreate(chunk, { ignoreDuplicates: true, validate: false, hooks: false });
      n += chunk.length;
    }
    console.log(`  imported ${name}: ${n}`);
    grand += n;
  }

  console.log(`\n✅ MIGRATION IMPORT COMPLETE — ${grand} rows.`);
  process.exit(0);
})().catch((e) => { console.error('IMPORT FAILED:', e); process.exit(1); });
