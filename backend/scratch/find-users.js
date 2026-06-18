const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });
const User = require('../src/models/User');

const findUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to Atlas DB...');

    console.log('--- Searching for Users ---');
    const allUsers = await User.find({}).select('name email role courseId division').lean();
    console.log('Total users:', allUsers.length);
    console.log(allUsers);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

findUsers();
