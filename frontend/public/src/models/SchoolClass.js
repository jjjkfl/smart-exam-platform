/**
 * backend/src/models/SchoolClass.js
 * Model for Classes within a School
 */

const mongoose = require('mongoose');

const schoolClassSchema = new mongoose.Schema({
  school_id: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  name: { type: String, required: true }, // e.g., 'Grade 10'
  display_name: { type: String }, // e.g., 'Class X'
  order: { type: Number, default: 0 },
  is_active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SchoolClass', schoolClassSchema);
