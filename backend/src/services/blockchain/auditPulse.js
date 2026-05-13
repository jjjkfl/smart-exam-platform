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

        // 1. Fetch all results (canonical order by ID)
        const results = await Result.find().sort({ _id: 1 });

        if (results.length === 0) {
            logger.info('AuditPulse: No results to anchor. Skipping.');
            return;
        }

        // 2. Generate canonical hashes for all results
        const leafHashes = results.map(r => {
            const computed = hashService.computeResultHash(r);
            return computed.startsWith('0x') ? computed : `0x${computed}`;
        });

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

        // 5. STATE CHANGE DETECTED — Mark the previous record as TAMPERED
        if (lastAudit) {
            logger.warn(`🚨 AuditPulse: TAMPER DETECTED! Previous root=${lastAudit.merkleRoot} | New root=${currentRoot}`);

            // Mark the last clean audit as compromised
            lastAudit.status = 'tamper_detected';
            await lastAudit.save();

            // Set the global tamper alert
            latestTamperAlert = {
                detectedAt: new Date(),
                previousRoot: lastAudit.merkleRoot,
                currentRoot,
                recordCount: results.length
            };
        }

        // 6. Anchor the new (potentially tampered) state to the blockchain as evidence
        let anchorResult = { txHash: 'N/A', blockNumber: null, signature: null };
        try {
            anchorResult = await blockchainService.anchorStateRoot(currentRoot);
        } catch (bcErr) {
            logger.warn(`AuditPulse: Blockchain anchor failed (offline?): ${bcErr.message}`);
        }

        // 7. Save a new tamper evidence record
        await AuditLog.create({
            merkleRoot: currentRoot,
            txHash: anchorResult.txHash || 'N/A',
            blockNumber: anchorResult.blockNumber,
            signature: anchorResult.signature,
            recordCount: results.length,
            status: lastAudit ? 'tamper_detected' : 'sealed'
        });

        if (lastAudit) {
            logger.warn(`🔒 AuditPulse: Tamper evidence anchored to blockchain. Tx=${anchorResult.txHash}`);
        } else {
            logger.info(`AuditPulse: Initial state sealed to blockchain. Tx=${anchorResult.txHash}`);
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
    getTamperAlert
};
