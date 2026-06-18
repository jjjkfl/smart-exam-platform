const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });
const User = require('../src/models/User');
const Course = require('../src/models/Course');

const update = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB...');

    // Find Medical Course 1
    const course = await Course.findOne({ courseName: 'Medical Course 1' });
    if (!course) {
      console.error('Course 1 not found!');
      process.exit(1);
    }

    const user = await User.findOneAndUpdate(
      { email: 'lwithtarun@gmail.com' },
      { courseId: course._id, division: 'A' },
      { new: true }
    );

    if (user) {
      console.log(`Successfully updated ${user.name} to Course: ${course.courseName} (${course._id}), Div: A`);
    } else {
      console.error('User Tarun not found!');
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

update();
