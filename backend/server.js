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
const dbReady = connectDB();

// Security Middleware
// Security Middleware (Relaxed CSP for Inline Handlers)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdn.socket.io", "https://cdnjs.cloudflare.com"],
      "script-src-attr": ["'unsafe-inline'"],
      "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      "img-src": ["'self'", "data:", "blob:", "*"],
      "connect-src": ["'self'", "https://*", "http://*", "ws://*", "wss://*"],
    },
  },
}));
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
// Frontend directory: defaults to ../frontend/public, override with FRONTEND_DIR env var
const FRONTEND_DIR = process.env.FRONTEND_DIR || path.join(__dirname, '..', 'frontend', 'public');
app.use(express.static(FRONTEND_DIR, { index: false }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api', portalRoutes);

// JSON 404 for API
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: `API Route ${req.originalUrl} not found` });
});

// SPA Fallbacks
app.get('/', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'landing.html')));
app.get('/login', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'login.html')));
app.get('/teacher-login', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'teacher-login.html')));
app.get('/student', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'index.html')));
app.get('/teacher', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'teacher.html')));
app.get('/exam', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'exam.html')));

// Start background integrity services only AFTER the database is connected and
// tables are synced (Sequelize, unlike Mongoose, does not buffer queries).
dbReady.then(() => {
  // Blockchain Audit Pulse (Super-Strength Integrity)
  initAuditPulse(5 * 60 * 1000); // 5 minute pulse
  // Self-Healing Guardian: periodically reverts any tampered result rows
  setTimeout(initChangeStreamGuardian, 3000);
}).catch(() => { /* connectDB already logs + exits on failure */ });

const PORT = process.env.PORT || 5000;
const httpServer = http.createServer(app);
initSocket(httpServer);
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});