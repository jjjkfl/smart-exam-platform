const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['student', 'teacher'], 
    default: 'student' 
  },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' }, // For students
  courseIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }], // For teachers
  classTag: { type: String, default: '' }, // e.g. "10th Grade"
  division: { type: String, enum: ['A', 'B', 'C', 'D'], required: function() { return this.role === 'student'; } }
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);