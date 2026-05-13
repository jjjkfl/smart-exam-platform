const mongoose = require('mongoose');
const Session = require('./src/models/Session');
const Course = require('./src/models/Course');

async function fix() {
    await mongoose.connect('mongodb://localhost:27017/surgical_exam_db');

    const validCourses = await Course.find();
    if (validCourses.length === 0) {
        console.log('No valid courses found to link to');
        process.exit(1);
    }

    const targetCourseId = validCourses[0]._id;
    console.log(`Target Course: ${validCourses[0].courseName} (${targetCourseId})`);

    const sessions = await Session.find();
    let count = 0;
    for (const s of sessions) {
        const isValid = validCourses.some(c => String(c._id) === String(s.courseId));
        if (!isValid) {
            s.courseId = targetCourseId;
            if (!s.division) s.division = 'A'; // Ensure division is set if required
            if (!s.title) s.title = `Imported Exam ${count + 1}`;
            if (!s.startTime) s.startTime = new Date();
            if (!s.duration) s.duration = 60;
            await s.save();
            count++;
        }
    }

    console.log(`✅ Fixed ${count} orphan sessions.`);
    process.exit(0);
}

fix().catch(err => {
    console.error(err);
    process.exit(1);
});
