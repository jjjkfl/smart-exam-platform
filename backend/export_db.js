const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/surgical_exam_db';
const BACKUP_FILE = path.join(__dirname, 'full_database_backup.json');

async function exportDatabase() {
  console.log('🚀 Starting Full Database Export...');
  console.log(`📡 Connecting to: ${MONGO_URI}`);

  try {
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    const backupData = {};

    for (const col of collections) {
      const name = col.name;
      console.log(`📦 Exporting collection: ${name}...`);
      const data = await db.collection(name).find({}).toArray();
      backupData[name] = data;
    }

    fs.writeFileSync(BACKUP_FILE, JSON.stringify(backupData, null, 2));
    
    console.log('\n✅ EXPORT SUCCESSFUL!');
    console.log(`📄 File saved: ${BACKUP_FILE}`);
    console.log('📦 You can now send this single JSON file to the other person.');
    
  } catch (err) {
    console.error('❌ Export failed:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

exportDatabase();
