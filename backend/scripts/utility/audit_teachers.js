const mongoose = require('mongoose');
const User = require('./src/models/User');
const Session = require('./src/models/Session');
const Course = require('./src/models/Course');

async function audit() {
    await mongoose.connect('mongodb://localhost:27017/surgical_exam_db');

    const teachers = await User.find({ role: 'teacher' });
    console.log('--- Teacher Audit ---');
    for (const t of teachers) {
        const courses = await Course.find({ _id: { $in: t.courseIds } });
        const sCount = await Session.countDocuments({ courseId: { $in: t.courseIds } });
        const activeCount = await Session.countDocuments({ courseId: { $in: t.courseIds }, status: 'active' });

        console.log(`Teacher: ${t.name} (${t.email})`);
        console.log(`  Courses: ${courses.map(c => c.courseName).join(', ')}`);
        console.log(`  Sessions: Total=${sCount}, Active=${activeCount}`);

        if (sCount > 0) {
            const sessions = await Session.find({ courseId: { $in: t.courseIds } });
            sessions.forEach(s => console.log(`    - [${s.status}] ${s.title}`));
        }
    }

    process.exit(0);
}

audit().catch(err => {
    console.error(err);
    process.exit(1);
});
