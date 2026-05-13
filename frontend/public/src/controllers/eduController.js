const CourseMaterial = require('../models/CourseMaterial');
const Announcement = require('../models/Announcement');
const Attendance = require('../models/Attendance');
const ForumThread = require('../models/ForumThread');
const ForumComment = require('../models/ForumComment');
const Session = require('../models/Session');
const blockchain = require('../services/blockchain/blockchainService');
const hashService = require('../services/blockchain/hashService');

// ─── Course Materials ───────────────────────────────────────────────

exports.getMaterials = async (req, res) => {
    try {
        const { courseId } = req.params;
        const user = req.user;

        const query = {};
        if (courseId && courseId !== 'all') {
            query.courseId = courseId;
        }

        // STRICT ACCESS CONTROL for students
        if (user.role === 'student') {
            query.targetClass = { $in: [user.classTag, 'All'] };
            query.targetDivision = { $in: [user.division, 'All'] };
        }

        const materials = await CourseMaterial.find(query).sort('order');
        res.json({ success: true, data: materials });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.uploadMaterial = async (req, res) => {
    try {
        const { courseId, title, description, type, url: providedUrl, targetClass, targetDivision, subject } = req.body;
        
        // Validate teacher ownership
        if (!req.user.courseIds.map(id => id.toString()).includes(courseId)) {
            return res.status(403).json({ success: false, message: 'Unauthorized course access' });
        }

        let finalUrl = providedUrl;
        let fileData = null;
        let contentType = null;

        // Handle File Upload if present
        if (req.file) {
            const fs = require('fs').promises;
            const path = require('path');
            
            // Read binary data for MongoDB storage
            fileData = await fs.readFile(req.file.path);
            contentType = req.file.mimetype;
            
            // We still store a URL as a pointer for the frontend
            finalUrl = `/portal/edu/materials/download/temp`; 
            
            // Clean up the temporary file from the server disk
            await fs.unlink(req.file.path);
        }

        const material = await CourseMaterial.create({
            courseId, title, description, type, url: finalUrl, targetClass, targetDivision, subject,
            fileData, contentType,
            createdBy: req.user._id
        });

        // Update the URL to the permanent download link
        if (fileData) {
            material.url = `/api/portal/edu/materials/download/${material._id}`;
            await material.save();
        }

        res.status(201).json({ success: true, data: material });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.downloadMaterial = async (req, res) => {
    try {
        const material = await CourseMaterial.findById(req.params.id);
        if (!material || !material.fileData) {
            return res.status(404).send('File not found');
        }
        
        res.set('Content-Type', material.contentType);
        // Force download if it's not a viewable type, otherwise let browser decide
        res.set('Content-Disposition', `inline; filename="${material.title}"`);
        res.send(material.fileData);
    } catch (err) {
        res.status(500).send('Error retrieving file');
    }
};

exports.deleteMaterial = async (req, res) => {
    try {
        await CourseMaterial.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Material deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── Announcements ──────────────────────────────────────────────────

exports.getAnnouncements = async (req, res) => {
    try {
        const { courseId } = req.params;
        const announcements = await Announcement.find({ courseId }).sort('-createdAt').populate('authorId', 'name');
        res.json({ success: true, data: announcements });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.createAnnouncement = async (req, res) => {
    try {
        const { courseId, title, content } = req.body;
        const announcement = await Announcement.create({
            courseId, title, content,
            authorId: req.user._id
        });
        res.status(201).json({ success: true, data: announcement });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// ─── Attendance ─────────────────────────────────────────────────────

exports.getAttendance = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const attendance = await Attendance.find({ sessionId }).populate('studentId', 'name email');
        res.json({ success: true, data: attendance });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.markAttendance = async (req, res) => {
    try {
        const { sessionId, studentId, status } = req.body;
        const mongoose = require('mongoose');

        const att = await Attendance.findOneAndUpdate(
            {
                sessionId: new mongoose.Types.ObjectId(sessionId),
                studentId: new mongoose.Types.ObjectId(studentId)
            },
            { status, markedAt: Date.now() },
            { upsert: true, new: true }
        );
        res.json({ success: true, data: att });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.deleteAttendance = async (req, res) => {
    try {
        const { id } = req.params;
        await Attendance.findByIdAndDelete(id);
        res.json({ success: true, message: 'Attendance record deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── Forums ─────────────────────────────────────────────────────────

exports.getThreads = async (req, res) => {
    try {
        const { courseId } = req.params;
        const query = courseId ? { courseId } : {};
        const threads = await ForumThread.find(query).sort('-createdAt').populate('authorId', 'name');
        res.json({ success: true, data: threads });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.createThread = async (req, res) => {
    try {
        const { title, content, courseId } = req.body;
        const thread = await ForumThread.create({
            title, content, courseId,
            authorId: req.user._id
        });
        res.status(201).json({ success: true, data: thread });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// ─── Certificates ───────────────────────────────────────────────────

exports.generateCertificate = async (req, res) => {
    try {
        const { courseId } = req.params;
        const student = req.user;

        const Result = require('../models/Result');
        const Course = require('../models/Course');

        const [course, results] = await Promise.all([
            Course.findById(courseId),
            Result.find({ studentId: student._id, courseId })
        ]);

        if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

        const avgScore = results.length > 0
            ? results.reduce((acc, r) => acc + r.score, 0) / results.length
            : 0;

        const certificateId = `CERT-${courseId.toString().slice(-6)}-${student._id.toString().slice(-6)}`.toUpperCase();

        // Blockchain Anchoring
        const certData = { studentName: student.name, courseName: course.courseName, certificateId, date: new Date() };
        const certHash = hashService.computeHMAC(JSON.stringify(certData));

        let txHash = null;
        try {
            const seal = await blockchain.storeResultHash(certHash, certificateId);
            txHash = seal.txHash;
        } catch (bErr) {
            console.warn('Cert blockchain anchoring failed:', bErr.message);
        }

        res.json({
            success: true,
            data: {
                studentName: student.name,
                courseName: course.courseName,
                issueDate: new Date(),
                grade: avgScore >= 90 ? 'A+' : avgScore >= 80 ? 'A' : avgScore >= 70 ? 'B' : 'C',
                certificateId,
                blockchainTx: txHash,
                blockchainHash: certHash
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
