require('dotenv').config();
const fetch = require('node-fetch');
const mongoose = require('mongoose');

async function test() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/mcqpro');
  const User = require('./src/models/User');

  const student = await User.findOne({ role: 'student' });
  if (!student) {
    console.log('No student found');
    process.exit(1);
  }

  // To log in, we need the raw password. Since passwords are hashed, we can just generate a JWT for the student.
  const jwt = require('jsonwebtoken');
  const token = jwt.sign({ id: student._id }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '1d' });

  try {
    const res = await fetch('http://localhost:5000/api/portal/student/schedule', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Body:', text);
  } catch (err) {
    console.error('Fetch error:', err);
  }
  process.exit(0);
}

test();
