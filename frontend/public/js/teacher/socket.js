/**
 * js/teacher/socket.js
 * Teacher Socket handler for monitoring
 */

const TeacherSocket = {
  socket: null,
  sessionId: null,

  init(sessionId) {
    this.sessionId = sessionId;
    const token = auth.getToken();

    this.socket = io('http://localhost:5000', {
      auth: { token }
    });

    this.socket.on('connect', () => {
      console.log('Teacher connected to socket');
      this.socket.emit('exam:join', { sessionId });
    });

    // Proxy all monitoring events to the Monitor controller
    const events = [
      'exam:studentJoined',
      'exam:studentProgress',
      'exam:suspiciousActivity',
      'exam:studentOffline'
    ];

    events.forEach(event => {
      this.socket.on(event, (data) => {
        if (window.Monitor) {
          Monitor.handleSocketEvent(event, data);
        }
      });
    });
  },

  startExam(duration) {
    this.socket.emit('exam:start', { sessionId: this.sessionId, durationMinutes: duration });
  },

  pauseExam() {
    if (this.socket) {
      this.socket.emit('exam:pause', { sessionId: this.sessionId });
    }
    if (window.Monitor) {
      Monitor.pauseExam();
    }
  },

  resumeExam() {
    if (this.socket) {
      this.socket.emit('exam:resume', { sessionId: this.sessionId });
    }
    if (window.Monitor) {
      Monitor.resumeExam();
    }
  },

  forceEnd() {
    if (!confirm('End this exam for all connected students?')) return;
    if (this.socket) {
      this.socket.emit('exam:forceEnd', { sessionId: this.sessionId });
    }
    if (window.Monitor) {
      Monitor.endExam();
    }
  }
};

window.TeacherSocket = TeacherSocket;
