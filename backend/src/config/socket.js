/**
 * src/config/socket.js
 * Socket.io initialization and real-time exam event handling with Redis scaling support
 */

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { createClient } = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');
const logger = require('../utils/logger');
const Session = require('../models/Session');

async function persistSessionStatus(sessionId, status) {
  if (!sessionId || !mongoose.Types.ObjectId.isValid(String(sessionId))) return;
  try {
    await Session.findByIdAndUpdate(sessionId, { status });
  } catch (e) {
    logger.warn(`Session status persist failed: ${sessionId} → ${status}: ${e.message}`);
  }
}

/* ─── Redis Clients Initialization ───────────────────────────────── */
let pubClient;
let subClient;
let useRedis = false;

if (process.env.REDIS_URL) {
  pubClient = createClient({ url: process.env.REDIS_URL });
  subClient = pubClient.duplicate();

  pubClient.on('error', (err) => logger.error(`Redis Pub Client Error: ${err.message}`));
  subClient.on('error', (err) => logger.error(`Redis Sub Client Error: ${err.message}`));

  pubClient.connect()
    .then(() => logger.info('✅ Redis Pub Client Connected'))
    .catch(e => logger.error('Redis Pub Connect Failed:', e));
    
  subClient.connect()
    .then(() => logger.info('✅ Redis Sub Client Connected'))
    .catch(e => logger.error('Redis Sub Connect Failed:', e));

  useRedis = true;
}

/* In-memory room state (fallback if Redis is not configured) */
const memoryRooms = new Map();
const memoryUserSockets = new Map();

/* ─── Unified State Store (Redis or In-Memory fallback) ────────── */
const store = {
  // User socket tracking
  async setUserSocket(userId, socketId) {
    if (useRedis) {
      await pubClient.set(`exam:user_socket:${userId}`, socketId, { EX: 86400 }); // 1 day TTL
    } else {
      memoryUserSockets.set(userId, socketId);
    }
  },

  async deleteUserSocket(userId) {
    if (useRedis) {
      await pubClient.del(`exam:user_socket:${userId}`);
    } else {
      memoryUserSockets.delete(userId);
    }
  },

  async getUserSocket(userId) {
    if (useRedis) {
      return await pubClient.get(`exam:user_socket:${userId}`);
    } else {
      return memoryUserSockets.get(userId);
    }
  },

  // Room tracking
  async getRoom(sessionId) {
    if (useRedis) {
      const roomData = await pubClient.hGetAll(`exam:room:${sessionId}`);
      if (!roomData || Object.keys(roomData).length === 0) return null;
      return {
        started: roomData.started === 'true',
        endTime: roomData.endTime ? parseInt(roomData.endTime, 10) : null,
        paused: roomData.paused === 'true'
      };
    } else {
      return memoryRooms.get(sessionId);
    }
  },

  async initRoom(sessionId) {
    if (useRedis) {
      const exists = await pubClient.exists(`exam:room:${sessionId}`);
      if (!exists) {
        await pubClient.hSet(`exam:room:${sessionId}`, {
          started: 'false',
          endTime: '',
          paused: 'false'
        });
        await pubClient.expire(`exam:room:${sessionId}`, 86400); // 1 day TTL
      }
    } else {
      if (!memoryRooms.has(sessionId)) {
        memoryRooms.set(sessionId, {
          students: new Map(),
          started: false,
          endTime: null,
          paused: false,
        });
      }
    }
  },

  async startRoom(sessionId, durationMinutes) {
    const endTime = Date.now() + durationMinutes * 60 * 1000;
    if (useRedis) {
      await pubClient.hSet(`exam:room:${sessionId}`, {
        started: 'true',
        endTime: String(endTime),
        paused: 'false'
      });
    } else {
      const room = memoryRooms.get(sessionId);
      if (room) {
        room.started = true;
        room.endTime = endTime;
        room.paused = false;
      }
    }
    return endTime;
  },

  async pauseRoom(sessionId, paused) {
    if (useRedis) {
      await pubClient.hSet(`exam:room:${sessionId}`, 'paused', String(paused));
    } else {
      const room = memoryRooms.get(sessionId);
      if (room) room.paused = paused;
    }
  },

  async deleteRoom(sessionId) {
    if (useRedis) {
      await pubClient.del(`exam:room:${sessionId}`);
      await pubClient.del(`exam:room:${sessionId}:students`);
    } else {
      memoryRooms.delete(sessionId);
    }
  },

  // Student tracking
  async setStudent(sessionId, userId, studentInfo) {
    // Convert answeredIndices Set to Array for JSON serialization
    const infoToStore = {
      ...studentInfo,
      answeredIndices: studentInfo.answeredIndices instanceof Set 
        ? Array.from(studentInfo.answeredIndices) 
        : (studentInfo.answeredIndices || [])
    };
    if (useRedis) {
      await pubClient.hSet(`exam:room:${sessionId}:students`, userId, JSON.stringify(infoToStore));
      await pubClient.expire(`exam:room:${sessionId}:students`, 86400);
    } else {
      const room = memoryRooms.get(sessionId);
      if (room) {
        // Restore answeredIndices as Set for local Map compatibility
        infoToStore.answeredIndices = new Set(infoToStore.answeredIndices);
        room.students.set(userId, infoToStore);
      }
    }
  },

  async getStudent(sessionId, userId) {
    if (useRedis) {
      const data = await pubClient.hGet(`exam:room:${sessionId}:students`, userId);
      if (!data) return null;
      const parsed = JSON.parse(data);
      parsed.answeredIndices = new Set(parsed.answeredIndices || []);
      return parsed;
    } else {
      const room = memoryRooms.get(sessionId);
      if (!room) return null;
      return room.students.get(userId);
    }
  },

  async getStudentCount(sessionId) {
    if (useRedis) {
      return await pubClient.hLen(`exam:room:${sessionId}:students`);
    } else {
      const room = memoryRooms.get(sessionId);
      return room ? room.students.size : 0;
    }
  },

  async getAllStudents(sessionId) {
    if (useRedis) {
      const allData = await pubClient.hGetAll(`exam:room:${sessionId}:students`);
      if (!allData) return [];
      return Object.entries(allData).map(([uid, jsonStr]) => {
        const parsed = JSON.parse(jsonStr);
        return {
          userId: uid,
          ...parsed,
          answeredIndices: parsed.answeredIndices || [] // Array format preferred for exports
        };
      });
    } else {
      const room = memoryRooms.get(sessionId);
      if (!room) return [];
      return Array.from(room.students.entries()).map(([uid, info]) => ({
        userId: uid,
        ...info,
        answeredIndices: Array.from(info.answeredIndices || [])
      }));
    }
  }
};

