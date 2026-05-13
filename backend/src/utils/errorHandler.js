/**
 * backend/src/utils/errorHandler.js
 * Centralized error handling utility
 */

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

const handleError = (err, res) => {
  const { statusCode = 500, message } = err;
  res.status(statusCode).json({
    success: false,
    status: 'error',
    statusCode,
    message: statusCode === 500 ? 'Internal Server Error' : message
  });
};

module.exports = {
  AppError,
  handleError
};
