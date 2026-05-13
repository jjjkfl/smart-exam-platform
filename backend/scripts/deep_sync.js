const mongoose = require('mongoose');
const fs = require('fs');
const User = require('../src/models/User');
const Course = require('../src/models/Course');
const MCQBank = require('../src/models/MCQBank');
const Session = require('../src/models/Session');
const Result = require('../src/models/Result');

const MONGO_URI = 'mongodb://127.0.0.1:27017/surgical_exam_db';
const BACKUP_PATH = './full_database_backup.json';

async function deepSync() {
    try {
        await mongoose.connect(MONGO_URI);
        const backup = JSON.parse(fs.readFileSync(BACKUP_PATH, 'utf8'));
        
        const teacher1 = await User.findOne({ email: 'teacher1@exam.com' });
        if (!teacher1) throw new Error('Teacher 1 not found.');

        console.log('--- Deep Sync: MCQ Banks ---');
        if (backup.mcqbanks) {
            for (const b of backup.mcqbanks) {
                const { _id, ...bData } = b;
                await MCQBank.findOneAndUpdate(
                    { title: b.title }, 
                    { ...bData, createdBy: teacher1._id }, 
                    { upsert: true }
                );
            }
            console.log(`Synced ${backup.mcqbanks.length} MCQ Banks.`);
        }

        console.log('--- Deep Sync: Linking Everything to Teacher 1 ---');
        // Link all courses to Teacher 1
        const allCourses = await Course.find({}).distinct('_id');
        await User.updateOne({ _id: teacher1._id }, { $set: { courseIds: allCourses } });

        // Ensure Results point to courses Teacher 1 owns
        const firstCourse = allCourses[0];
        if (firstCourse) {
            await Result.updateMany(
                { courseId: { $exists: false } },
                { $set: { courseId: firstCourse } }
            );
        }

        console.log('✅ Deep Sync Complete! Dashboard metrics restored.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Deep Sync failed:', err);
        process.exit(1);
    }
}

deepSync();
