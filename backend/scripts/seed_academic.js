const mongoose = require('mongoose');
const User = require('../src/models/User');
const Course = require('../src/models/Course');

const MONGO_URI = 'mongodb://127.0.0.1:27017/surgical_exam_db';

async function seedAcademicData() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('--- Cleaning existing academic data ---');
        
        // Optional: Clear existing students/teachers to start fresh
        await User.deleteMany({ role: { $in: ['student', 'teacher'] } });
        await Course.deleteMany({});

        console.log('--- Creating Grade-Level Courses ---');
        const grades = [6, 7, 8, 9, 10];
        const courseMap = {};

        for (const grade of grades) {
            const course = await Course.create({
                courseName: `Grade ${grade} Academic Bundle`,
                department: 'General Education',
                description: `Unified curriculum for all Grade ${grade} subjects.`,
                driveLink: 'https://drive.google.com/drive/folders/sample'
            });
            courseMap[grade] = course._id;
        }

        console.log('--- Creating Professional Teachers ---');
        const teacherData = [
            { name: 'Dr. Sarah Smith', email: 'sarah.math@exam.com', dept: 'Mathematics', courses: [6, 7] },
            { name: 'Prof. James Wilson', email: 'james.science@exam.com', dept: 'Science', courses: [8, 9, 10] },
            { name: 'Ms. Emily Brown', email: 'emily.english@exam.com', dept: 'Humanities', courses: [6, 8, 10] },
            { name: 'Mr. David Clark', email: 'david.tech@exam.com', dept: 'Computer Science', courses: [7, 9] },
            { name: 'Dr. Maria Garcia', email: 'maria.history@exam.com', dept: 'Social Studies', courses: [6, 7, 8, 9, 10] }
        ];

        for (const t of teacherData) {
            const assignedCourseIds = t.courses.map(g => courseMap[g]);
            await User.create({
                name: t.name,
                email: t.email,
                password: 'password123',
                role: 'teacher',
                courseIds: assignedCourseIds,
                department: t.dept
            });
            
            // Update courses with teacher IDs
            await Course.updateMany(
                { _id: { $in: assignedCourseIds } },
                { $addToSet: { teacherIds: (await User.findOne({ email: t.email }))._id } }
            );
        }

        console.log('--- Creating 50+ Students (Distributed across A, B, C, D) ---');
        const divisions = ['A', 'B', 'C', 'D'];
        let studentCount = 0;

        for (const grade of grades) {
            for (const div of divisions) {
                // Create 3 students per division per grade = 15 per grade = 75 total
                for (let i = 1; i <= 3; i++) {
                    studentCount++;
                    await User.create({
                        name: `Student ${studentCount} (G${grade}-${div})`,
                        email: `student${studentCount}@exam.com`,
                        password: 'password123',
                        role: 'student',
                        courseId: courseMap[grade],
                        classTag: `Grade ${grade}`,
                        division: div
                    });
                }
            }
        }

        console.log(`✅ Success! Created 5 Courses, 5 Teachers, and ${studentCount} Students.`);
        console.log('All students are correctly tagged with Grade and Division.');
        console.log('Logins: password123 for everyone.');
        
        process.exit(0);
    } catch (err) {
        console.error('❌ Seeding failed:', err);
        process.exit(1);
    }
}

seedAcademicData();
