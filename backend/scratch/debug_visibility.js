const mongoose = require('mongoose');
const User = require('../src/models/User');
const CourseMaterial = require('../src/models/CourseMaterial');

async function debug() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/surgical_exam_db');
        
        const students = await User.find({ role: 'student' });
        console.log('--- STUDENTS ---');
        console.log(JSON.stringify(students.map(u => ({ 
            email: u.email, 
            classTag: u.classTag, 
            division: u.division,
            courseId: u.courseId
        })), null, 2));

        const materials = await CourseMaterial.find({});
        console.log('\n--- MATERIALS ---');
        console.log(JSON.stringify(materials.map(m => ({ 
            title: m.title, 
            targetClass: m.targetClass, 
            targetDivision: m.targetDivision,
            courseId: m.courseId,
            subject: m.subject
        })), null, 2));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

debug();
