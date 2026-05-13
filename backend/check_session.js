const mongoose = require('mongoose');
const Session = require('./src/models/Session');
const User = require('./src/models/User');

async function check() {
    await mongoose.connect('mongodb://localhost:27017/surgical_exam_db');

    const sessions = await Session.find({ status: 'active' });
    console.log(`Total Active Sessions: ${sessions.length}`);

    for (const s of sessions) {
        if (s.title && s.title.toLowerCase().includes('mid')) {
            const studentCount = await User.countDocuments({ role: 'student', courseId: s.courseId });
            console.log(`Session: ${s.title} | Course: ${s.courseId} | Students in Course: ${studentCount}`);
        }
    }

    process.exit(0);
}

check().catch(err => {
    console.error(err);
    process.exit(1);
});
