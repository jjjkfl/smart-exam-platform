/**
 * backend/src/middleware/proctorMiddleware.js
 * Security middleware for proctored exam sessions
 */

const { AppError } = require('../utils/errorHandler');

const protectExam = (req, res, next) => {
  // Check if session ID is provided for proctored routes
  const sessionId = req.body.sessionId || req.query.sessionId || req.params.sessionId;
  
  if (!sessionId) {
    return next(new AppError('Active session ID required for proctored access', 400));
  }
  
  // Additional proctoring logic can be added here
  next();
};

module.exports = { protectExam };
