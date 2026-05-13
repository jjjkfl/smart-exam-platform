const router = require('express').Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { rbac } = require('../middleware/rbacMiddleware');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

// Late-binding controller loader to avoid circular dependencies
const studentCtrl = () => require('../controllers/studentController');
const teacherCtrl = () => require('../controllers/teacherController');
const adminCtrl = () => require('../controllers/adminController');
const eduCtrl = () => require('../controllers/eduController');

router.use(authMiddleware);

// Materials
router.get('/portal/edu/courses/all/materials', rbac(['teacher']), (req, res) => eduCtrl().getMaterials(req, res));
router.get('/portal/edu/courses/:courseId/materials', (req, res) => eduCtrl().getMaterials(req, res));
router.post('/portal/edu/materials', rbac(['teacher']), upload.single('file'), (req, res) => eduCtrl().uploadMaterial(req, res));
router.get('/portal/edu/materials/download/:id', (req, res) => eduCtrl().downloadMaterial(req, res));
router.delete('/portal/edu/materials/:id', rbac(['teacher']), (req, res) => eduCtrl().deleteMaterial(req, res));

// Announcements
router.get('/portal/edu/courses/:courseId/announcements', (req, res) => eduCtrl().getAnnouncements(req, res));
router.post('/portal/edu/announcements', rbac(['teacher']), (req, res) => eduCtrl().createAnnouncement(req, res));

// Attendance
router.get('/portal/edu/attendance/:sessionId', rbac(['teacher']), (req, res) => eduCtrl().getAttendance(req, res));
router.post('/portal/edu/attendance', rbac(['teacher']), (req, res) => eduCtrl().markAttendance(req, res));
router.delete('/portal/edu/attendance/:id', rbac(['teacher']), (req, res) => eduCtrl().deleteAttendance(req, res));

// Forum
router.get('/portal/edu/forum/threads', (req, res) => eduCtrl().getThreads(req, res));
router.get('/portal/edu/forum/courses/:courseId/threads', (req, res) => eduCtrl().getThreads(req, res));
router.post('/portal/edu/forum/threads', (req, res) => eduCtrl().createThread(req, res));
router.get('/portal/edu/forum/threads/:threadId/comments', (req, res) => eduCtrl().getComments(req, res));
router.post('/portal/edu/forum/comments', (req, res) => eduCtrl().createComment(req, res));

// Certificates
router.get('/portal/edu/certificates/:courseId', (req, res) => eduCtrl().generateCertificate(req, res));
router.get('/portal/edu/courses/:courseId/certificate', (req, res) => eduCtrl().generateCertificate(req, res));

// Teacher Dashboard Extras
router.get('/portal/teacher/dashboard', rbac(['teacher']), (req, res) => teacherCtrl().getDashboard(req, res));
router.get('/portal/teacher/sessions', rbac(['teacher']), (req, res) => teacherCtrl().getSessions(req, res));
router.post('/portal/teacher/sessions', rbac(['teacher']), (req, res) => teacherCtrl().createSession(req, res));
router.put('/portal/teacher/sessions/:id', rbac(['teacher']), (req, res) => teacherCtrl().updateSession(req, res));
router.delete('/portal/teacher/sessions/:id', rbac(['teacher']), (req, res) => teacherCtrl().deleteSession(req, res));
router.patch('/portal/teacher/sessions/:sessionId/status', rbac(['teacher']), (req, res) => teacherCtrl().updateSessionStatus(req, res));
router.patch('/portal/teacher/courses/:courseId/drive', rbac(['teacher']), (req, res) => teacherCtrl().updateCourseDrive(req, res));
router.get('/portal/teacher/results/general-analytics', rbac(['teacher']), (req, res) => teacherCtrl().getGeneralAnalytics(req, res));
router.get('/portal/teacher/sessions/:sessionId/results', rbac(['teacher']), (req, res) => teacherCtrl().getSessionResults(req, res));
router.get('/portal/teacher/mcq-banks', rbac(['teacher']), (req, res) => teacherCtrl().getMCQBanks(req, res));
router.post('/portal/teacher/mcq-banks/upload', rbac(['teacher']), upload.single('pdf'), (req, res) => teacherCtrl().uploadMCQ(req, res));
router.put('/portal/teacher/mcq-banks/:id', rbac(['teacher']), (req, res) => teacherCtrl().updateMCQBank(req, res));
router.delete('/portal/teacher/mcq-banks/:id', rbac(['teacher']), (req, res) => teacherCtrl().deleteMCQBank(req, res));

