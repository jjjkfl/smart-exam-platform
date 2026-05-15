require('dotenv').config();
const mongoose = require('mongoose');

async function test() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/mcqpro');
  const Timetable = require('./src/models/Timetable');
  const User = require('./src/models/User');

  const student = await User.findOne({ role: 'student' });
  if (!student) {
    console.log('No student found');
    process.exit(1);
  }

  const { classTag, division } = student;
  console.log('Student:', classTag, division);

  try {
    const entries = await Timetable.find({
      $and: [
        { targetClass: { $in: [classTag, 'All'] } },
        { targetDivision: { $in: [division, 'All'] } }
      ]
    }).sort({ day: 1, time: 1 }).lean();
    console.log('Entries:', entries);
  } catch (err) {
    console.error('Error:', err);
  }
  process.exit(0);
}

test();
