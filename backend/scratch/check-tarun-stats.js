const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });
const User = require('../src/models/User');
const { getGlobalAnalytics } = require('../src/controllers/studentController');

const check = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB...');

    const user = await User.findOne({ email: 'student1@exam.com' }).lean();
    if (!user) {
      console.error('User Tarun not found!');
      process.exit(1);
    }
    console.log('User found in DB:', user);

    // Mock request and response to run getGlobalAnalytics
    const req = { user };
    const res = {
      json: (data) => {
        console.log('Global Analytics Data for Tarun:', JSON.stringify(data, null, 2));
      },
      status: (code) => {
        console.log('Status code:', code);
        return res;
      }
    };

    await getGlobalAnalytics(req, res);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

check();
