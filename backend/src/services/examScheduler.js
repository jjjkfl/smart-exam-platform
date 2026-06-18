const Session = require('../models/Session');

function initExamScheduler() {
  // Run every 10 seconds
  setInterval(async () => {
    try {
      const now = new Date();

      // 1. Activate pending exams whose startTime has arrived
      const activateResult = await Session.updateMany(
        {
          status: 'pending',
          startTime: { $lte: now }
        },
        {
          $set: { status: 'active' }
        }
      );

      if (activateResult.modifiedCount > 0) {
        console.log(`[ExamScheduler] Activated ${activateResult.modifiedCount} scheduled exam(s).`);
      }

      // 2. Complete active/pending exams whose duration has expired
      // duration is in minutes. We calculate: startTime + duration * 60 * 1000 <= now
      const completeResult = await Session.updateMany(
        {
          status: { $in: ['pending', 'active'] },
          $expr: {
            $lte: [
              { $add: ["$startTime", { $multiply: ["$duration", 60, 1000] }] },
              now
            ]
          }
        },
        {
          $set: { status: 'completed' }
        }
      );

      if (completeResult.modifiedCount > 0) {
        console.log(`[ExamScheduler] Completed ${completeResult.modifiedCount} expired exam(s).`);
      }
    } catch (err) {
      console.error('[ExamScheduler Error]', err);
    }
  }, 10000); // 10 seconds interval
  
  console.log('⏰ Exam Auto-Activation Scheduler initialized.');
}

module.exports = { initExamScheduler };
