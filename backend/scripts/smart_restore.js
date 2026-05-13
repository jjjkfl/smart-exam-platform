require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const User = require('../src/models/User');
const Course = require('../src/models/Course');
const CourseMaterial = require('../src/models/CourseMaterial');
const MCQQuestion = require('../src/models/MCQQuestion');
const Result = require('../src/models/Result');

const MONGO_URI = process.env.MONGO_URI;
const BACKUP_PATH = './full_database_backup.json';

async function restoreOldData() {
    try {
        await mongoose.connect(MONGO_URI);
        const backup = JSON.parse(fs.readFileSync(BACKUP_PATH, 'utf8'));

        console.log('--- Clearing Existing Results for Fresh Import ---');
        await Result.deleteMany({});
        
        console.log('--- Restoring Teacher 1 Connection ---');
        const teacher1 = await User.findOne({ email: 'teacher1@exam.com' });
        if (!teacher1) throw new Error('Teacher 1 not found. Please run restore_teachers script first.');

        console.log('--- Restoring Courses ---');
        for (const c of backup.courses) {
            // Check if course exists by name to avoid duplicates
            let existingCourse = await Course.findOne({ courseName: c.courseName });
            if (!existingCourse) {
                // Remove original _id to let Mongo generate a new one, or keep it if you want exact sync
                // For this, we'll keep the old ID but ensure teacher1 is an owner
                const { _id, ...courseData } = c;
                existingCourse = await Course.create({
                    ...courseData,
                    teacherIds: [teacher1._id] 
                });
                console.log(`Restored Course: ${c.courseName}`);
            } else {
                // Just add teacher1 to the owners
                await Course.updateOne({ _id: existingCourse._id }, { $addToSet: { teacherIds: teacher1._id } });
            }
            
            // Link Teacher 1
            await User.updateOne({ _id: teacher1._id }, { $addToSet: { courseIds: existingCourse._id } });
        }

        console.log('--- Restoring MCQ Questions (Direct) ---');
        let questionCount = 0;
        if (backup.mcqquestions) {
            for (const q of backup.mcqquestions) {
                const { _id, ...qData } = q;
                await MCQQuestion.findOneAndUpdate({ question_text: q.question_text }, qData, { upsert: true });
                questionCount++;
            }
        }

        console.log('--- Restoring MCQ Banks ---');
        if (backup.mcqbanks) {
            for (const bank of backup.mcqbanks) {
                if (bank.questions) {
                    for (const q of bank.questions) {
                        const qData = {
                            question_text: q.questionText || q.question_text,
                            question_image: q.image || q.question_image,
                            explanation: q.explanation,
                            difficulty: q.difficulty || 'medium',
                            marks: q.marks || 1,
                            options: (q.options || []).map(opt => ({
                                option_text: opt.text,
                                label: opt.label,
                                is_correct: opt.label === q.correctAnswer
                            })),
                            // Default IDs if missing
                            chapter_id: new mongoose.Types.ObjectId("69ea0c2e807d4e73dda82c3b"),
                            school_id: new mongoose.Types.ObjectId("69ea0c2e807d4e73dda82c0b"),
                            subject_id: new mongoose.Types.ObjectId("69ea0c2e807d4e73dda82c18")
                        };
                        await MCQQuestion.findOneAndUpdate({ question_text: qData.question_text }, qData, { upsert: true });
                        questionCount++;
                    }
                }
            }
        }
        console.log(`Restored total ${questionCount} MCQ Questions.`);

        console.log('--- Restoring Exam Results with Explanation Enrichment ---');
        if (backup.results) {
            for (const r of backup.results) {
                const { _id, ...rData } = r;
                
                // Enrich each answer with explanation if missing
                if (rData.answers) {
                    for (const ans of rData.answers) {
                        if (!ans.explanation) {
                            // Look up question by text (since IDs might have changed or to be safe)
                            const q = await MCQQuestion.findOne({ question_text: ans.questionText });
                            if (q && q.explanation) {
                                ans.explanation = q.explanation;
                            }
                        }
                    }
                }

                await Result.create(rData).catch(err => console.error(`Result creation failed for ${r._id}:`, err.message));
            }
            console.log(`Restored and enriched ${backup.results.length} Exam Results.`);
        }

        console.log('✅ Restoration Complete! Teacher 1 now has all their old data back.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Restore failed:', err);
        process.exit(1);
    }
}

restoreOldData();
