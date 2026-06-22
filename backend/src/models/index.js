/**
 * src/models/index.js
 * Defines all models on the shared Sequelize instance, applies the
 * Mongoose-compatibility shim, and wires up associations used by .populate().
 *
 * Primary keys are CHAR(24) holding MongoDB-style ObjectIds so data migrated
 * from MongoDB keeps its _id values and all cross-table references intact.
 * Embedded arrays/objects are stored as JSON columns.
 */

const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const sequelize = require('../config/sequelize');
const { applyShim } = require('./_shim');
const { generateObjectId } = require('../utils/oid');

const ID = () => ({ type: DataTypes.STRING(24) });

// Mongoose auto-assigned an _id to every embedded subdocument; exam scoring
// matches submitted answers to questions by that _id. Replicate it for the
// JSON-stored question arrays so scoring keeps working.
function ensureQuestionIds(arr) {
  if (Array.isArray(arr)) {
    arr.forEach((q) => { if (q && typeof q === 'object' && !q._id) q._id = generateObjectId(); });
  }
}

function def(name, tableName, attrs, { timestamps = false, indexes } = {}) {
  // Models without Sequelize-managed timestamps originally carried a manual
  // `createdAt` (Mongoose: createdAt: { default: Date.now }). Preserve it so
  // queries that sort/filter by createdAt keep working.
  if (!timestamps && !attrs.createdAt) {
    attrs = { ...attrs, createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW } };
  }
  const model = sequelize.define(name, {
    _id: { type: DataTypes.STRING(24), primaryKey: true, defaultValue: generateObjectId },
    ...attrs,
  }, {
    tableName,
    timestamps,
    freezeTableName: true,
    ...(indexes ? { indexes } : {}),
  });
  applyShim(model);
  return model;
}

/* ─── Models ──────────────────────────────────────────────────────────── */

const User = def('User', 'users', {
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.STRING, defaultValue: 'student' },
  courseId: ID(),
  courseIds: { type: DataTypes.JSON, defaultValue: [] },
  classTag: { type: DataTypes.STRING, defaultValue: '' },
  division: { type: DataTypes.STRING },
  board: { type: DataTypes.STRING },
}, { timestamps: true });

User.beforeSave(async (user) => {
  if (user.changed('password')) {
    user.password = await bcrypt.hash(user.password, 10);
  }
});
User.prototype.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

const Course = def('Course', 'courses', {
  courseName: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, defaultValue: '' },
  department: { type: DataTypes.STRING, defaultValue: 'General' },
  driveLink: { type: DataTypes.STRING, defaultValue: '' },
  teacherIds: { type: DataTypes.JSON, defaultValue: [] },
}, { timestamps: true });

