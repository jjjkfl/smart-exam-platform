const mongoose = require('mongoose');
const Session = require('./src/models/Session');
const Course = require('./src/models/Course');

async function audit() {
    await mongoose.connect('mongodb://localhost:27017/surgical_exam_db');

    const sessions = await Session.find({ status: 'active' }).populate('courseId');
    console.log('--- Active Sessions Audit ---');
    sessions.forEach(s => {
        console.log(`Title: ${s.title} | Course: ${s.courseId?.courseName || 'N/A'} (${s.courseId?._id}) | Div: ${s.division || 'All'}`);
    });

    process.exit(0);
}

audit().catch(err => {
    console.error(err);
    process.exit(1);
});
