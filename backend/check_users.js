
const mongoose = require('mongoose');
const User = require('./src/models/User');

async function debug() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/surgical_exam_db');
        const teachers = await User.find({ role: 'teacher' });
        console.log('Teachers:', JSON.stringify(teachers.map(u => ({ email: u.email, role: u.role, courseIds: u.courseIds })), null, 2));

        if (teachers.length === 0) {
            console.log('NO TEACHERS FOUND IN DATABASE');
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

debug();
