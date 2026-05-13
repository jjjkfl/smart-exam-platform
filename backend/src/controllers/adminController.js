const User = require('../models/User');
const Course = require('../models/Course');
const Session = require('../models/Session');
const Result = require('../models/Result');

// ==========================================
// ADMIN DASHBOARD
// ==========================================
exports.getDashboard = async (req, res) => {
  try {
    const totalTeachers = await User.countDocuments({ role: 'teacher' });
    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalCourses = await Course.countDocuments();
    const activeSessions = await Session.countDocuments({ status: 'active' });

    const recentSessions = await Session.find()
      .populate('courseId', 'courseName')
      .sort('-createdAt')
      .limit(10);

    res.json({
      success: true,
      data: {
        stats: { totalTeachers, totalStudents, totalCourses, activeSessions },
        recentSessions
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==========================================
// USER MANAGEMENT (CRUD)
// ==========================================
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find({ role: { $ne: 'admin' } }).populate('courseId', 'courseName').select('-password');
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role, courseId, division } = req.body;
    const user = await User.create({ name, email, password, role, courseId, division });
    res.status(201).json({ success: true, data: { _id: user._id, name, email, role } });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { name, email, role, courseId, division } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, email, role, courseId, division },
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==========================================
// COURSE MANAGEMENT (CRUD)
// ==========================================
exports.getCourses = async (req, res) => {
  try {
    const courses = await Course.find().populate('teacherId', 'name email');
    res.json({ success: true, data: courses });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createCourse = async (req, res) => {
  try {
    const { courseName, teacherId } = req.body;
    const course = await Course.create({ courseName, teacherIds: teacherId ? [teacherId] : [] });
    
    if (teacherId) {
      await User.findByIdAndUpdate(teacherId, { $addToSet: { courseIds: course._id } });
    }
    res.status(201).json({ success: true, data: course });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.updateCourse = async (req, res) => {
  try {
    const { courseName, teacherId } = req.body;
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    course.courseName = courseName || course.courseName;
    
    if (teacherId && !course.teacherIds.includes(teacherId)) {
      course.teacherIds.push(teacherId);
      await User.findByIdAndUpdate(teacherId, { $addToSet: { courseIds: course._id } });
    }
    
    await course.save();
    res.json({ success: true, data: course });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.deleteCourse = async (req, res) => {
  try {
    const course = await Course.findByIdAndDelete(req.params.id);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    res.json({ success: true, message: 'Course deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
