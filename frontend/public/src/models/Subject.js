/**
 * backend/src/models/Subject.js
 * Model for Subjects
 */

const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  school_id: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  name: { type: String, required: true },
  code: { type: String, required: true },
  subject_type: { type: String, enum: ['Theory', 'Practical', 'Both'], default: 'Theory' },
  applicable_classes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SchoolClass' }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Subject', subjectSchema);