const Session = def('Session', 'sessions', {
  courseId: ID(),
  division: { type: DataTypes.STRING },
  title: { type: DataTypes.STRING, allowNull: false },
  subject: { type: DataTypes.STRING, defaultValue: '' },
  status: { type: DataTypes.STRING, defaultValue: 'pending' },
  questions: { type: DataTypes.JSON, defaultValue: [] },
  startTime: { type: DataTypes.DATE },
  duration: { type: DataTypes.INTEGER },
  liveClassLink: { type: DataTypes.STRING, defaultValue: '' },
  negativeMarking: { type: DataTypes.BOOLEAN, defaultValue: false },
  board: { type: DataTypes.STRING },
  enableAIProctoring: { type: DataTypes.BOOLEAN, defaultValue: true },
  maxViolations: { type: DataTypes.INTEGER, defaultValue: 5 },
  lockBrowser: { type: DataTypes.BOOLEAN, defaultValue: true },
  requireCamera: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { timestamps: true });

Session.beforeSave((s) => {
  if (Array.isArray(s.questions)) {
    ensureQuestionIds(s.questions);
    s.changed('questions', true);
  }
});

const Result = def('Result', 'results', {
  studentId: ID(),
  courseId: ID(),
  sessionId: ID(),
  score: { type: DataTypes.FLOAT },
  answers: { type: DataTypes.JSON, defaultValue: [] },
  timeTaken: { type: DataTypes.INTEGER, defaultValue: 0 },
  violationCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  violationHistory: { type: DataTypes.JSON, defaultValue: [] },
  blockchainHash: { type: DataTypes.STRING },
  blockchainTx: { type: DataTypes.STRING },
  resultHash: { type: DataTypes.STRING },
  isSealed: { type: DataTypes.BOOLEAN, defaultValue: false },
  _tamperAttempt: { type: DataTypes.JSON },
}, {
  timestamps: true,
  indexes: [{ unique: true, fields: ['sessionId', 'studentId'], name: 'result_session_student_unique' }],
});

const ResultSnapshot = def('ResultSnapshot', 'resultsnapshots', {
  resultId: { type: DataTypes.STRING(24), unique: true },
  studentId: ID(),
  courseId: ID(),
  sessionId: ID(),
  score: { type: DataTypes.FLOAT },
  timeTaken: { type: DataTypes.INTEGER, defaultValue: 0 },
  violationCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  answers: { type: DataTypes.JSON },
  blockchainHash: { type: DataTypes.STRING },
  sealedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
});
ResultSnapshot.beforeUpdate(() => {
  throw new Error('ResultSnapshot is immutable — modification is forbidden.');
});

const MCQBank = def('MCQBank', 'mcqbanks', {
  title: { type: DataTypes.STRING, allowNull: false },
  subject: { type: DataTypes.STRING },
  board: { type: DataTypes.STRING },
  questions: { type: DataTypes.JSON, defaultValue: [] },
  createdBy: ID(),
  meta: { type: DataTypes.JSON },
}, { timestamps: false });
MCQBank.beforeSave((bank) => {
  if (Array.isArray(bank.questions)) {
    ensureQuestionIds(bank.questions);
    bank.questions.forEach((q) => {
      if (q && Array.isArray(q.options)) {
        q.options.forEach((opt) => {
          if (!opt.text || String(opt.text).trim() === '') opt.text = `Option ${opt.label}`;
        });
      }
    });
    bank.changed('questions', true);
  }
});

const MCQQuestion = def('MCQQuestion', 'mcqquestions', {
  chapter_id: ID(),
  school_id: ID(),
  subject_id: ID(),
  question_text: { type: DataTypes.TEXT },
  question_image: { type: DataTypes.STRING },
  difficulty: { type: DataTypes.STRING, defaultValue: 'medium' },
  marks: { type: DataTypes.INTEGER, defaultValue: 1 },
  options: { type: DataTypes.JSON, defaultValue: [] },
  explanation: { type: DataTypes.TEXT },
});

const MCQChapter = def('MCQChapter', 'mcqchapters', {
  school_id: ID(),
  assignment_id: ID(),
  subject_id: ID(),
  class_id: ID(),
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  time_limit: { type: DataTypes.INTEGER, defaultValue: 30 },
});

const Exam = def('Exam', 'exams', {
  school_id: ID(),
  created_by: ID(),
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  status: { type: DataTypes.STRING, defaultValue: 'draft' },
  question_ids: { type: DataTypes.JSON, defaultValue: [] },
  duration: { type: DataTypes.INTEGER, defaultValue: 60 },
  is_shuffle: { type: DataTypes.BOOLEAN, defaultValue: true },
  neg_mark: { type: DataTypes.BOOLEAN, defaultValue: false },
  scheduled_at: { type: DataTypes.DATE },
  expires_at: { type: DataTypes.DATE },
});

const School = def('School', 'schools', {
  name: { type: DataTypes.STRING, allowNull: false },
  name_slug: { type: DataTypes.STRING, unique: true },
  board_type: { type: DataTypes.STRING, defaultValue: 'Other' },
  subscription_plan: { type: DataTypes.STRING, defaultValue: 'Basic' },
  max_students_teachers: { type: DataTypes.INTEGER, defaultValue: 100 },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
});

const Subject = def('Subject', 'subjects', {
  school_id: ID(),
  name: { type: DataTypes.STRING, allowNull: false },
  code: { type: DataTypes.STRING },
  subject_type: { type: DataTypes.STRING, defaultValue: 'Theory' },
  applicable_classes: { type: DataTypes.JSON, defaultValue: [] },
});

const SchoolClass = def('SchoolClass', 'schoolclasses', {
  school_id: ID(),
  name: { type: DataTypes.STRING, allowNull: false },
  display_name: { type: DataTypes.STRING },
  order: { type: DataTypes.INTEGER, defaultValue: 0 },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
});

const Section = def('Section', 'sections', {
  school_id: ID(),
  class_id: ID(),
  name: { type: DataTypes.STRING, allowNull: false },
  order: { type: DataTypes.INTEGER, defaultValue: 0 },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
});

const TeacherAssignment = def('TeacherAssignment', 'teacherassignments', {
  school_id: ID(),
  teacher_id: ID(),
  class_id: ID(),
  section_id: ID(),
  subject_id: ID(),
  academic_year: { type: DataTypes.STRING },
  assignment_type: { type: DataTypes.STRING, defaultValue: 'Regular' },
  is_primary_teacher: { type: DataTypes.BOOLEAN, defaultValue: false },
});

const Timetable = def('Timetable', 'timetables', {
  day: { type: DataTypes.STRING, allowNull: false },
  time: { type: DataTypes.STRING, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  targetClass: { type: DataTypes.STRING, defaultValue: 'All' },
  targetDivision: { type: DataTypes.STRING, defaultValue: 'All' },
  teacherId: ID(),
}, { timestamps: true });

const Mark = def('Mark', 'marks', {
  studentId: ID(),
  courseId: ID(),
  teacherId: ID(),
  subject: { type: DataTypes.STRING },
  examType: { type: DataTypes.STRING },
  marksObtained: { type: DataTypes.FLOAT },
  totalMarks: { type: DataTypes.FLOAT },
  remarks: { type: DataTypes.STRING, defaultValue: '' },
}, {
  timestamps: true,
  indexes: [{ unique: true, fields: ['studentId', 'subject', 'examType'], name: 'mark_student_subject_type_unique' }],
});

const Attendance = def('Attendance', 'attendances', {
  sessionId: ID(),
  studentId: ID(),
  status: { type: DataTypes.STRING, defaultValue: 'present' },
  markedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, { timestamps: true });

const Announcement = def('Announcement', 'announcements', {
  title: { type: DataTypes.STRING, allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false },
  courseId: ID(),
  authorId: ID(),
}, { timestamps: true });

const AuditLog = def('AuditLog', 'auditlogs', {
  merkleRoot: { type: DataTypes.STRING },
  txHash: { type: DataTypes.STRING },
  blockNumber: { type: DataTypes.INTEGER },
  signature: { type: DataTypes.TEXT },
  recordCount: { type: DataTypes.INTEGER },
  status: { type: DataTypes.STRING, defaultValue: 'sealed' },
  verifiedAt: { type: DataTypes.DATE },
  // extra fields written by the tamper-revert path
  action: { type: DataTypes.STRING },
  target: { type: DataTypes.STRING },
  details: { type: DataTypes.TEXT },
  severity: { type: DataTypes.STRING },
}, { timestamps: true });

const CourseMaterial = def('CourseMaterial', 'coursematerials', {
  courseId: ID(),
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  type: { type: DataTypes.STRING },
  url: { type: DataTypes.TEXT },
  targetClass: { type: DataTypes.STRING },
  targetDivision: { type: DataTypes.STRING, defaultValue: 'All' },
  subject: { type: DataTypes.STRING },
  fileData: { type: DataTypes.BLOB('long') },
  contentType: { type: DataTypes.STRING },
  order: { type: DataTypes.INTEGER, defaultValue: 0 },
  createdBy: ID(),
}, { timestamps: true });

const ForumThread = def('ForumThread', 'forumthreads', {
  title: { type: DataTypes.STRING, allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false },
  courseId: ID(),
  authorId: ID(),
  isPinned: { type: DataTypes.BOOLEAN, defaultValue: false },
  tags: { type: DataTypes.JSON, defaultValue: [] },
}, { timestamps: true });

const ForumComment = def('ForumComment', 'forumcomments', {
  threadId: ID(),
  authorId: ID(),
  content: { type: DataTypes.TEXT, allowNull: false },
  parentCommentId: ID(),
}, { timestamps: true });

const ExamSecurityLog = def('ExamSecurityLog', 'examsecuritylogs', {
  exam_id: ID(),
  chapter_id: ID(),
  user_id: ID(),
  school_id: ID(),
  violation_type: { type: DataTypes.STRING },
  session_id: { type: DataTypes.STRING },
  ip_address: { type: DataTypes.STRING },
  user_agent: { type: DataTypes.TEXT },
  timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
});

/* ─── Associations (for .populate()) ─────────────────────────────────────
 * Sequelize forbids an association alias equal to its foreign key, so we use
 * a distinct alias ("<field>__pop") and record field→alias in _populateMap.
 * The shim's .populate(field) resolves the alias and remaps the result back
 * onto <field>, replacing the id string with the related object (Mongoose-style).
 */

const belongs = (Model, Target, field) => {
  const alias = `${field}__pop`;
  Model.belongsTo(Target, { as: alias, foreignKey: field, constraints: false });
  Model._populateMap = Model._populateMap || {};
  Model._populateMap[field] = alias;
};

belongs(User, Course, 'courseId');
belongs(Session, Course, 'courseId');
belongs(Result, Session, 'sessionId');
belongs(Result, User, 'studentId');
belongs(Result, Course, 'courseId');
belongs(Announcement, User, 'authorId');
belongs(Announcement, Course, 'courseId');
belongs(Mark, Course, 'courseId');
belongs(Mark, User, 'teacherId');
belongs(Mark, User, 'studentId');
belongs(Attendance, User, 'studentId');
belongs(Attendance, Session, 'sessionId');
belongs(ForumThread, User, 'authorId');

module.exports = {
  sequelize,
  User, Course, Session, Result, ResultSnapshot, MCQBank, MCQQuestion, MCQChapter,
  Exam, School, Subject, SchoolClass, Section, TeacherAssignment, Timetable,
  Mark, Attendance, Announcement, AuditLog, CourseMaterial, ForumThread,
  ForumComment, ExamSecurityLog,
};
