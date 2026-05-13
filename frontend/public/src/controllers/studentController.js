const mongoose = require('mongoose');
const Session = require('../models/Session');
const Result = require('../models/Result');
const ResultSnapshot = require('../models/ResultSnapshot');
const Announcement = require('../models/Announcement');
const logger = require('../utils/logger');
const Course = require('../models/Course');
const blockchain = require('../services/blockchain/blockchainService');
const hashService = require('../services/blockchain/hashService');
const Attendance = require('../models/Attendance');
const Mark = require('../models/Mark');

const scoreToGpa = (avgPercent) => {
  if (avgPercent == null || Number.isNaN(avgPercent)) return 0;
  const g = Math.round((Number(avgPercent) / 100) * 4 * 10) / 10;
  return Math.min(4, Math.max(0, g));
};

exports.getDashboard = async (req, res) => {
  try {
    const student = req.user;
    if (!student.courseId) {
      return res.json({
        success: true,
        data: {
          profile: {
            name: student.name,
            section: 'No course',
            gpa: 0,
            attendance: 0,
            sessionsLogged: 0,
            totalSessions: 0,
            rank: 0,
            totalPeers: 0,
            tasks: 0
          },
          subjectPerformance: [],
          tasks: [],
          recentResults: [],
          upcomingExams: []
        }
      });
    }

    const courseId = student.courseId;
    const studentId = student._id;

    const [
      upcomingExams,
      recentResults,
      avgScoreRow,
      subjectPerformance,
      attendanceCount,
      totalSessions,
      peerAvgs
    ] = await Promise.all([
      Session.find({
        courseId,
        division: student.division,
        startTime: { $gte: new Date(Date.now() - 3600000) }
      })
        .sort({ startTime: 1 })
        .limit(5)
        .lean(),
      Result.find({ studentId })
        .populate('sessionId', 'title')
        .sort({ createdAt: -1 })
        .limit(3)
        .lean(),
      Result.aggregate([
        { $match: { studentId } },
        { $group: { _id: null, avg: { $avg: '$score' } } }
      ]),
      Result.aggregate([
        { $match: { studentId: new mongoose.Types.ObjectId(String(studentId)) } },
        {
          $lookup: {
            from: 'sessions',
            localField: 'sessionId',
            foreignField: '_id',
            as: 'sess'
          }
        },
        { $unwind: { path: '$sess', preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            subj: {
              $cond: {
                if: { $and: [{ $ne: ['$sess.subject', ''] }, { $ne: ['$sess.subject', null] }] },
                then: '$sess.subject',
                else: 'General'
              }
            }
          }
        },
        { $group: { _id: '$subj', avgScore: { $avg: '$score' } } },
        { $project: { _id: 0, subject: '$_id', score: { $round: ['$avgScore', 0] } } },
        { $sort: { subject: 1 } }
      ]),
      Attendance.countDocuments({ studentId, status: 'present' }),
      Session.countDocuments({ courseId, division: student.division }),
      Result.aggregate([
        { $match: { courseId: new mongoose.Types.ObjectId(String(courseId)) } },
        { $group: { _id: '$studentId', avgScore: { $avg: '$score' } } },
        { $sort: { avgScore: -1 } }
      ])
    ]);

    const avgScore = avgScoreRow[0] && avgScoreRow[0].avg != null ? avgScoreRow[0].avg : 0;
    const gpa = scoreToGpa(avgScore);

    const totalPeers = peerAvgs.length;
    const rankIdx = peerAvgs.findIndex((a) => String(a._id) === String(studentId));
    const rank = rankIdx >= 0 ? rankIdx + 1 : 0;

    const mappedResults = recentResults.map((r) => ({
      _id: r._id,
      session: { title: r.sessionId ? r.sessionId.title : 'Exam' },
      percentage: r.score,
      submittedAt: r.createdAt
    }));

    res.json({
      success: true,
      data: {
        profile: {
          name: student.name,
          section: `Course ${String(courseId).slice(-6)} — Div ${student.division || 'N/A'}`,
          gpa,
          attendance: attendanceCount,
          sessionsLogged: attendanceCount, // Using attendance as proxy for sessions logged for now
          totalSessions,
          rank,
          totalPeers: totalPeers || 0,
          tasks: 0
        },
        subjectPerformance,
        tasks: [],
        recentResults: mappedResults,
        upcomingExams: upcomingExams.map((e) => ({
          _id: e._id,
          title: e.title,
          durationMinutes: e.duration,
          scheduledStart: e.startTime
        }))
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getCourses = async (req, res) => {
  try {
    const courses = await Course.find({}).lean();
    res.json({ success: true, data: courses });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAvailableExams = async (req, res) => {
  try {
    const query = {};
    if (req.user.courseId) {
      query.courseId = req.user.courseId;
    }
    const exams = await Session.find(query).select('-questions.correctAnswer');
    res.json({ success: true, data: exams });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getExamQuestions = async (req, res) => {
  try {
    const query = {
      _id: req.params.sessionId
    };
    if (req.user.courseId) {
      query.courseId = req.user.courseId;
    }
    const exam = await Session.findOne(query).select('-questions.correctAnswer');

    if (!exam) return res.status(404).json({ success: false, message: 'Exam not found or access denied' });
    res.json({ success: true, data: exam });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.submitExam = async (req, res) => {
  try {
    const { sessionId, answers, violations, violationHistory } = req.body;
    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ message: 'Exam not found' });

    if (!req.user.courseId || String(session.courseId) !== String(req.user.courseId)) {
      return res.status(403).json({ success: false, message: 'Not allowed' });
    }

    let correct = 0;
    const totalQuestions = session.questions.length;

    // Build per-question answer breakdown
    const answerBreakdown = session.questions.map((q) => {
      const userAns = answers.find(a => String(a.questionId) === String(q._id));
      const selectedOption = userAns ? userAns.selectedOption : null;
      const isCorrect = selectedOption === q.correctAnswer;
      if (isCorrect) correct++;

      return {
        questionText: q.questionText || q.text || '',
        image: q.image || null,
        options: (q.options || []).map(opt => ({ label: opt.label, text: opt.text })),
        selectedAnswer: selectedOption,
        correctAnswer: q.correctAnswer,
        isCorrect: !!selectedOption && isCorrect
      };
    });

    const percentage = totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0;
    const isPassed = percentage >= 50;

    const resultData = {
      studentId: req.user._id,
      courseId: session.courseId,
      sessionId: session._id,
      score: percentage,
      answers: answerBreakdown,
      timeTaken: Math.floor(parseInt(req.body.timeTaken, 10) || 0),
      marksObtained: correct,
      totalMarks: totalQuestions,
      percentage: percentage,
      grade: percentage >= 90 ? 'A+' : percentage >= 80 ? 'A' : percentage >= 70 ? 'B' : percentage >= 60 ? 'C' : percentage >= 50 ? 'D' : 'F',
      submittedAt: new Date(),
      correctCount: correct,
      totalQuestions: totalQuestions,
      violationCount: parseInt(violations, 10) || 0,
      violationHistory: violationHistory || []
    };

    // Calculate SHA256 Result Hash
    const resHash = hashService.computeResultHash(resultData);

    const result = await Result.create({
      ...resultData,
      blockchainHash: resHash
    });

    // Anchor to Blockchain (Local Node)
    try {
      const sealRes = await blockchain.storeResultHash(resHash, result._id.toString());
      result.blockchainTx = sealRes.txHash;
      await result.save();
    } catch (bcErr) {
      console.warn('Blockchain anchoring failed, result saved off-chain:', bcErr.message);
    }

    // 🔒 Create immutable snapshot for self-healing protection
    try {
      await ResultSnapshot.create({
        resultId: result._id,
        studentId: result.studentId,
        courseId: result.courseId,
        sessionId: result.sessionId,
        score: result.score,
        timeTaken: result.timeTaken,
        violationCount: result.violationCount,
        answers: result.answers,
        blockchainHash: resHash,
      });
    } catch (snapErr) {
      // Snapshot creation failed (e.g., duplicate key on retry) — non-blocking
      logger.warn(`Snapshot creation skipped: ${snapErr.message}`);
    }

    res.status(201).json({
      success: true,
      data: {
        resultId: result._id,
        percentage,
        correctCount: correct,
        totalQuestions,
        isPassed,
        blockchainTx: result.blockchainTx
      }
    });
  } catch (err) {
    console.error('Submission error:', err);
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.getMyResults = async (req, res) => {
  try {
    const results = await Result.find({ studentId: req.user._id }).populate('sessionId', 'title');
    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAnnouncements = async (req, res) => {
  try {
    const courseId = req.user?.courseId;

    if (!courseId) {
      logger.info(`Student ${req.user?._id} accessed announcements but has no courseId assigned.`);
      return res.json({ success: true, data: [] });
    }

    const announcements = await Announcement.find({ courseId })
      .sort({ createdAt: -1 })
      .populate('authorId', 'name')
      .lean();

    logger.info(`Fetched ${announcements.length} announcements for course ${courseId}`);
    res.json({ success: true, data: announcements });
  } catch (err) {
    logger.error(`Error in getAnnouncements: ${err.message}`);
    res.status(500).json({ success: false, message: 'Server error loading announcements' });
  }
};

exports.getResultDetail = async (req, res) => {
  try {
    const result = await Result.findOne({
      _id: req.params.resultId,
      studentId: req.user._id
    }).populate('sessionId', 'title questions');

    if (!result) return res.status(404).json({ success: false, message: 'Result not found' });

    let answers = result.answers || [];
    const score = result.score || 0;

    // Fallback: reconstruct answers from Session questions for old results
    if (answers.length === 0 && result.sessionId && result.sessionId.questions) {
      answers = result.sessionId.questions.map(q => ({
        questionText: q.questionText || q.text || '',
        image: q.image || null,
        options: (q.options || []).map(opt => ({ label: opt.label, text: opt.text })),
        selectedAnswer: null,  // Unknown for old results
        correctAnswer: q.correctAnswer,
        isCorrect: false
      }));
    }

    const correctCount = result.answers && result.answers.length > 0
      ? answers.filter(a => a.isCorrect).length
      : Math.round((score / 100) * answers.length);

    res.json({
      success: true,
      data: {
        session: { title: result.sessionId ? result.sessionId.title : 'Exam' },
        percentage: score,
        correctCount,
        totalQuestions: answers.length,
        isPassed: score >= 50,
        grade: score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B' : score >= 60 ? 'C' : score >= 50 ? 'D' : 'F',
        timeTaken: result.timeTaken || 0,
        answers,
        resultHash: result.blockchainHash || null,
        blockchainTx: result.blockchainTx || null
      }
    });
  } catch (err) {
    console.error('ResultDetail error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
exports.getMyMarks = async (req, res) => {
  try {
    const marks = await Mark.find({ studentId: req.user._id })
      .populate('courseId', 'name')
      .populate('teacherId', 'name')
      .sort({ subject: 1, examType: 1 });
    res.json({ success: true, data: marks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};exports.getSchedule = async (req, res) => {
  try {
    const Timetable = require('../models/Timetable');
    const { classTag, division } = req.user;

    // Students can see entries meant for their specific grade/division OR 'All'
    const entries = await Timetable.find({
      $and: [
        { targetClass: { $in: [classTag, 'All'] } },
        { targetDivision: { $in: [division, 'All'] } }
      ]
    }).sort({ day: 1, time: 1 }).lean();

    res.json({ success: true, data: entries });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
