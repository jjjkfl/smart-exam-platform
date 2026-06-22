/* End-to-end test of the real controllers against the Sequelize shim (MySQL). */
// NOTE: This file requires a running MySQL database.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
process.env.JWT_SECRET = 'test';
process.env.DB_DIALECT = 'mysql'; // Enforce MySQL dialect

const sequelize = require('../src/config/sequelize');
const M = require('../src/models');
const studentCtrl = require('../src/controllers/studentController');
const teacherCtrl = require('../src/controllers/teacherController');
const eduCtrl = require('../src/controllers/eduController');
const adminCtrl = require('../src/controllers/adminController');

let failures = 0;
function ok(cond, label, extra) {
  if (cond) console.log('✓', label);
  else { console.log('✗', label, '→', JSON.stringify(extra)); failures++; }
}
function mockRes() {
  const r = { statusCode: 200 };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (d) => { r.body = d; return r; };
  r.send = (d) => { r.body = d; return r; };
  r.set = () => r;
  return r;
}
async function call(fn, req) { const res = mockRes(); await fn(req, res); return res; }

(async () => {
  await sequelize.sync({ force: true });

  const course = await M.Course.create({ courseName: 'Biology' });
  const teacher = await M.User.create({ name: 'Teach', email: 'te@x.com', password: 'pw', role: 'teacher', courseIds: [course._id] });
  const student = await M.User.create({ name: 'Stud', email: 'st@x.com', password: 'pw', role: 'student', courseId: course._id, division: 'A', classTag: '10' });
  const teacherUser = await M.User.findById(teacher._id);
  const studentUser = await M.User.findById(student._id);

  // 1. Teacher creates a session
  let res = await call(teacherCtrl.createSession, { user: teacherUser, body: { title: 'Quiz1', scheduledStart: new Date(Date.now() - 1000).toISOString(), durationMinutes: 30, division: 'A', courseId: course._id, board: 'All', subject: 'Biology' } });
  ok(res.statusCode === 201 && res.body.data._id, 'teacher createSession', res.body);
  const sessionId = res.body.data._id;

  // Activate it + add a question (questions get _id via beforeSave hook)
  await M.Session.findByIdAndUpdate(sessionId, {
    status: 'active',
    questions: [{ questionText: '2+2?', options: [{ label: 'A', text: '4' }, { label: 'B', text: '5' }], correctAnswer: 'A', explanation: 'math' }],
  });

  // 2. Teacher dashboard (counts + submission-count rewrite + populate)
  res = await call(teacherCtrl.getDashboard, { user: teacherUser });
  ok(res.body.success && res.body.data.stats.totalSessions === 1, 'teacher getDashboard', res.body);

  // 3. Student sees the active exam, correctAnswer hidden
  res = await call(studentCtrl.getAvailableExams, { user: studentUser, query: {} });
  ok(res.body.success && res.body.data.length === 1, 'student getAvailableExams', res.body);

  res = await call(studentCtrl.getExamQuestions, { user: studentUser, params: { sessionId } });
  const q0 = res.body.data.questions[0];
  ok(res.body.success && q0 && q0.correctAnswer === undefined && q0._id, 'getExamQuestions hides answer, keeps _id', q0);
  const questionId = q0._id;

  // 4. Submit a correct answer → score 100
  res = await call(studentCtrl.submitExam, { user: studentUser, body: { sessionId, answers: [{ questionId, selectedOption: 'A' }], violations: 0, violationHistory: [], timeTaken: 12 } });
  ok(res.statusCode === 201 && res.body.data.percentage === 100, 'submitExam scores correctly', res.body);
  const resultId = res.body.data.resultId;

  // 5. Duplicate submit is blocked by the unique (sessionId, studentId) index
  res = await call(studentCtrl.submitExam, { user: studentUser, body: { sessionId, answers: [{ questionId, selectedOption: 'A' }], violations: 0, violationHistory: [], timeTaken: 5 } });
  ok(res.statusCode === 400 && /already submitted/i.test(res.body.message || ''), 'duplicate submit blocked (code 11000)', res.body);

  // 6. Student results list (populate sessionId)
  res = await call(studentCtrl.getMyResults, { user: studentUser });
  ok(res.body.success && res.body.data[0].sessionId && res.body.data[0].sessionId.title === 'Quiz1', 'getMyResults populate', res.body.data && res.body.data[0]);

  // 7. Result detail (peer analytics computed in JS)
  res = await call(studentCtrl.getResultDetail, { user: studentUser, params: { resultId } });
  ok(res.body.success && res.body.data.percentage === 100 && res.body.data.analytics, 'getResultDetail + analytics', res.body);

  // 8. Student dashboard (3 rewritten aggregations)
  res = await call(studentCtrl.getDashboard, { user: studentUser });
  ok(res.body.success && Array.isArray(res.body.data.subjectPerformance) && res.body.data.profile.rank >= 1, 'student getDashboard aggregations', res.body && res.body.data && res.body.data.profile);

  // 9. Teacher general analytics (grade breakdown rewrite)
  res = await call(teacherCtrl.getGeneralAnalytics, { user: teacherUser });
  ok(res.body.success && res.body.data.totalSubmissions === 1 && res.body.data.avgScore === 100, 'teacher getGeneralAnalytics', res.body && res.body.data);

  // 10. Attendance upsert (eduController)
  res = await call(eduCtrl.markAttendance, { user: teacherUser, body: { sessionId, studentId: student._id, status: 'present' } });
  ok(res.body.success && res.body.data.status === 'present', 'markAttendance upsert', res.body);
  res = await call(eduCtrl.markAttendance, { user: teacherUser, body: { sessionId, studentId: student._id, status: 'late' } });
  const attCount = await M.Attendance.countDocuments({ studentId: student._id });
  ok(res.body.data.status === 'late' && attCount === 1, 'markAttendance upsert updates (no dup)', { attCount });

  // 11. Teacher marks add (upsert) + student reads
  res = await call(teacherCtrl.addMark, { user: teacherUser, body: { studentId: student._id, courseId: course._id, subject: 'Biology', examType: 'ISA1', marksObtained: 18, totalMarks: 20 } });
  ok(res.body.success, 'teacher addMark', res.body);

  // 12. Admin dashboard (populate + counts)
  const admin = await M.User.create({ name: 'Adm', email: 'ad@x.com', password: 'pw', role: 'teacher' });
  const adminUser = await M.User.findById(admin._id); adminUser.role = 'admin';
  res = await call(adminCtrl.getDashboard, { user: adminUser });
  ok(res.body.success && res.body.data.stats.totalStudents === 1, 'admin getDashboard', res.body && res.body.data && res.body.data.stats);

  console.log(failures === 0 ? '\nALL CONTROLLER E2E TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error('E2E CRASHED:', e); process.exit(1); });
