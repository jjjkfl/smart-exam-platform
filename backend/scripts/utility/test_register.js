const mongoose = require('mongoose');
const User = require('./src/models/User');
require('dotenv').config();

async function test() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const email = `test_student_${Date.now()}@example.com`;
    console.log(`Attempting to register ${email}...`);

    const user = await User.create({
      name: 'Test Student',
      email: email,
      password: 'password123',
      role: 'student'
    });

    console.log('✅ Registration SUCCESSFUL in database!');
    console.log('User ID:', user._id);
    
    // Cleanup
    await User.findByIdAndDelete(user._id);
    console.log('Cleaned up test user.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Registration FAILED:', err.message);
    process.exit(1);
  }
}

test();
