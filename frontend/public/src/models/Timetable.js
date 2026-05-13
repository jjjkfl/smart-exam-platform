const mongoose = require('mongoose');

const timetableSchema = new mongoose.Schema({
  day: {
    type: String,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    required: true
  },
  time: {
    type: String,
    required: true, // e.g. "09:00 AM - 10:00 AM" or "09:00 AM"
  },
  title: {
    type: String,
    required: true, // e.g. "Biology Lecture"
  },
  targetClass: {
    type: String, // e.g. "Grade 10" or "All"
    required: true,
    default: 'All'
  },
  targetDivision: {
    type: String, // e.g. "A" or "All"
    required: true,
    default: 'All'
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Timetable', timetableSchema);
