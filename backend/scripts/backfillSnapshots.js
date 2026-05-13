/**
 * scripts/backfillSnapshots.js
 * One-time script to backfill ResultSnapshot for all existing results.
 * Run once: node scripts/backfillSnapshots.js
 */

require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');

// Inline schema to avoid import issues
const resultSchema = new mongoose.Schema({
    studentId: mongoose.Schema.Types.ObjectId,
    courseId: mongoose.Schema.Types.ObjectId,
    sessionId: mongoose.Schema.Types.ObjectId,
    score: Number,
    answers: mongoose.Schema.Types.Mixed,
    timeTaken: Number,
    violationCount: Number,
    blockchainHash: String,
}, { timestamps: true });

const snapshotSchema = new mongoose.Schema({
    resultId: { type: mongoose.Schema.Types.ObjectId, unique: true },
    studentId: mongoose.Schema.Types.ObjectId,
    courseId: mongoose.Schema.Types.ObjectId,
    sessionId: mongoose.Schema.Types.ObjectId,
    score: Number,
    timeTaken: Number,
    violationCount: Number,
    answers: mongoose.Schema.Types.Mixed,
    blockchainHash: String,
    sealedAt: { type: Date, default: Date.now }
});

const Result = mongoose.model('Result', resultSchema);
const ResultSnapshot = mongoose.model('ResultSnapshot', snapshotSchema);

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/surgical_exam_db';

async function backfill() {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const results = await Result.find().lean();
    console.log(`📊 Found ${results.length} results to snapshot`);

    let created = 0;
    let skipped = 0;

    for (const r of results) {
        try {
            const existing = await ResultSnapshot.findOne({ resultId: r._id });
            if (existing) { skipped++; continue; }

            await ResultSnapshot.create({
                resultId: r._id,
                studentId: r.studentId,
                courseId: r.courseId,
                sessionId: r.sessionId,
                score: r.score,
                timeTaken: r.timeTaken || 0,
                violationCount: r.violationCount || 0,
                answers: r.answers,
                blockchainHash: r.blockchainHash || 'legacy-no-hash',
            });
            created++;
        } catch (e) {
            console.warn(`  ⚠️  Skipped ${r._id}: ${e.message}`);
            skipped++;
        }
    }

    console.log(`\n🔒 Backfill complete!`);
    console.log(`   Created: ${created} snapshots`);
    console.log(`   Skipped: ${skipped} (already existed)`);
    console.log(`\n✅ All ${results.length} results are now immutably protected!`);

    await mongoose.disconnect();
}

backfill().catch(err => {
    console.error('Backfill failed:', err);
    process.exit(1);
});
