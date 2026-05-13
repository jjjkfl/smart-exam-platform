const mongoose = require('mongoose');
require('dotenv').config();

const Announcement = require('./src/models/Announcement');
const User = require('./src/models/User');

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/surgical_exam_db');
        console.log('Connected to MongoDB');

        const announcements = await Announcement.find({});
        console.log(`Total Announcements: ${announcements.length}`);
        if (announcements.length > 0) {
            announcements.forEach(a => console.log(`Announce CID: ${a.courseId}`));
        }

        const students = await User.find({ role: 'student' }).limit(5);
        console.log('Sample Students:');
        students.forEach(s => console.log(`Student: ${s.name}, CID: ${s.courseId}, Div: ${s.division}`));

        if (announcements.length > 0 && students.length > 0) {
            const studentCIDs = students.map(s => String(s.courseId));
            const matches = announcements.filter(a => studentCIDs.includes(String(a.courseId)));
            console.log(`Matches found: ${matches.length}`);
        }

        await mongoose.connection.close();
    } catch (err) {
        console.error(err);
    }
}

check();
