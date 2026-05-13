const User = require('../models/User');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
  try {
    const { name, email, password, role, courseId, division } = req.body;
    const user = await User.create({ name, email, password, role, courseId, division });
    
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