const User = require('../models/User');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
  try {
    const { name, email, password, role, courseId, division, board } = req.body;
    const user = await User.create({ name, email, password, role, courseId, division, board });
    
    const accessToken = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.status(201).json({ 
      success: true, 
      accessToken, 
      user: { id: user._id, name: user.name, role: user.role } 
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'This email address is already registered.' });
    }
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const accessToken = jwt.sign({ 
      id: user._id, 
      role: user.role,
      courseId: user.courseId,
      courseIds: user.courseIds,
      division: user.division
    }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ 
      success: true, 
      accessToken, 
      user: { id: user._id, name: user.name, role: user.role } 
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const crypto = require('crypto');
const emailService = require('../services/emailService');

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with that email address.' });
    }

    // Generate a 6-digit code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Hash code for DB storage
    const bcrypt = require('bcryptjs');
    const hashedCode = await bcrypt.hash(resetCode, 10);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV] Password reset code for ${user.email}: ${resetCode}`);
    }

    user.resetPasswordCode = hashedCode;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 minutes expiry
    await user.save();

    const message = `Your password reset code is: ${resetCode}\nThis code is valid for 15 minutes.`;

    await emailService.sendEmail({
      to: user.email,
      subject: 'Password Reset Code - MCQPro',
      text: message
    });

    res.json({ success: true, message: 'Reset code sent to email' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.verifyResetCode = async (req, res) => {
  try {
    const { email, code } = req.body;
    const user = await User.findOne({ email });
    
    if (!user || !user.resetPasswordCode || !user.resetPasswordExpires) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset code.' });
    }

    if (Date.now() > user.resetPasswordExpires) {
      return res.status(400).json({ success: false, message: 'Reset code has expired.' });
    }

    const bcrypt = require('bcryptjs');
    const isMatch = await bcrypt.compare(code, user.resetPasswordCode);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Incorrect reset code.' });
    }

    res.json({ success: true, message: 'Code verified successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    const user = await User.findOne({ email });

    if (!user || !user.resetPasswordCode || !user.resetPasswordExpires) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset code.' });
    }

    if (Date.now() > user.resetPasswordExpires) {
      return res.status(400).json({ success: false, message: 'Reset code has expired.' });
    }

    const bcrypt = require('bcryptjs');
    const isMatch = await bcrypt.compare(code, user.resetPasswordCode);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Incorrect reset code.' });
    }

    user.password = newPassword; // Will be hashed by pre-save hook
    user.resetPasswordCode = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ success: true, message: 'Password has been reset successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};