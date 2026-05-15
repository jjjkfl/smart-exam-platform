
const mongoose = require('mongoose');
const Result = require('./src/models/Result');
const User = require('./src/models/User');

async function debug() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/surgical_exam_db');
        console.log('Connected to DB');

        const teacher = await User.findOne({ role: 'teacher' });
        if (!teacher) {
            console.log('No teacher found');
            return;
        }

        const courseIds = teacher.courseIds || [];
        console.log('Teacher Course IDs:', courseIds);

        const summary = await Result.aggregate([
            { $match: { courseId: { $in: courseIds } } },
            {
                $group: {
                    _id: null,
                    totalSubmissions: { $sum: 1 },
                    avgScore: { $avg: '$score' },
                    passed: { $sum: { $cond: [{ $gte: ['$score', 60] }, 1, 0] } }
                }
            }
        ]);
        console.log('Summary Result:', JSON.stringify(summary, null, 2));

        const grades = await Result.aggregate([
            { $match: { courseId: { $in: courseIds } } },
            {
                $group: {
                    _id: null,
                    A: { $sum: { $cond: [{ $gte: ['$score', 90] }, 1, 0] } },
                    B: { $sum: { $cond: [{ $and: [{ $gte: ['$score', 80] }, { $lt: ['$score', 90] }] }, 1, 0] } },
                    C: { $sum: { $cond: [{ $and: [{ $gte: ['$score', 70] }, { $lt: ['$score', 80] }] }, 1, 0] } },
                    D: { $sum: { $cond: [{ $and: [{ $gte: ['$score', 60] }, { $lt: ['$score', 70] }] }, 1, 0] } },
                    F: { $sum: { $cond: [{ $lt: ['$score', 60] }, 1, 0] } }
                }
            }
        ]);
        console.log('Grades Result:', JSON.stringify(grades, null, 2));

        process.exit(0);
    } catch (err) {
        console.error('Debug Error:', err);
        process.exit(1);
    }
}

debug();