let ioInstance = null;
const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',')
        : '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Attach Redis Pub/Sub adapter to Socket.io cluster if present
  if (useRedis) {
    io.adapter(createAdapter(pubClient, subClient));
    logger.info('✅ Socket.io Redis Adapter initialized');
  }

  /* ─── Auth Middleware ─────────────────────────────────────────── */
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token
      || socket.handshake.headers?.authorization?.split(' ')[1];

    if (!token) return next(new Error('Authentication error: No token'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  /* ─── Connection Handler ──────────────────────────────────────── */
  io.on('connection', (socket) => {
    const { id: userId, role } = socket.user;
    store.setUserSocket(userId, socket.id).catch(e => logger.error('setUserSocket error:', e));
    logger.info(`Socket connected: ${socket.id} | user=${userId} | role=${role}`);

    /* ── JOIN EXAM ROOM ──────────────────────────────────────────── */
    socket.on('exam:join', async ({ sessionId }) => {
      if (!sessionId) return;
      socket.join(sessionId);

      await store.initRoom(sessionId);

      if (role === 'student') {
        const studentInfo = {
          socketId: socket.id,
          joinedAt: Date.now(),
          answeredIndices: new Set(),
          tabSwitches: 0,
          online: true,
        };
        await store.setStudent(sessionId, userId, studentInfo);
        
        const count = await store.getStudentCount(sessionId);
        io.to(sessionId).emit('exam:studentJoined', {
          userId,
          studentCount: count,
        });
      }

      /* Send current room state to the joiner */
      const room = await store.getRoom(sessionId);
      if (room) {
        socket.emit('exam:state', {
          started: room.started,
          endTime: room.endTime,
          paused: room.paused,
        });
      }

      logger.info(`User ${userId} joined exam room ${sessionId}`);
    });

    /* ── TEACHER: START EXAM ─────────────────────────────────────── */
    socket.on('exam:start', async ({ sessionId, durationMinutes }) => {
      if (role !== 'teacher') return socket.emit('error', { message: 'Unauthorized' });

      const room = await store.getRoom(sessionId);
      if (!room) return socket.emit('error', { message: 'Room not found' });

      const endTime = await store.startRoom(sessionId, durationMinutes);

      void persistSessionStatus(sessionId, 'active');

      io.to(sessionId).emit('exam:started', { endTime, durationMinutes });
      logger.info(`Exam started in room ${sessionId} — ${durationMinutes}min`);

      /* Auto-end timer */
      setTimeout(async () => {
        io.to(sessionId).emit('exam:ended', { reason: 'time_up' });
        await store.deleteRoom(sessionId);
        void persistSessionStatus(sessionId, 'completed');
      }, durationMinutes * 60 * 1000 + 5000);
    });

    /* ── TEACHER: PAUSE / RESUME ─────────────────────────────────── */
    socket.on('exam:pause', async ({ sessionId }) => {
      if (role !== 'teacher') return;
      await store.pauseRoom(sessionId, true);
      io.to(sessionId).emit('exam:paused');
    });

    socket.on('exam:resume', async ({ sessionId }) => {
      if (role !== 'teacher') return;
      await store.pauseRoom(sessionId, false);
      io.to(sessionId).emit('exam:resumed');
    });

    /* ── STUDENT: ANSWER SUBMIT ──────────────────────────────────── */
    socket.on('exam:answer', async ({ sessionId, questionIndex, answerId }) => {
      if (role !== 'student') return;
      const room = await store.getRoom(sessionId);
      if (!room || !room.started) return;

      const student = await store.getStudent(sessionId, userId);
      if (student) {
        if (!student.answeredIndices) student.answeredIndices = new Set();
        
        // If answerId is an empty array or null, they cleared the answer
        const isCleared = !answerId || (Array.isArray(answerId) && answerId.length === 0);
        
        if (isCleared) {
          student.answeredIndices.delete(questionIndex);
        } else {
          student.answeredIndices.add(questionIndex);
        }

        await store.setStudent(sessionId, userId, student);

        /* Notify teacher of progress */
        socket.to(sessionId).emit('exam:studentProgress', {
          userId,
          questionIndex,
          answersGiven: student.answeredIndices.size,
        });
      }
    });

    /* ── STUDENT: TAB SWITCH DETECTION ──────────────────────────── */
    socket.on('exam:tabSwitch', async ({ sessionId }) => {
      if (role !== 'student') return;
      const room = await store.getRoom(sessionId);
      if (!room) return;
      const student = await store.getStudent(sessionId, userId);
      if (student) {
        student.tabSwitches++;
        await store.setStudent(sessionId, userId, student);

        io.to(sessionId).emit('exam:suspiciousActivity', {
          userId,
          tabSwitches: student.tabSwitches,
          timestamp: new Date().toISOString(),
        });
        logger.warn(`Tab switch detected: user=${userId} session=${sessionId} count=${student.tabSwitches}`);

        // Blockchain Anchor: Immutable Violation Proof (Runs async in background)
        const blockchain = require('../services/blockchain/blockchainService');
        blockchain.sealGenericData({
          type: 'tab-switch',
          userId,
          sessionId,
          count: student.tabSwitches
        }, 'violation', `${userId}:${Date.now()}`).catch(e => logger.warn(`Violation anchoring failed: ${e.message}`));
      }
    });

    /* ── STUDENT: GENERAL VIOLATIONS ────────────────────────────── */
    socket.on('exam:violation', (violationData) => {
      if (role !== 'student') return;
      
      const sessionId = violationData.sessionId;

      io.to(sessionId).emit('exam:suspiciousActivity', {
        userId,
        violation: violationData,
        timestamp: new Date().toISOString(),
      });

      // Blockchain Anchor: Immutable Violation Proof (Runs async in background)
      const blockchain = require('../services/blockchain/blockchainService');
      blockchain.sealGenericData({
        ...violationData,
        userId,
        sessionId
      }, 'violation', `${userId}:${Date.now()}`).catch(e => logger.warn(`Violation anchoring failed: ${e.message}`));

      logger.warn(`Security violation: user=${userId} type=${violationData.type}`);
    });

    /* ── TEACHER: FORCE END EXAM ─────────────────────────────────── */
    socket.on('exam:forceEnd', async ({ sessionId }) => {
      if (role !== 'teacher') return;
      io.to(sessionId).emit('exam:ended', { reason: 'teacher_ended' });
      await store.deleteRoom(sessionId);
      void persistSessionStatus(sessionId, 'completed');
      logger.info(`Teacher force-ended exam: ${sessionId}`);
    });

    /* ── TEACHER: GET STUDENTS IN ROOM ───────────────────────────── */
    socket.on('exam:getStudents', async ({ sessionId }) => {
      if (role !== 'teacher') return;
      const list = await store.getAllStudents(sessionId);
      socket.emit('exam:studentList', { students: list });
    });

    /* ── GLOBAL ANNOUNCEMENTS ───────────────────────────────────── */
    socket.on('broadcast-announcement', (data) => {
      if (role !== 'teacher') return;
      io.emit('announcement', data);
      logger.info(`Teacher ${userId} broadcasted announcement: ${data.title}`);
    });

    /* ── DISCONNECT ──────────────────────────────────────────────── */
    socket.on('disconnect', (reason) => {
      store.deleteUserSocket(userId).catch(e => logger.error('deleteUserSocket error:', e));
      logger.info(`Socket disconnected: ${socket.id} | reason=${reason}`);
    });
  });

  ioInstance = io;
  return io;
};

module.exports = initSocket;
module.exports.getIO = () => ioInstance;
module.exports.store = store;
module.exports.examRooms = memoryRooms;
module.exports.userSocket = memoryUserSockets;
module.exports.store = store;