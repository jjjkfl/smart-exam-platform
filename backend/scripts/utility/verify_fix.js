const mongoose = require('mongoose');
const User = require('./src/models/User');
const Announcement = require('./src/models/Announcement');

async function verify() {
    await mongoose.connect('mongodb://localhost:27017/surgical_exam_db');
    console.log('Connected to DB');

    const student = await User.findOne({ role: 'student' });
    if (!student) {
        console.log('No student found for testing');
        process.exit(1);
    }

    console.log(`Testing for student: ${student.email} (courseId: ${student.courseId})`);

    const announcements = await Announcement.find({ courseId: student.courseId })
        .populate('authorId', 'name')
        .lean();

    console.log(`Found ${announcements.length} announcements`);
    announcements.forEach(a => {
        console.log(`- ${a.title}: ${a.content} (Author: ${a.authorId?.name || 'Unknown'})`);
    });

    process.exit(0);
}

verify().catch(err => {
    console.error(err);
    process.exit(1);
});
