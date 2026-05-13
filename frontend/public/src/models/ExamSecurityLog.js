/**
 * backend/src/models/ExamSecurityLog.js
 * Model for tracking exam violations and security events
 */

const mongoose = require('mongoose');

const examSecurityLogSchema = new mongoose.Schema({
  exam_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
  chapter_id: { type: mongoose.Schema.Types.ObjectId, ref: 'MCQChapter' },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  school_id: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  violation_type: { 
    type: String, 
    enum: ['tab-switch', 'fullscreen-exit', 'copy-paste', 'multiple-faces', 'other'],
    required: true 
  },
  session_id: { type: String },
  ip_address: { type: String },
  user_agent: { type: String },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ExamSecurityLog', examSecurityLogSchema);
