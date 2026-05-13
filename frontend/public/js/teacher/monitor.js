/**
 * js/teacher/monitor.js
 * Live Exam Monitoring — shows enrolled students and submissions
 */

const Monitor = {
  sessionId: null,
  students: new Map(),
  sessionData: null,

  async init() {
    const params = new URLSearchParams(window.location.search);
    this.sessionId = params.get('sessionId');

    if (!this.sessionId) {
      window.location.href = '/teacher.html';
      return;
    }

    Navbar.render('nav-container');
    await this.loadInitialData();
    TeacherSocket.init(this.sessionId);
  },

  async loadInitialData() {
    try {
      const [sessionRes, resultRes, studentsRes] = await Promise.all([
        api.get('/portal/teacher/sessions'),
        api.get(`/portal/teacher/sessions/${this.sessionId}/results`),
        api.get('/portal/teacher/students')
      ]);

      const sessions = (sessionRes && sessionRes.data) || [];
      const session = sessions.find(s => String(s._id) === String(this.sessionId));
      if (!session) throw new Error('Session not found');

      const allStudents = (studentsRes && studentsRes.data) || [];
      const enrolled = allStudents; // Show all students on the platform

      const results = (resultRes && resultRes.data && resultRes.data.results) || [];
      const submitted = results.map((r) => ({
        studentId: r.studentId?._id || r.studentId,
        score: r.score,
        submittedAt: r.createdAt,
        correctCount: 0,
        totalQuestions: 0,
        violations: 0
      }));

      const normalized = {
        sessionId: session._id,
        title: session.title,
        status: session.status,
        enrolledCount: enrolled.length,
        submittedCount: submitted.length,
        enrolled: enrolled.map((s) => ({
          _id: s._id,
          firstName: (s.name || '').split(' ')[0] || 'Student',
          lastName: (s.name || '').split(' ').slice(1).join(' '),
          studentId: s.email || s._id
        })),
        submitted
      };

      this.sessionData = normalized;
      this.renderHeader(normalized);
      this.renderMonitorView(normalized);
    } catch (err) {
      console.error('Monitor error:', err);
      notifications.error('Failed to load monitoring data');
    }
  },

  renderHeader(data) {
    document.getElementById('session-title').innerText = `Monitoring: ${data.title || data.sessionId}`;
    document.getElementById('student-count').innerText = `${data.submittedCount} / ${data.enrolledCount || 'N/A'} Submitted — Status: ${(data.status || 'active').toUpperCase()}`;
  },

  renderMonitorView(data) {
    const list = document.getElementById('monitor-list');
    const enrolled = data.enrolled || [];
    const submitted = data.submitted || [];

    // Build a map of submitted results by studentId
    const submitMap = {};
    submitted.forEach(s => { submitMap[s.studentId] = s; });

    if (enrolled.length === 0 && submitted.length === 0) {
      list.innerHTML = `
        <tr>
          <td colspan="5" class="p-dim" style="text-align:center; padding:40px;">
            No students have joined this exam yet.
          </td>
        </tr>
      `;
      return;
    }

    // If we have enrolled students, show them with status
    if (enrolled.length > 0) {
      list.innerHTML = enrolled.map(s => {
        const sub = submitMap[s._id];
        const isOnline = this.students.has(s._id) ? this.students.get(s._id).status === 'online' : false;
        const alertCount = this.students.has(s._id) ? this.students.get(s._id).alerts || 0 : 0;

        return `
          <tr id="student-${s._id}">
            <td>
              <div style="font-weight:600">${s.firstName} ${s.lastName}</div>
              <div class="p-dim" style="font-size:12px">${s.studentId}</div>
            </td>
            <td>
              ${sub
            ? '<span class="status-pill status-online">SUBMITTED</span>'
            : isOnline
              ? '<span class="status-pill status-online">ONLINE</span>'
              : '<span class="status-pill status-offline">WAITING</span>'
          }
            </td>
            <td>
              ${sub
            ? `<strong style="color:var(--success)">${sub.score}%</strong> (${sub.correctCount}/${sub.totalQuestions})`
            : '<span class="p-dim">—</span>'
          }
            </td>
            <td>
              ${(sub && sub.violations > 0) || alertCount > 0
            ? `<span class="status-pill status-warning">⚠️ ${sub ? sub.violations : alertCount} Alerts</span>`
            : '<span class="p-dim">None</span>'
          }
            </td>
            <td>
              ${sub
            ? `<span class="p-dim" style="font-size:11px">${new Date(sub.submittedAt).toLocaleTimeString()}</span>`
            : '<span class="p-dim">—</span>'
          }
            </td>
          </tr>
        `;
      }).join('');
    } else if (submitted.length > 0) {
      // No enrolled list, but we have submissions — show those
      list.innerHTML = submitted.map((s, i) => `
        <tr>
          <td>
            <div style="font-weight:600">Student ${i + 1}</div>
            <div class="p-dim" style="font-size:12px">${s.studentId}</div>
          </td>
          <td><span class="status-pill status-online">SUBMITTED</span></td>
          <td><strong style="color:var(--success)">${s.score}%</strong> (${s.correctCount}/${s.totalQuestions})</td>
          <td>
            ${s.violations > 0
          ? `<span class="status-pill status-warning">⚠️ ${s.violations}</span>`
          : '<span class="p-dim">None</span>'
        }
          </td>
          <td><span class="p-dim" style="font-size:11px">${new Date(s.submittedAt).toLocaleTimeString()}</span></td>
        </tr>
      `).join('');
    }
  },

  handleSocketEvent(event, data) {
    switch (event) {
      case 'exam:studentJoined':
        this.updateStudentStatus(data.userId, 'online');
        break;
      case 'exam:studentProgress':
        this.updateStudentProgress(data.userId, data.answersGiven);
        break;
      case 'exam:suspiciousActivity':
        this.addAlert(data.userId, data.violation || { type: 'tab-switch', detail: 'Tab switch detected' });
        break;
      case 'exam:studentOffline':
        this.updateStudentStatus(data.userId, 'offline');
        break;
    }
  },

  async setSessionStatus(status) {
    if (!this.sessionId) return;
    try {
      await api.patch(`/portal/teacher/sessions/${this.sessionId}/status`, { status });
      if (this.sessionData) {
        this.sessionData.status = status;
        this.renderHeader(this.sessionData);
      }
      await this.loadInitialData();
    } catch (err) {
      notifications.error(`Failed to update session status: ${err.message}`);
      throw err;
    }
  },

  async pauseExam() {
    await this.setSessionStatus('pending');
    notifications.success('Exam paused');
  },

  async resumeExam() {
    await this.setSessionStatus('active');
    notifications.success('Exam resumed');
  },

  async endExam() {
    await this.setSessionStatus('completed');
    notifications.success('Exam ended');
  },

  updateStudentStatus(userId, status) {
    const s = this.students.get(userId) || { progress: 0, alerts: 0 };
    s.status = status;
    this.students.set(userId, s);
  },

  addAlert(userId, violation) {
    const s = this.students.get(userId) || { status: 'online', progress: 0, alerts: 0, history: [] };
    if (!s.history) s.history = [];

    s.alerts++;
    s.history.push(violation);
    this.students.set(userId, s);

    // Dynamic UI update for the specific row
    const row = document.getElementById(`student-${userId}`);
    if (row) {
      const alertCell = row.cells[3];
      if (alertCell) {
        alertCell.innerHTML = `
          <span class="status-pill status-warning" title="${violation.detail}">
            ⚠️ ${s.alerts} Alert${s.alerts > 1 ? 's' : ''}
          </span>
          <div class="p-dim" style="font-size:10px; margin-top:4px;">Latest: ${violation.type}</div>
        `;
      }
    }

    notifications.warn(`⚠️ Student Alert: ${violation.type} — ${violation.detail}`);
  }
};

window.Monitor = Monitor;
