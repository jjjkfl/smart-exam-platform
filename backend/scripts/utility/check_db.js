const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const Result = require('./src/models/Result');
const User = require('./src/models/User');

async function checkData() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const results = await Result.find({});
    console.log(`Found ${results.length} results`);

    for (const r of results) {
      const student = await User.findById(r.studentId);
      console.log(`Result ID: ${r._id}`);
      console.log(`  Student ID: ${r.studentId}`);
      console.log(`  Student Name: ${student ? student.name : 'NOT FOUND'}`);
      console.log(`  Student Role: ${student ? student.role : 'N/A'}`);
      console.log(`  Exam ID: ${r.examId}`);
      console.log('---');
    }

    const users = await User.find({});
    console.log(`\nFound ${users.length} users:`);
    users.forEach(u => {
      console.log(`- ${u.name} (${u.email}) [${u.role}] ID: ${u._id}`);
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

checkData();
