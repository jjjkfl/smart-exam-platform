/**
 * js/student/socket.js
 * Socket.io client for real-time exam sync
 */

const ExamSocket = {
  socket: null,
  sessionId: null,

  init(sessionId) {
    this.sessionId = sessionId;
    const token = auth.getToken();

    this.socket = io('http://localhost:5000', {
      auth: { token }
    });

    this.socket.on('connect', () => {
      console.log('Connected to exam socket');
      this.socket.emit('exam:join', { sessionId });
    });

    this.socket.on('exam:state', (state) => {
      if (state.endTime) {
        const remaining = Math.max(0, Math.floor((state.endTime - Date.now()) / 1000));
        ExamTimer.sync(remaining);
      }
    });

    this.socket.on('exam:ended', (data) => {
      notifications.warn('Exam has been ended by the teacher.');
      ExamEngine.submit();
    });

    this.socket.on('exam:paused', () => {
      Modal.show('paused', '<p>The exam has been paused by the teacher.</p>', { title: 'Exam Paused' });
    });

    this.socket.on('exam:resumed', () => {
      Modal.close();
    });

    this.socket.on('error', (err) => {
      notifications.error(err.message);
    });
  },

  sendAnswer(questionIndex, answerId) {
    if (this.socket) {
      this.socket.emit('exam:answer', {
        sessionId: this.sessionId,
        questionIndex,
        answerId
      });
    }
  },

  sendTabSwitch() {
    if (this.socket) {
      this.socket.emit('exam:tabSwitch', { sessionId: this.sessionId });
    }
  }
};

window.ExamSocket = ExamSocket;
