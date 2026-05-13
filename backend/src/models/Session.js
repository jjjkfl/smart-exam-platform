const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
  division: { type: String },
  title: { type: String, required: true },
  /** Carried from MCQ bank (or set manually) for per-subject reporting */
  subject: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'active', 'completed'], default: 'pending' },
  questions: [{
    questionText: String,
    options: [{
      label: String,
      text: String
    }],
    correctAnswer: String,
    explanation: String,
    marks: { type: Number, default: 1 },
    image: String
  }],
  startTime: { type: Date, required: true },
  duration: { type: Number, required: true }, // in minutes
  liveClassLink: { type: String, default: '' },
  negativeMarking: { type: Boolean, default: false },
  board: { type: String, required: false },
  
  // Advanced Proctoring Settings
  enableAIProctoring: { type: Boolean, default: true },
  maxViolations: { type: Number, default: 5 },
  lockBrowser: { type: Boolean, default: true },
  requireCamera: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Session', sessionSchema);