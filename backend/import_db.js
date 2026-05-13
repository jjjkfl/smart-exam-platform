const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/surgical_exam_db';
const BACKUP_FILE = path.join(__dirname, 'full_database_backup.json');

async function importDatabase() {
  console.log('🚀 Starting Full Database Import...');
  
  if (!fs.existsSync(BACKUP_FILE)) {
    console.error(`❌ Error: Backup file not found at ${BACKUP_FILE}`);
    process.exit(1);
  }

  console.log(`📡 Connecting to: ${MONGO_URI}`);

  try {
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;
    
    const backupData = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
    const collectionNames = Object.keys(backupData);

    console.log(`📂 Found ${collectionNames.length} collections in backup.`);

    for (const name of collectionNames) {
      console.log(`📥 Importing collection: ${name} (${backupData[name].length} documents)...`);
      
      // Drop existing collection to ensure a clean import
      try {
        await db.collection(name).drop();
      } catch (e) {
        // Collection might not exist, ignore error
      }

      if (backupData[name].length > 0) {
        await db.collection(name).insertMany(backupData[name]);
      }
    }

    console.log('\n✅ IMPORT SUCCESSFUL!');
    console.log('🎉 Your database is now fully restored.');
    
  } catch (err) {
    console.error('❌ Import failed:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

importDatabase();
