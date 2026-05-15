const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });

const Session = require('./src/models/Session');
const User = require('./src/models/User');

async function checkSessions() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const sessions = await Session.find({});
    console.log(`Found ${sessions.length} sessions:`);
    for (const s of sessions) {
      console.log(`- Session ID: ${s._id}`);
      console.log(`  Exam ID (Title): ${s.examId}`);
      console.log(`  Status: ${s.status}`);
      console.log('---');
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

checkSessions();
