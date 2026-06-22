/**
 * src/utils/oid.js
 * Generates and validates MongoDB-style 24-char hex ObjectIds.
 * Used as the CHAR(24) primary key in MySQL so existing _id values
 * (and all cross-table references) carry over from MongoDB unchanged.
 */

const crypto = require('crypto');

const PROCESS_UNIQUE = crypto.randomBytes(5);
let counter = crypto.randomBytes(3).readUIntBE(0, 3);

function generateObjectId() {
  const time = Math.floor(Date.now() / 1000);
  const buf = Buffer.alloc(12);
  buf.writeUInt32BE(time >>> 0, 0);
  PROCESS_UNIQUE.copy(buf, 4, 0, 5);
  counter = (counter + 1) % 0xffffff;
  buf.writeUIntBE(counter, 9, 3);
  return buf.toString('hex');
}

function isValidObjectId(v) {
  if (v == null) return false;
  return /^[0-9a-fA-F]{24}$/.test(String(v));
}

module.exports = { generateObjectId, isValidObjectId };
