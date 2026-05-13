/**
 * src/models/ResultSnapshot.js
 * Immutable trusted snapshot of exam results.
 * Created once on exam submission and NEVER updated via application code.
 * Used by the Change Stream Guardian to auto-revert tampered results.
 */

const mongoose = require('mongoose');

const resultSnapshotSchema = new mongoose.Schema({
    // Reference to the original Result document
    resultId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Result',
        required: true,
        unique: true,
        index: true
    },
    // Frozen copy of all critical fields
    studentId: { type: mongoose.Schema.Types.ObjectId, required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, required: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId, required: true },
    score: { type: Number, required: true },
    timeTaken: { type: Number, default: 0 },
    violationCount: { type: Number, default: 0 },
    answers: { type: mongoose.Schema.Types.Mixed },
    // The trusted hash at submission time
    blockchainHash: { type: String, required: true },
    // Cannot be modified after creation
    sealedAt: { type: Date, default: Date.now, immutable: true }
}, {
    timestamps: false,
    // No compound indexes that allow updates — this is truly write-once
});

// Prevent any updates to this collection
resultSnapshotSchema.pre('findOneAndUpdate', function () {
    throw new Error('ResultSnapshot is immutable — modification is forbidden.');
});
resultSnapshotSchema.pre('updateOne', function () {
    throw new Error('ResultSnapshot is immutable — modification is forbidden.');
});
resultSnapshotSchema.pre('updateMany', function () {
    throw new Error('ResultSnapshot is immutable — modification is forbidden.');
});

module.exports = mongoose.model('ResultSnapshot', resultSnapshotSchema);
