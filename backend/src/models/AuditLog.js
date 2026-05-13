/**
 * src/models/AuditLog.js
 * Record of blockchain anchors for global state verification
 */

const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    merkleRoot: { type: String, required: true },
    txHash: { type: String, required: true },
    blockNumber: { type: Number },
    signature: { type: String },
    recordCount: { type: Number },
    status: { type: String, enum: ['sealed', 'verified', 'tamper_detected'], default: 'sealed' },
    verifiedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('AuditLog', auditLogSchema);
