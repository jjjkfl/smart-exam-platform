const Session = require('../models/Session');

function initExamScheduler() {
  // Run every 10 seconds
  setInterval(async () => {
    try {
      const now = new Date();

      // 1. Activate pending exams whose startTime has arrived
      const sessionsToActivate = await Session.find({
        status: 'pending',
        startTime: { $lte: now }
      });

      if (sessionsToActivate.length > 0) {
        const { getIO, store } = require('../config/socket');
        const io = getIO();
        
        for (const session of sessionsToActivate) {
          session.status = 'active';
          await session.save();
          
          if (io && store) {
            const sessionIdStr = String(session._id);
            const endTime = await store.startRoom(sessionIdStr, session.duration);
            io.to(sessionIdStr).emit('exam:started', { endTime, durationMinutes: session.duration });
          }
        }
        console.log(`[ExamScheduler] Activated ${sessionsToActivate.length} scheduled exam(s).`);
      }

      // 2. Complete active/pending exams whose duration has expired
      // duration is in minutes. We calculate: startTime + duration * 60 * 1000 <= now
      const sessionsToComplete = await Session.find({
        status: { $in: ['pending', 'active'] },
        $expr: {
          $lte: [
            { $add: ["$startTime", { $multiply: ["$duration", 60, 1000] }] },
            now
          ]
        }
      });

      if (sessionsToComplete.length > 0) {
        const { getIO, store } = require('../config/socket');
        const io = getIO();
        
        for (const session of sessionsToComplete) {
          session.status = 'completed';
          await session.save();
          
          if (io && store) {
            const sessionIdStr = String(session._id);
            io.to(sessionIdStr).emit('exam:ended', { reason: 'time_up' });
            await store.deleteRoom(sessionIdStr);
          }
        }
        console.log(`[ExamScheduler] Completed ${sessionsToComplete.length} expired exam(s).`);
      }
    } catch (err) {
      console.error('[ExamScheduler Error]', err);
    }
  }, 10000); // 10 seconds interval
  
  console.log('⏰ Exam Auto-Activation Scheduler initialized.');
}

module.exports = { initExamScheduler };
