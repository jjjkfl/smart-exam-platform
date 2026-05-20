const connectDB = require('../src/config/database');
const mongoose = require('mongoose');

require('dotenv').config({ path: '../.env' });

const run = async () => {
  await connectDB();
  const ResultSnapshot = require('../src/models/ResultSnapshot');
  const count = await ResultSnapshot.countDocuments();
  console.log('ResultSnapshot count:', count);
  const snapshots = await ResultSnapshot.find().limit(5).lean();
  console.log('Sample snapshots:', JSON.stringify(snapshots, null, 2));
  process.exit(0);
};

run().catch(err => {
  console.error(err);
  process.exit(1);
});
