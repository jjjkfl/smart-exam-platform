const mongoose = require('mongoose');
const User = require('./src/models/User');
const Course = require('./src/models/Course');

async function check() {
    await mongoose.connect('mongodb://localhost:27017/surgical_exam_db');
    const students = await User.find({ role: 'student' });
    const distribution = {};

    for (const s of students) {
        distribution[s.courseId] = (distribution[s.courseId] || 0) + 1;
    }

    const courses = await Course.find();
    for (const c of courses) {
        console.log(`Course: ${c.courseName} (${c._id}), Students: ${distribution[c._id] || 0}`);
    }
    process.exit(0);
}

check().catch(err => {
    console.error(err);
    process.exit(1);
});
