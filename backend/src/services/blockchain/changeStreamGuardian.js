/**
 * src/services/blockchain/changeStreamGuardian.js
 * Self-healing polling guardian — scans all results every 60 seconds
 * and reverts any that don't match their immutable snapshot.
 * Works with ANY MongoDB configuration (no replica set required).
 */

const logger = require('../../utils/logger');

let guardianInterval = null;

const guardianStats = {
    totalScans: 0,
    tampersFound: 0,
    tampersReverted: 0,
    lastScanTime: null,
    status: 'ACTIVE'
};

let isScanning = false;

const runGuardianScan = async () => {
    if (isScanning) return;
    isScanning = true;

    // Lazy-require to avoid circular dependencies / model load order issues
    const Result = require('../../models/Result');
    const ResultSnapshot = require('../../models/ResultSnapshot');
    const mongoose = require('mongoose');

    try {
        const cursor = ResultSnapshot.find().lean().cursor();
        let snapshotCount = 0;
        let tampersFound = 0;
        let tampersReverted = 0;
        guardianStats.totalScans++;

        for (let snapshot = await cursor.next(); snapshot != null; snapshot = await cursor.next()) {
            snapshotCount++;
            const result = await Result.findById(snapshot.resultId).lean();
            if (!result) continue;

            // Check for tampering on any protected field
            const scoreChanged = result.score !== snapshot.score;
            const violationsChanged = result.violationCount !== snapshot.violationCount;
            const answersChanged = JSON.stringify(result.answers) !== JSON.stringify(snapshot.answers);

            if (scoreChanged || violationsChanged || answersChanged) {
                tampersFound++;
                const diffLabel = scoreChanged ? `Score: ${result.score}→${snapshot.score}` : 'Metadata Change';
                logger.warn(`🚨 Guardian: TAMPER on result ${result._id} | ${diffLabel}`);

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

                    // 1. Notify Teachers via Socket
                    const { getIO } = require('../../config/socket');
                    const io = getIO();
                    if (io) {
                        io.emit('TAMPER_ALERT', {
                            message: `🚨 SECURITY ALERT: Unauthorized change detected on result for student. System has auto-reverted the score to ${snapshot.score}.`,
                            resultId: result._id,
                            diff: diffLabel,
                            timestamp: new Date()
                        });
                    }

                    // 2. Create System Announcement for Teachers
                    const Announcement = require('../../models/Announcement');
                    await Announcement.create({
                        title: '🔒 Security Auto-Revert Triggered',
                        content: `An unauthorized database edit was detected for a result (ID: ${result._id}). The ChangeStreamGuardian has successfully reverted the record using its blockchain-backed snapshot.`,
                        courseId: result.courseId,
                        authorId: snapshot.teacherId || null // Use snapshot's teacher ID if available
                    });

                    logger.info(`✅ Guardian: Result ${result._id} auto-reverted and teacher notified.`);
                } catch (revertErr) {
                    logger.error(`Guardian: Failed to revert/notify ${result._id}: ${revertErr.message}`);
                }
            }
        }

        if (tampersFound > 0) {
            guardianStats.tampersFound += tampersFound;
            guardianStats.tampersReverted += tampersReverted;
            logger.warn(`🔒 Guardian scan complete: ${tampersReverted}/${tampersFound} tampers reverted and alerts sent.`);
        }
        guardianStats.lastScanTime = new Date();

    } catch (err) {
        logger.error(`Guardian scan failed: ${err.message}\n${err.stack}`);
    } finally {
        isScanning = false;
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

const getGuardianStats = () => guardianStats;

module.exports = { initChangeStreamGuardian, getGuardianStats };
