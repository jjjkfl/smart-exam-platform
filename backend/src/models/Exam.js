/**
 * backend/src/models/Exam.js
 * Model for Exams
 */

const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
  school_id: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String },
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
  question_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MCQQuestion' }],
  duration: { type: Number, default: 60 }, // in minutes
  is_shuffle: { type: Boolean, default: true },
  neg_mark: { type: Boolean, default: false },
  scheduled_at: { type: Date },
  expires_at: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Exam', examSchema);
