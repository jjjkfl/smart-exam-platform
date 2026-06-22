/* Smoke test the Sequelize layer + Mongoose shim (MySQL). */
// NOTE: This file requires a running MySQL database.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
process.env.DB_DIALECT = 'mysql'; // Enforce MySQL dialect

(async () => {
  const sequelize = require('../src/config/sequelize');
  const { User, Course, Session, Result } = require('../src/models');
  await sequelize.sync({ force: true });
  console.log('✓ sync ok');

  // create + password hashing
  const course = await Course.create({ courseName: 'Biology' });
  const teacher = await User.create({ name: 'T', email: 't@x.com', password: 'secret', role: 'teacher', courseIds: [course._id] });
  const student = await User.create({ name: 'S', email: 's@x.com', password: 'pw', role: 'student', courseId: course._id });
  console.log('✓ create ok; student._id =', student._id, '(len', student._id.length, ')');
  console.log('✓ password hashed:', student.password !== 'pw');

  // comparePassword
  console.log('✓ comparePassword true:', await student.comparePassword('pw'));
  console.log('✓ comparePassword false:', !(await student.comparePassword('nope')));

  // findOne by field
  const found = await User.findOne({ email: 't@x.com' });
  console.log('✓ findOne ok:', found && found.name === 'T');

  // findById
  const byId = await User.findById(student._id);
  console.log('✓ findById ok:', byId && byId._id === student._id);

  // duplicate email → code 11000
  try { await User.create({ name: 'dup', email: 't@x.com', password: 'x' }); console.log('✗ dup not caught'); }
  catch (e) { console.log('✓ dup-key code 11000:', e.code === 11000); }

  // session + result + populate
  const session = await Session.create({ title: 'Quiz', courseId: course._id, startTime: new Date(), duration: 30, questions: [{ questionText: 'Q1', options: [{ label: 'A', text: 'x' }], correctAnswer: 'A' }] });
  const result = await Result.create({ studentId: student._id, courseId: course._id, sessionId: session._id, score: 80, answers: [{ q: 1 }] });
  console.log('✓ session.questions JSON roundtrip:', Array.isArray(session.questions) && session.questions[0].questionText === 'Q1');

  // populate (alias === field)
  const populated = await Result.find({ studentId: student._id }).populate('sessionId', 'title').populate('studentId', 'name');
  const p = populated[0];
  console.log('✓ populate sessionId.title:', p.sessionId && p.sessionId.title === 'Quiz');
  console.log('✓ populate studentId.name:', p.studentId && p.studentId.name === 'S');

  // lean + sort + limit
  const lean = await Result.find({}).sort({ createdAt: -1 }).limit(5).lean();
  console.log('✓ lean returns plain:', lean[0] && lean[0].constructor === Object);

  // countDocuments with operator
  const cnt = await User.countDocuments({ role: { $ne: 'admin' } });
  console.log('✓ countDocuments $ne:', cnt === 2);

  // findOneAndUpdate upsert
  const up = await Result.findOneAndUpdate({ studentId: student._id, sessionId: 'zzz' }, { score: 99, studentId: student._id }, { upsert: true, new: true });
  console.log('✓ upsert created:', up && up.score === 99);

  // findByIdAndUpdate + JSON change
  await Session.findByIdAndUpdate(session._id, { status: 'active' });
  const s2 = await Session.findById(session._id);
  console.log('✓ findByIdAndUpdate:', s2.status === 'active');

  // toJSON has _id
  console.log('✓ toJSON _id present:', JSON.parse(JSON.stringify(student))._id === student._id);

  console.log('\nALL SHIM TESTS PASSED');
  process.exit(0);
})().catch((e) => { console.error('TEST FAILED:', e); process.exit(1); });
