const mongoose = require('mongoose');
const User = require('../src/models/User');
const Course = require('../src/models/Course');

const MONGO_URI = 'mongodb://127.0.0.1:27017/surgical_exam_db';

async function addLegacyTeachers() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('--- Adding Legacy Teachers ---');
        
        // Find existing courses
        const courses = await Course.find({});
        const courseMap = {};
        courses.forEach(c => {
            if (c.courseName.includes('Grade 6')) courseMap[6] = c._id;
            if (c.courseName.includes('Grade 7')) courseMap[7] = c._id;
            if (c.courseName.includes('Grade 8')) courseMap[8] = c._id;
            if (c.courseName.includes('Grade 9')) courseMap[9] = c._id;
            if (c.courseName.includes('Grade 10')) courseMap[10] = c._id;
        });

        const legacyTeachers = [
            { 
                name: 'Teacher 1', 
                email: 'teacher1@exam.com', 
                password: 'password123',
                role: 'teacher',
                courseIds: [courseMap[6], courseMap[7]],
                department: 'Clinical Science'
            },
            { 
                name: 'Teacher 2', 
                email: 'teacher2@exam.com', 
                password: 'password123',
                role: 'teacher',
                courseIds: [courseMap[8], courseMap[9], courseMap[10]],
                department: 'Surgical Dept'
            }
        ];

        for (const tData of legacyTeachers) {
            // Check if exists
            const exists = await User.findOne({ email: tData.email });
            if (exists) {
                await User.updateOne({ email: tData.email }, { $set: tData });
                console.log(`Updated existing ${tData.name}`);
            } else {
                await User.create(tData);
                console.log(`Created new ${tData.name}`);
            }

            // Update Course teacherIds
            const teacher = await User.findOne({ email: tData.email });
            await Course.updateMany(
                { _id: { $in: tData.courseIds } },
                { $addToSet: { teacherIds: teacher._id } }
            );
        }

        console.log('✅ Legacy teachers successfully restored.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Failed to restore teachers:', err);
        process.exit(1);
    }
}

addLegacyTeachers();
