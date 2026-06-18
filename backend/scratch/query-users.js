const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });
const User = require('../src/models/User');
const Result = require('../src/models/Result');
const Session = require('../src/models/Session');
const Course = require('../src/models/Course');

const query = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB...');

    const users = await User.find({}).lean();
    console.log('All Users in DB:');
    users.forEach(u => console.log(`- ID: ${u._id}, Name: ${u.name}, Email: ${u.email}, Role: ${u.role}, CourseId: ${u.courseId}`));

    const sessions = await Session.find({}).lean();
    console.log('\nAll Sessions in DB:');
    sessions.forEach(s => console.log(`- ID: ${s._id}, Title: ${s.title}, CourseId: ${s.courseId}, Status: ${s.status}`));

    const results = await Result.find({}).lean();
    console.log(`\nTotal Results in DB: ${results.length}`);
    if (results.length > 0) {
      console.log('Sample Results:');
      results.slice(0, 5).forEach(r => console.log(`- StudentId: ${r.studentId}, CourseId: ${r.courseId}, Score: ${r.score}`));
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

query();
