const mongoose = require('mongoose');
const User = require('../src/models/User');
const Course = require('../src/models/Course');
const MCQBank = require('../src/models/MCQBank');

async function diagnostic() {
    await mongoose.connect('mongodb://127.0.0.1:27017/surgical_exam_db');
    const t = await User.findOne({ email: 'teacher1@exam.com' });
    console.log('--- TEACHER 1 PROFILE ---');
    console.log('ID:', t._id);
    console.log('Course IDs:', t.courseIds);

    const bankCount = await MCQBank.countDocuments({ createdBy: t._id });
    console.log('MCQ Banks for this ID:', bankCount);

    const studentCount = await User.countDocuments({ role: 'student', courseId: { $in: t.courseIds } });
    console.log('Students in these courses:', studentCount);

    const allBanks = await MCQBank.find({});
    console.log('--- ALL MCQ BANKS IN DB ---');
    console.log(allBanks.map(b => ({ title: b.title, createdBy: b.createdBy })));

    process.exit(0);
}

diagnostic();
