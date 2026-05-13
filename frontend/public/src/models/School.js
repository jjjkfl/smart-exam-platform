/**
 * backend/src/models/School.js
 * Model for Schools/Tenants
 */

const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
  name: { type: String, required: true },
  name_slug: { type: String, required: true, unique: true },
  board_type: { type: String, enum: ['CBSE', 'ICSE', 'State Board', 'Other'], default: 'Other' },
  subscription_plan: { type: String, enum: ['Basic', 'Premium', 'Enterprise'], default: 'Basic' },
  max_students_teachers: { type: Number, default: 100 },
  is_active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('School', schoolSchema);
