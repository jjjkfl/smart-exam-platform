/**
 * backend/src/models/MCQChapter.js
 * Model for MCQ Chapters (Groupings of questions)
 */

const mongoose = require('mongoose');

const mcqChapterSchema = new mongoose.Schema({
  school_id: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  assignment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'TeacherAssignment' },
  subject_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  class_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolClass', required: true },
  name: { type: String, required: true }, // e.g., 'Chapter 1: Anatomy'
  description: { type: String },
  time_limit: { type: Number, default: 30 }, // in minutes
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MCQChapter', mcqChapterSchema);
