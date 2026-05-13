/**
 * src/services/blockchain/changeStreamGuardian.js
 * Self-healing polling guardian — scans all results every 60 seconds
 * and reverts any that don't match their immutable snapshot.
 * Works with ANY MongoDB configuration (no replica set required).
 */

const logger = require('../../utils/logger');

let guardianInterval = null;

const runGuardianScan = async () => {
    // Lazy-require to avoid circular dependencies / model load order issues
    const Result = require('../../models/Result');
    const ResultSnapshot = require('../../models/ResultSnapshot');
    const mongoose = require('mongoose');

    try {
        const snapshots = await ResultSnapshot.find().lean();

        if (snapshots.length === 0) return;

        let tampersFound = 0;
        let tampersReverted = 0;

        for (const snapshot of snapshots) {
            const result = await Result.findById(snapshot.resultId).lean();
            if (!result) continue;

            // Check for tampering on any protected field
            const scoreChanged = result.score !== snapshot.score;
            const violationsChanged = result.violationCount !== snapshot.violationCount;
            const answersChanged = JSON.stringify(result.answers) !== JSON.stringify(snapshot.answers);

            if (scoreChanged || violationsChanged || answersChanged) {
                tampersFound++;
                logger.warn(`🚨 Guardian: TAMPER on result ${result._id} | score: ${result.score} → expected: ${snapshot.score}`);

                try {
                    // Revert directly via native driver to bypass any middleware
                    await mongoose.connection.db.collection('results').updateOne(
                        { _id: snapshot.resultId },
                        {
                            $set: {
                                score: snapshot.score,
                                answers: snapshot.answers,
                                timeTaken: snapshot.timeTaken,
                                violationCount: snapshot.violationCount,
                                blockchainHash: snapshot.blockchainHash,
                                _tamperAttempt: {
                                    detectedAt: new Date(),
                                    attemptedScore: result.score,
                                    revertedTo: snapshot.score
                                }
                            }
                        }
                    );
                    tampersReverted++;
                    logger.info(`✅ Guardian: Result ${result._id} auto-reverted to score=${snapshot.score}`);
                } catch (revertErr) {
                    logger.error(`Guardian: Failed to revert ${result._id}: ${revertErr.message}`);
                }
            }
        }

        if (tampersFound > 0) {
            logger.warn(`🔒 Guardian scan complete: ${tampersReverted}/${tampersFound} tampers reverted.`);
        }

    } catch (err) {
        logger.error(`Guardian scan failed: ${err.message}`);
    }
};

const initChangeStreamGuardian = () => {
    logger.info('🛡️  ChangeStreamGuardian: Starting polling-based self-healing protection (every 60s)...');

    // Run immediately on start
    runGuardianScan();

    // Then every 60 seconds
    if (guardianInterval) clearInterval(guardianInterval);
    guardianInterval = setInterval(runGuardianScan, 60 * 1000);

    logger.info('🛡️  ChangeStreamGuardian: Protection ACTIVE — any unauthorized score change will be reverted automatically.');
};

module.exports = { initChangeStreamGuardian };
