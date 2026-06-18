const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });
const User = require('../src/models/User');
const Session = require('../src/models/Session');
const Result = require('../src/models/Result');

const listInfo = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to Atlas DB...');

    console.log('--- Students ---');
    const students = await User.find({ role: 'student' }).select('name email courseId division').lean();
    console.log(students);

    console.log('--- Sessions (Exams) ---');
    const sessions = await Session.find({}).select('title courseId status subject startTime').lean();
    console.log(sessions);

    console.log('--- Results (Submissions) ---');
    const results = await Result.find({}).select('studentId sessionId score courseId createdAt').lean();
    console.log(results);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

listInfo();
