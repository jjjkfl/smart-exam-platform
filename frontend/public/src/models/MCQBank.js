/**
 * backend/src/models/MCQBank.js
 * Schema for Multiple Choice Question Banks
 */

const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  image: { type: String, default: '' }, // path to extracted image
  options: [{
    label: { type: String, required: true },
    text: { type: String, required: true },
    image: { type: String, default: '' } // path to extracted image for this option
  }],
  correctAnswer: { type: String, required: true },
  explanation: { type: String },
  marks: { type: Number, default: 1 }
});

const mcqBankSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subject: { type: String, required: true },
  questions: [questionSchema],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  meta: {
    model: { type: String }
  }
});

// Final Safety Net: Ensure no empty text bypasses validation
mcqBankSchema.pre('save', function (next) {
  if (this.questions && Array.isArray(this.questions)) {
    this.questions.forEach(q => {
      if (q.options && Array.isArray(q.options)) {
        q.options.forEach(opt => {
          if (!opt.text || opt.text.trim() === '') {
            opt.text = `Option ${opt.label}`;
          }
        });
      }
    });
  }
  next();
});

module.exports = mongoose.model('MCQBank', mcqBankSchema);