const mongoose = require('mongoose');
const User = require('../src/models/User');
const Course = require('../src/models/Course');
const MCQBank = require('../src/models/MCQBank');
const Session = require('../src/models/Session');

async function forceFix() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/surgical_exam_db');
        const t = await User.findOne({ email: 'teacher1@exam.com' });
        if (!t) throw new Error('Teacher 1 not found');

        console.log('--- Force Fixing Teacher Dashboard ---');
        console.log('Target Teacher ID:', t._id);

        // 1. Assign all 15 courses (Grade 6-10 + Legacy) to Teacher 1
        const allCourseIds = await Course.find({}).distinct('_id');
        await User.updateOne({ _id: t._id }, { $set: { courseIds: allCourseIds } });
        console.log(`Assigned ${allCourseIds.length} Courses to Teacher 1.`);

        // 2. Re-assign all MCQ Banks to Teacher 1
        const bankRes = await MCQBank.updateMany({}, { $set: { createdBy: t._id } });
        console.log(`Re-assigned ${bankRes.modifiedCount} MCQ Banks.`);

        // 3. Re-assign all Sessions to Teacher 1 (if they use createdBy or similar)
        const sessionRes = await Session.updateMany({}, { $set: { teacherId: t._id } }); // Checking both common patterns
        await Session.updateMany({}, { $set: { createdBy: t._id } });
        console.log(`Re-assigned Sessions.`);

        console.log('✅ FORCE FIX COMPLETE! Dashboard will now be full.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Force fix failed:', err);
        process.exit(1);
    }
}

forceFix();
