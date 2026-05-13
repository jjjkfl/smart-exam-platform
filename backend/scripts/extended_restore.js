const mongoose = require('mongoose');
const fs = require('fs');
const User = require('../src/models/User');
const Course = require('../src/models/Course');
const MCQBank = require('../src/models/MCQBank');
const Exam = require('../src/models/Exam');
const Result = require('../src/models/Result');

const MONGO_URI = 'mongodb://127.0.0.1:27017/surgical_exam_db';
const BACKUP_PATH = './full_database_backup.json';

async function extendedRestore() {
    try {
        await mongoose.connect(MONGO_URI);
        const backup = JSON.parse(fs.readFileSync(BACKUP_PATH, 'utf8'));
        
        const teacher1 = await User.findOne({ email: 'teacher1@exam.com' });
        if (!teacher1) throw new Error('Teacher 1 not found.');

        console.log('--- Restoring MCQ Banks ---');
        if (backup.mcqbanks) {
            for (const b of backup.mcqbanks) {
                const { _id, ...bData } = b;
                await MCQBank.findOneAndUpdate({ title: b.title }, { ...bData, teacherId: teacher1._id }, { upsert: true });
            }
            console.log(`Restored ${backup.mcqbanks.length} MCQ Banks.`);
        }

        console.log('--- Restoring Exam Sessions ---');
        if (backup.exams) {
            for (const e of backup.exams) {
                const { _id, ...eData } = e;
                await Exam.findOneAndUpdate({ title: e.title }, { ...eData, teacherId: teacher1._id }, { upsert: true });
            }
            console.log(`Restored ${backup.exams.length} Exams.`);
        }

        console.log('--- Linking Students to Teacher 1 ---');
        // Let's ensure Teacher 1 can see ALL students for testing purposes
        const students = await User.find({ role: 'student' });
        const allCourseIds = await Course.find({}).distinct('_id');
        
        await User.updateOne({ _id: teacher1._id }, { $set: { courseIds: allCourseIds } });

        console.log('✅ Extended Restoration Complete!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Extended Restore failed:', err);
        process.exit(1);
    }
}

extendedRestore();
