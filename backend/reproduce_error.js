const mongoose = require('mongoose');
require('dotenv').config();
const Announcement = require('./src/models/Announcement');
const User = require('./src/models/User');

async function testController() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/surgical_exam_db');
        console.log('Connected to MongoDB');

        const student = await User.findOne({ role: 'student' });
        if (!student) {
            console.log('No student found');
            return;
        }

        console.log(`Testing with student: ${student.name}, courseId: ${student.courseId}`);

        try {
            // Simulate the controller logic
            const announcements = await Announcement.find({ courseId: student.courseId })
                .sort({ createdAt: -1 })
                .populate('authorId', 'name')
                .lean();
            console.log(`Success! Found ${announcements.length} announcements`);
        } catch (err) {
            console.error('Controller logic failed:', err.message);
        }

        // Test with missing courseId
        console.log('Testing with undefined courseId...');
        try {
            const announcements = await Announcement.find({ courseId: undefined })
                .sort({ createdAt: -1 })
                .populate('authorId', 'name')
                .lean();
            console.log(`Success with undefined CID! Found ${announcements.length} announcements`);
        } catch (err) {
            console.error('Failed with undefined CID:', err.message);
        }

        await mongoose.connection.close();
    } catch (err) {
        console.error(err);
    }
}

testController();
