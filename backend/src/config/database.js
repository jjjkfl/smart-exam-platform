const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    logger.info(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    logger.error(`❌ MongoDB Connection Error: ${err.message}`);
    logger.error('👉 TIP: Check if your IP is whitelisted in MongoDB Atlas Network Access.');
    logger.error('👉 TIP: Verify that your MONGO_URI in the .env file has the correct password.');
    process.exit(1);
  }
};

module.exports = connectDB;