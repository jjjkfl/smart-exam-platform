/**
 * js/teacher/examManager.js
 * Session and Exam Management
 */

const ExamManager = {
  showCreateSession(bankId) {
    const courses = (window.TeacherDashboard && window.TeacherDashboard.courses) || [];
    const courseOptions = courses.map(c => `<option value="${c._id}">${c.courseName}</option>`).join('');

    Modal.show('create-session', `
      <form id="create-session-form" onsubmit="ExamManager.handleCreate(event, '${bankId}')">
        <div class="form-group">
          <label>Exam Title</label>
          <input type="text" name="title" class="form-control" placeholder="Midterm Exam 2024" required>
        </div>
        <div class="form-group">
          <label>Target Course (Optional)</label>
          <select name="courseId" class="form-control">
            <option value="">Global (All Students)</option>
            ${courseOptions}
          </select>
        </div>
        <div class="form-group">
          <label>Educational Board</label>
          <select name="board" class="form-control" required>
            <option value="All">All Boards (Global)</option>
            <option value="CBSE">CBSE</option>
            <option value="ICSE">ICSE</option>
            <option value="State Board">State Board</option>
            <option value="TestStream">TestStream (Mock)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Scheduled Start</label>
          <input type="datetime-local" name="scheduledStart" class="form-control" required>
        </div>
        <div class="form-group">
          <label>Duration (Mins)</label>
          <input type="number" name="durationMinutes" class="form-control" value="60" required>
        </div>
        <div class="form-group" style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 10px;">
          <label style="display:flex; align-items:center; gap:8px;">
            <input type="checkbox" name="requireCamera" checked> Require Camera
          </label>
          <label style="display:flex; align-items:center; gap:8px;">
            <input type="checkbox" name="enableAIProctoring" checked> AI Proctoring
          </label>
          <label style="display:flex; align-items:center; gap:8px;">
            <input type="checkbox" name="lockBrowser" checked> Lock Browser
          </label>
          <label style="display:flex; align-items:center; gap:8px;">
            <input type="checkbox" name="shuffleQuestions"> Shuffle Questions
          </label>
        </div>
        <div class="form-group">
          <label>Max Violations (before auto-submit)</label>
          <input type="number" name="maxViolations" class="form-control" value="5" min="1" max="20">
        </div>
        <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 12px;">Create Session</button>
      </form>
    `, { title: 'Create Exam Session' });
  },

  showEditSession(sessionId) {
    const sessions = (window.TeacherDashboard && window.TeacherDashboard.sessions) || [];
    const courses = (window.TeacherDashboard && window.TeacherDashboard.courses) || [];
    const session = sessions.find((s) => String(s._id) === String(sessionId));
    if (!session) {
      notifications.error('Session not found');
      return;
    }

    const courseOptions = courses.map(c => {
      const selected = session.courseId && String(c._id) === String(session.courseId) ? 'selected' : '';
      return `<option value="${c._id}" ${selected}>${c.courseName}</option>`;
    }).join('');

    const localDate = session.startTime
      ? new Date(session.startTime).toISOString().slice(0, 16)
      : '';

    Modal.show('edit-session', `
      <form id="edit-session-form" onsubmit="ExamManager.handleEdit(event, '${session._id}')">
        <div class="form-group">
          <label>Exam Title</label>
          <input type="text" name="title" class="form-control" value="${(session.title || '').replace(/"/g, '&quot;')}" required>
        </div>
        <div class="form-group">
          <label>Target Course (Optional)</label>
          <select name="courseId" class="form-control" disabled>
            <option value="" ${!session.courseId ? 'selected' : ''}>Global (All Students)</option>
            ${courseOptions}
          </select>
        </div>
        <div class="form-group">
          <label>Educational Board</label>
          <select name="board" class="form-control" required>
            <option value="All" ${!session.board || session.board === 'All' || session.board === '' ? 'selected' : ''}>All Boards (Global)</option>
            <option value="CBSE" ${session.board === 'CBSE' ? 'selected' : ''}>CBSE</option>
            <option value="ICSE" ${session.board === 'ICSE' ? 'selected' : ''}>ICSE</option>
            <option value="State Board" ${session.board === 'State Board' ? 'selected' : ''}>State Board</option>
            <option value="TestStream" ${session.board === 'TestStream' ? 'selected' : ''}>TestStream (Mock)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Scheduled Start</label>
          <input type="datetime-local" name="scheduledStart" class="form-control" value="${localDate}" required>
        </div>
        <div class="form-group">
          <label>Duration (Mins)</label>
          <input type="number" name="durationMinutes" class="form-control" value="${session.duration || 60}" required>
        </div>
        <div class="form-group" style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 10px;">
          <label style="display:flex; align-items:center; gap:8px;">
            <input type="checkbox" name="requireCamera" ${session.requireCamera !== false ? 'checked' : ''}> Require Camera
          </label>
          <label style="display:flex; align-items:center; gap:8px;">
            <input type="checkbox" name="enableAIProctoring" ${session.enableAIProctoring !== false ? 'checked' : ''}> AI Proctoring
          </label>
          <label style="display:flex; align-items:center; gap:8px;">
            <input type="checkbox" name="lockBrowser" ${session.lockBrowser !== false ? 'checked' : ''}> Lock Browser
          </label>
        </div>
        <div class="form-group">
          <label>Max Violations</label>
          <input type="number" name="maxViolations" class="form-control" value="${session.maxViolations || 5}" min="1" max="20">
        </div>
        <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 12px;">Update Session</button>
      </form>
    `, { title: 'Edit Exam Session' });
  },

  async handleCreate(event, bankId) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const payload = Object.fromEntries(formData.entries());
    payload.mcqBankId = bankId;
    payload.shuffleQuestions = formData.get('shuffleQuestions') === 'on';
    payload.requireCamera = formData.get('requireCamera') === 'on';
    payload.enableAIProctoring = formData.get('enableAIProctoring') === 'on';
    payload.lockBrowser = formData.get('lockBrowser') === 'on';
    payload.maxViolations = parseInt(payload.maxViolations, 10) || 5;

    try {
      await api.post('/portal/teacher/sessions', payload);
      notifications.success('Exam session created successfully!');
      Modal.close();
      if (typeof TeacherDashboard !== 'undefined') {
        TeacherDashboard.loadDashboardData();
        TeacherDashboard.loadMCQBanks();
      }
    } catch (err) {
      notifications.error(err.message);
    }
  },

  async handleEdit(event, sessionId) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const payload = Object.fromEntries(formData.entries());
    payload.requireCamera = formData.get('requireCamera') === 'on';
    payload.enableAIProctoring = formData.get('enableAIProctoring') === 'on';
    payload.lockBrowser = formData.get('lockBrowser') === 'on';
    payload.maxViolations = parseInt(payload.maxViolations, 10) || 5;

    try {
      await api.request(`/portal/teacher/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      notifications.success('Exam session updated successfully!');
      Modal.close();
      if (typeof TeacherDashboard !== 'undefined') {
        await TeacherDashboard.loadDashboardData();
      }
    } catch (err) {
      notifications.error(err.message || 'Failed to update session');
    }
  },

  async updateStatus(sessionId, status) {
    try {
      await api.patch(`/portal/teacher/sessions/${sessionId}/status`, { status });
      notifications.success(`Session ${status}`);
      location.reload();
    } catch (err) {
      notifications.error(err.message);
    }
  }
};

window.ExamManager = ExamManager;
