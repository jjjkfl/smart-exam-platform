const mongoose = require('mongoose');
const MONGO_URI = 'mongodb://127.0.0.1:27017/surgical_exam_db';

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const Session = require('c:/Users/Tarun Siddappagoudar/smart-exam-platform/backend/src/models/Session');
    const Result = require('c:/Users/Tarun Siddappagoudar/smart-exam-platform/backend/src/models/Result');

    const sessions = await Session.find().sort({ createdAt: -1 }).limit(3);
    console.log('=== LATEST SESSIONS ===');
    sessions.forEach(s => {
      console.log(`Session: ${s.title} (${s._id})`);
      s.questions.forEach((q, idx) => {
        console.log(`  Q${idx+1}: ${q.questionText}`);
        console.log(`    Options:`, q.options.map(o => `${o.label}: ${o.text}`));
        console.log(`    Correct: ${q.correctAnswer}`);
        console.log(`    Explanation: ${q.explanation}`);
      });
    });

    const results = await Result.find().sort({ createdAt: -1 }).limit(3);
    console.log('=== LATEST RESULTS ===');
    results.forEach(r => {
      console.log(`Result ID: ${r._id} for Session: ${r.sessionId}`);
      r.answers.forEach((a, idx) => {
        console.log(`  Ans${idx+1}: ${a.questionText}`);
        console.log(`    Selected: ${JSON.stringify(a.selectedAnswer)}`);
        console.log(`    Correct: ${JSON.stringify(a.correctAnswer)}`);
        console.log(`    Explanation: ${a.explanation}`);
      });
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
