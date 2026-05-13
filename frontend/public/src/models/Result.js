const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
  score: { type: Number, required: true },
  answers: [{
    questionText: String,
    image: String,
    options: [{ label: String, text: String }],
    selectedAnswer: String,
    correctAnswer: String,
    isCorrect: Boolean
  }],
  timeTaken: { type: Number, default: 0 },
  violationCount: { type: Number, default: 0 },
  violationHistory: [{
    violationType: String,
    detail: String,
    timestamp: { type: Date, default: Date.now }
  }],
  blockchainHash: { type: String },
  blockchainTx: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Result', resultSchema);