/**
 * backend/src/models/MCQQuestion.js
 * Model for Multiple Choice Questions
 */

const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema({
  option_text: { type: String, required: true },
  option_image: { type: String }, // URL
  option_order: { type: String, enum: ['a', 'b', 'c', 'd', 'e'] },
  is_correct: { type: Boolean, default: false }
});

const mcqQuestionSchema = new mongoose.Schema({
  chapter_id: { type: mongoose.Schema.Types.ObjectId, ref: 'MCQChapter', required: true },
  school_id: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  subject_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  question_text: { type: String, required: true },
  question_image: { type: String }, // URL
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  marks: { type: Number, default: 1 },
  options: [optionSchema],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MCQQuestion', mcqQuestionSchema);
