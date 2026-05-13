const mongoose = require('mongoose');

const markSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subject: { type: String, required: true },
    examType: {
        type: String,
        enum: ['ISA1', 'ISA2', 'ESA', 'Assignment', 'Lab', 'Other'],
        required: true
    },
    marksObtained: { type: Number, required: true, min: 0 },
    totalMarks: { type: Number, required: true, min: 1 },
    remarks: { type: String, default: '' }
}, { timestamps: true });

// Prevent duplicate entries for same student + exam type + subject
markSchema.index({ studentId: 1, subject: 1, examType: 1 }, { unique: true });

module.exports = mongoose.model('Mark', markSchema);
