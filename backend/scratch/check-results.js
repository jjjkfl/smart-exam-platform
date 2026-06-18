const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });
const Result = require('../src/models/Result');
const User = require('../src/models/User');

const checkResults = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to Atlas DB...');

    // Find student5
    const student = await User.findOne({ email: 'std5@gmail.com' }).lean();
    if (student) {
      console.log('student5 details:', student);
      const studentResults = await Result.find({ studentId: student._id }).lean();
      console.log(`Results for student5 (total: ${studentResults.length}):`);
      console.log(studentResults);
    } else {
      console.log('student5 not found');
    }

    // Also look for any results with courseId: null
    const courseLessResults = await Result.find({ $or: [{ courseId: null }, { courseId: { $exists: false } }] }).lean();
    console.log(`\nResults with courseId null (total: ${courseLessResults.length}):`);
    console.log(courseLessResults);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

checkResults();
