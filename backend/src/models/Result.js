const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: false, index: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true, index: true },
  score: { type: Number, required: true },
  answers: [{
    questionText: String,
    image: String,
    options: [{ label: String, text: String }],
    selectedAnswer: mongoose.Schema.Types.Mixed,
    correctAnswer: mongoose.Schema.Types.Mixed,
    explanation: String,
    isCorrect: Boolean
  }],
  timeTaken: { type: Number, default: 0 },
  violationCount: { type: Number, default: 0 },
  violationHistory: [{
    violationType: String,
    detail: String,
    timestamp: { type: Date, default: Date.now }
  }],
  blockchainHash: { type: String, index: true },
  blockchainTx: { type: String },
  /** Pre-computed hash for rapid blockchain auditing */
  resultHash: { type: String, index: true },
  /** Flag to indicate if this record has been verified in a Merkle root */
  isSealed: { type: Boolean, default: false, index: true }
}, { timestamps: true });

resultSchema.index({ sessionId: 1, studentId: 1 }, { unique: true }); // Prevent duplicate submissions

module.exports = mongoose.model('Result', resultSchema);