// Marks Management (Teacher)
router.get('/portal/teacher/marks', rbac(['teacher']), (req, res) => teacherCtrl().getMarks(req, res));
router.post('/portal/teacher/marks', rbac(['teacher']), (req, res) => teacherCtrl().addMark(req, res));
router.post('/portal/teacher/marks/bulk', rbac(['teacher']), (req, res) => teacherCtrl().addBulkMarks(req, res));
router.delete('/portal/teacher/marks/:id', rbac(['teacher']), (req, res) => teacherCtrl().deleteMark(req, res));

// Student Management (Teacher)
router.get('/portal/teacher/students', rbac(['teacher']), (req, res) => teacherCtrl().getStudents(req, res));
router.post('/portal/teacher/students', rbac(['teacher']), (req, res) => teacherCtrl().createStudent(req, res));
router.put('/portal/teacher/students/:id', rbac(['teacher']), (req, res) => teacherCtrl().updateStudent(req, res));
router.delete('/portal/teacher/students/:id', rbac(['teacher']), (req, res) => teacherCtrl().deleteStudent(req, res));

// Timetable Management (Teacher)
router.get('/portal/teacher/timetable', rbac(['teacher']), (req, res) => teacherCtrl().getTimetable(req, res));
router.post('/portal/teacher/timetable', rbac(['teacher']), (req, res) => teacherCtrl().createTimetableEntry(req, res));
router.delete('/portal/teacher/timetable/:id', rbac(['teacher']), (req, res) => teacherCtrl().deleteTimetableEntry(req, res));

// Admin Dashboard Extras
router.get('/portal/admin/dashboard', rbac(['admin']), (req, res) => adminCtrl().getDashboard(req, res));
router.get('/portal/admin/users', rbac(['admin']), (req, res) => adminCtrl().getUsers(req, res));
router.post('/portal/admin/users', rbac(['admin']), (req, res) => adminCtrl().createUser(req, res));
router.put('/portal/admin/users/:id', rbac(['admin']), (req, res) => adminCtrl().updateUser(req, res));
router.delete('/portal/admin/users/:id', rbac(['admin']), (req, res) => adminCtrl().deleteUser(req, res));
router.get('/portal/admin/courses', rbac(['admin']), (req, res) => adminCtrl().getCourses(req, res));
router.post('/portal/admin/courses', rbac(['admin']), (req, res) => adminCtrl().createCourse(req, res));
router.put('/portal/admin/courses/:id', rbac(['admin']), (req, res) => adminCtrl().updateCourse(req, res));
router.delete('/portal/admin/courses/:id', rbac(['admin']), (req, res) => adminCtrl().deleteCourse(req, res));

// Student Dashboard Extras
router.get('/portal/student/dashboard', rbac(['student']), (req, res) => studentCtrl().getDashboard(req, res));
router.get('/portal/student/courses', rbac(['student']), (req, res) => studentCtrl().getCourses(req, res));
router.get('/portal/student/exams', rbac(['student']), (req, res) => studentCtrl().getAvailableExams(req, res));
router.get('/portal/student/exams/:sessionId', rbac(['student']), (req, res) => studentCtrl().getExamQuestions(req, res));
router.post('/portal/student/exams/submit', rbac(['student']), (req, res) => studentCtrl().submitExam(req, res));
router.get('/portal/student/marks', rbac(['student']), (req, res) => studentCtrl().getMyMarks(req, res));
router.get('/portal/student/results', rbac(['student']), (req, res) => studentCtrl().getMyResults(req, res));
router.get('/portal/student/announcements', rbac(['student']), (req, res) => studentCtrl().getAnnouncements(req, res));
router.get('/portal/student/results/:resultId', rbac(['student']), (req, res) => studentCtrl().getResultDetail(req, res));
router.get('/portal/student/schedule', rbac(['student']), (req, res) => studentCtrl().getSchedule(req, res));

// ─── Blockchain Integrity Endpoints ───────────────────────────────────────────
const AuditLog = require('../models/AuditLog');
const { getTamperAlert } = require('../services/blockchain/auditPulse');

// Real-time tamper alert status
router.get('/portal/security/tamper-status', rbac(['teacher', 'admin']), async (req, res) => {
    const alert = getTamperAlert();
    const recentTampers = await AuditLog.find({ status: 'tamper_detected' }).sort({ createdAt: -1 }).limit(5);
    res.json({
        tamperDetected: !!alert || recentTampers.length > 0,
        latestAlert: alert,
        recentTampers,
    });
});

// Full audit log history
router.get('/portal/security/audit-logs', rbac(['teacher', 'admin']), async (req, res) => {
    const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(20);
    res.json({ logs });
});

module.exports = router;
