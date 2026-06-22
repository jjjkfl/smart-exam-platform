/**
 * src/services/blockchain/auditPulse.js
 * Background service for continuous state anchoring and tamper detection
 */

const Result = require('../../models/Result');
const AuditLog = require('../../models/AuditLog');
const merkleService = require('./merkleService');
const blockchainService = require('./blockchainService');
const hashService = require('./hashService');
const logger = require('../../utils/logger');

// Global tamper state for real-time alerting
let latestTamperAlert = null;

/**
 * Perform a full database audit and anchor the state to the blockchain
 */
const runAuditPulse = async () => {
    try {
        logger.info('AuditPulse: Starting database state integrity check...');

        // 1. Read resultHashes in canonical order
        const leafHashes = [];
        const rows = await Result.find({}, { resultHash: 1, _id: 1, isSealed: 1 })
                             .sort({ _id: 1 })
                             .lean();

        for (const r of rows) {
            let h = r.resultHash;
            // Fallback for legacy records without a pre-computed hash
            if (!h) {
                const fullDoc = await Result.findById(r._id);
                h = hashService.computeResultHash(fullDoc);
                // Self-heal the record for future pulses
                await Result.updateOne({ _id: r._id }, { resultHash: h });
            }
            leafHashes.push(h.startsWith('0x') ? h : `0x${h}`);
        }

        // 3. Create Merkle Tree and get Root
        const tree = merkleService.createTree(leafHashes);
        const currentRoot = tree.root;

        // 4. Check if this root is different from the last sealed root
        const lastAudit = await AuditLog.findOne({ status: { $in: ['sealed', 'verified'] } }).sort({ createdAt: -1 });

        if (lastAudit && lastAudit.merkleRoot === currentRoot) {
            logger.info('AuditPulse: State unchanged. Verification successful.');
            lastAudit.verifiedAt = new Date();
            lastAudit.status = 'verified';
            await lastAudit.save();
            // Clear any existing tamper alert
            latestTamperAlert = null;
            return;
        }

        const recordCount = await Result.countDocuments();
        if (recordCount === 0) {
            logger.info('AuditPulse: No results to anchor. Skipping.');
            return;
        }

        // 5. STATE CHANGE DETECTED — Determine if legitimate insertion or tamper
        let isTampering = false;
        if (lastAudit) {
            if (recordCount >= lastAudit.recordCount) {
                logger.info(`AuditPulse: ${recordCount - lastAudit.recordCount} new result(s) securely appended. Sealing updated root.`);
            } else {
                isTampering = true;
                logger.warn(`🚨 AuditPulse: TAMPER DETECTED! Previous root=${lastAudit.merkleRoot} | New root=${currentRoot}`);

                // Mark the last clean audit as compromised
                lastAudit.status = 'tamper_detected';
                await lastAudit.save();

                // Set the global tamper alert
                latestTamperAlert = {
                    detectedAt: new Date(),
                    previousRoot: lastAudit.merkleRoot,
                    currentRoot,
                    recordCount: recordCount
                };
            }
        }

        // 6. Anchor the new state to the blockchain as evidence/continuation
        let anchorResult = { txHash: 'N/A', blockNumber: null, signature: null };
        try {
            anchorResult = await blockchainService.anchorStateRoot(currentRoot);
        } catch (bcErr) {
            logger.warn(`AuditPulse: Blockchain anchor skipped (offline/local mode): ${bcErr.message}`);
        }

        // 7. Save a new state record
        await AuditLog.create({
            merkleRoot: currentRoot,
            txHash: anchorResult.txHash || 'N/A',
            blockNumber: anchorResult.blockNumber,
            signature: anchorResult.signature,
            recordCount: recordCount,
            status: isTampering ? 'tamper_detected' : 'sealed'
        });

        if (isTampering) {
            logger.warn(`🔒 AuditPulse: Tamper evidence anchored. Tx=${anchorResult.txHash}`);
        } else {
            logger.info(`AuditPulse: Database state root sealed. Tx=${anchorResult.txHash}`);
        }

    } catch (err) {
        logger.error(`AuditPulse failed: ${err.message}`);
    }
};

/**
 * Get the latest tamper alert (used by API endpoint)
 */
const getTamperAlert = () => latestTamperAlert;

/**
 * Get the latest computed Merkle Root
 */
const getLatestMerkleRoot = async () => {
    const AuditLog = require('../../models/AuditLog');
    const lastAudit = await AuditLog.findOne().sort({ createdAt: -1 });
    return lastAudit ? lastAudit.merkleRoot : 'Pending Computation...';
};

/**
 * Initialize the periodic pulse
 * @param {number} intervalMs - Frequency of audit (default 5 minutes)
 */
const initAuditPulse = (intervalMs = 300000) => {
    logger.info(`AuditPulse initialized. Frequency: Every ${intervalMs / 60000} minutes.`);

    // Run immediately on start
    runAuditPulse();

    // Set interval
    setInterval(runAuditPulse, intervalMs);
};

module.exports = {
    runAuditPulse,
    initAuditPulse,
    getTamperAlert,
    getLatestMerkleRoot
};
