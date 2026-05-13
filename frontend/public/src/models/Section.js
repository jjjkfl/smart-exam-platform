/**
 * backend/src/models/Section.js
 * Model for Sections within a Class
 */

const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema({
  school_id: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  class_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolClass', required: true },
  name: { type: String, required: true }, // e.g., 'A', 'B'
  order: { type: Number, default: 0 },
  is_active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Section', sectionSchema);
