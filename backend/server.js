require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./src/config/database');
const authRoutes = require('./src/routes/authRoutes');
const portalRoutes = require('./src/routes/portalRoutes');
const initSocket = require('./src/config/socket');
const { initAuditPulse } = require('./src/services/blockchain/auditPulse');
const { initChangeStreamGuardian } = require('./src/services/blockchain/changeStreamGuardian');

const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const rateLimit = require('express-rate-limit');

const app = express();
connectDB();

// Security Middleware
app.use(helmet()); // Set security HTTP headers
app.use(mongoSanitize()); // Data sanitization against NoSQL query injection
app.use(xss()); // Data sanitization against XSS

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000 // Increased limit to prevent blocking during testing
});
app.use('/api', limiter);

app.use(cors());
app.use(express.json());

// Static Files
app.use(express.static(path.join(__dirname, '..', 'frontend', 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api', portalRoutes);

// JSON 404 for API
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: `API Route ${req.originalUrl} not found` });
});

// SPA Fallbacks
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'public', 'landing.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'public', 'login.html')));
app.get('/student', (req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'public', 'index.html')));
app.get('/teacher', (req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'public', 'teacher.html')));
app.get('/exam', (req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'public', 'exam.html')));

// Initialize Blockchain Audit Pulse (Super-Strength Integrity)
initAuditPulse(5 * 60 * 1000); // 5 minute pulse

// Initialize Change Stream Guardian (Self-Healing Immutable Results)
// Note: Requires MongoDB with replica set (rs) mode for Change Streams
setTimeout(initChangeStreamGuardian, 3000); // Start after DB is ready

const PORT = process.env.PORT || 5000;
const httpServer = http.createServer(app);
initSocket(httpServer);
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});