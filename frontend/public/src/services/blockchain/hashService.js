/**
 * src/services/blockchain/hashService.js
 * SHA256 hashing utilities for result integrity
 */

const crypto = require('crypto');
const CryptoJS = require('crypto-js');

/**
 * Compute SHA256 hash of a result payload
 * @param {Object} resultData
 * @returns {string} hex hash
 */
exports.computeResultHash = (resultData) => {
  // Canonical payload uses actual Result schema fields
  const canonicalPayload = {
    resultId: resultData._id?.toString(),
    studentId: resultData.studentId?.toString() || resultData.student?.toString(),
    courseId: resultData.courseId?.toString(),
    sessionId: resultData.sessionId?.toString() || resultData.session?.toString(),
    score: Number(resultData.score),
    timeTaken: Number(resultData.timeTaken || 0),
    violationCount: Number(resultData.violationCount || 0),
    // Hash the answer correctness pattern — any change to answers is detected
    answersHash: resultData.answers
      ? resultData.answers.map(a => `${a.selectedAnswer}:${a.correctAnswer}:${a.isCorrect}`).join('|')
      : '',
  };

  const sorted = JSON.stringify(canonicalPayload, Object.keys(canonicalPayload).sort());
  return crypto.createHash('sha256').update(sorted, 'utf8').digest('hex');
};

/**
 * Verify a hash matches the result data
 * @param {Object} resultData
 * @param {string} hash
 * @returns {boolean}
 */
exports.verifyHash = (resultData, hash) => {
  const computed = exports.computeResultHash(resultData);
  return computed === hash;
};

/**
 * Convert hex string to bytes32 for Solidity
 * @param {string} hexHash
 * @returns {string} 0x-prefixed bytes32
 */
exports.hexToBytes32 = (hexHash) => {
  const clean = hexHash.replace(/^0x/, '');
  return `0x${clean.padEnd(64, '0').slice(0, 64)}`;
};

/**
 * Compute AES-encrypted hash for additional layer
 * @param {string} plainHash
 * @returns {string}
 */
exports.encryptHash = (plainHash) => {
  const key = process.env.AES_SECRET_KEY || 'fallback_key_32_chars!!!!!!!!!';
  return CryptoJS.AES.encrypt(plainHash, key).toString();
};

/**
 * Decrypt AES-encrypted hash
 * @param {string} encryptedHash
 * @returns {string}
 */
exports.decryptHash = (encryptedHash) => {
  const key = process.env.AES_SECRET_KEY || 'fallback_key_32_chars!!!!!!!!!';
  try {
    return CryptoJS.AES.decrypt(encryptedHash, key).toString(CryptoJS.enc.Utf8);
  } catch {
    return null;
  }
};

/**
 * Generate a unique certificate hash
 * @param {Object} result
 * @param {Object} student
 * @returns {string}
 */
exports.generateCertificateHash = (result, student) => {
  const payload = JSON.stringify({
    resultId: result._id?.toString(),
    resultHash: result.resultHash,
    studentId: student._id?.toString(),
    issuedAt: new Date().toISOString(),
    nonce: crypto.randomBytes(16).toString('hex'),
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
};

/**
 * Compute HMAC signature for API responses
 * @param {string} data
 * @param {string} secret
 * @returns {string}
 */
exports.computeHMAC = (data, secret = process.env.JWT_SECRET) => {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
};