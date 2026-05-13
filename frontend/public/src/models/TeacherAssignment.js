/**
 * backend/src/models/TeacherAssignment.js
 * Model for Teacher Assignments (Class, Section, Subject)
 */

const mongoose = require('mongoose');

const teacherAssignmentSchema = new mongoose.Schema({
  school_id: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  teacher_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  class_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolClass', required: true },
  section_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true },
  subject_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  academic_year: { type: String, required: true }, // e.g., '2023-24'
  assignment_type: { type: String, enum: ['Regular', 'Visiting', 'Substitute'], default: 'Regular' },
  is_primary_teacher: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TeacherAssignment', teacherAssignmentSchema);
