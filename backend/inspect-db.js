/**
 * Quick script to inspect all MongoDB collections
 */
require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  console.log('=============================================');
  console.log('  DATABASE: ' + db.databaseName);
  console.log('=============================================\n');

  const collections = await db.listCollections().toArray();

  for (const col of collections) {
    const count = await db.collection(col.name).countDocuments();
    const docs = await db.collection(col.name).find({}).limit(5).toArray();

    console.log(`\n--- ${col.name.toUpperCase()} (${count} documents) ---`);
    docs.forEach(d => {
      if (d.password) d.password = '***hidden***';
      console.log(JSON.stringify(d, null, 2));
    });
    if (count > 5) console.log(`  ... and ${count - 5} more`);
  }

  process.exit(0);
})();
