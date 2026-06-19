const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  const primaryURI = process.env.MONGO_URI;
  const localURI = 'mongodb://127.0.0.1:27017/surgical_exam_db';
  const options = {
    serverSelectionTimeoutMS: 5000, // Wait up to 5s before timing out
    socketTimeoutMS: 45000,
  };

  try {
    logger.info('Connecting to primary MongoDB (Atlas)...');
    const conn = await mongoose.connect(primaryURI, options);
    logger.info(`✅ MongoDB Connected to Atlas: ${conn.connection.host}`);
  } catch (err) {
    logger.warn(`⚠️ Primary MongoDB Connection Failed: ${err.message}`);
    logger.warn('👉 TIP: Check if your IP is whitelisted in MongoDB Atlas Network Access.');
    logger.warn('👉 Attempting connection fallback to local MongoDB...');
    try {
      const conn = await mongoose.connect(localURI, options);
      logger.info(`✅ MongoDB Connected to Local Fallback: ${conn.connection.host}`);
    } catch (localErr) {
      logger.error(`❌ Local MongoDB Connection also failed: ${localErr.message}`);
      logger.error('👉 Please make sure MongoDB is running locally on port 27017.');
      process.exit(1);
    }
  }

  // Handle runtime connection issues
  mongoose.connection.on('error', (err) => {
    logger.error(`❌ Mongoose Connection Error: ${err.message}`);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('⚠️ Mongoose connection lost.');
  });
};

module.exports = connectDB;