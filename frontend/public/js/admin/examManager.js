/**
 * js/admin/examManager.js
 * Session and Exam Management
 */

const ExamManager = {
  showCreateSession(bankId) {
    const courses = (window.AdminDashboard && window.AdminDashboard.courses) || [];
    const courseOptions = courses.map(c => `<option value="${c._id}">${c.courseName}</option>`).join('');

    Modal.show('create-session', `
      <div style="position: relative; padding: 10px;">
        <!-- Custom Header inside content -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px;">
          <div>
            <h2 style="font-size: 24px; font-weight: 800; color: var(--primary-indigo); letter-spacing: -0.5px; margin: 0;">Create Exam Session</h2>
            <p class="p-dim" style="font-size: 13px; margin-top: 4px;">Initialize a secure digital examination environment.</p>
          </div>
          <button onclick="Modal.close()" style="background: #f1f5f9; border: none; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #64748b; transition: all 0.2s;">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <form id="create-session-form" onsubmit="ExamManager.handleCreate(event, '${bankId}')" style="display: flex; flex-direction: column; gap: 24px;">
          <!-- Primary Info Grid -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div class="form-group">
              <label style="display: block; font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.05em;">Exam Title</label>
              <input type="text" name="title" class="form-control" placeholder="Midterm Exam 2024" style="width: 100%; height: 44px;" required>
            </div>
            <div class="form-group">
              <label style="display: block; font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.05em;">Scheduled Start</label>
              <input type="datetime-local" name="scheduledStart" class="form-control" style="width: 100%; height: 44px;" required>
            </div>
          </div>

          <!-- Academic Context Box -->
          <div style="background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div class="form-group">
              <label style="display: block; font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 6px;">COURSE ASSIGNMENT</label>
              <select name="courseId" class="form-control" style="width: 100%; background: #fff; height: 40px;">
                <option value="">Global (All Students)</option>
                ${courseOptions}
              </select>
            </div>
            <div class="form-group">
              <label style="display: block; font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 6px;">EDUCATIONAL BOARD</label>
              <select name="board" class="form-control" style="width: 100%; background: #fff; height: 40px;" required>
                <option value="All">All Boards</option>
                <option value="CBSE">CBSE</option>
                <option value="ICSE">ICSE</option>
                <option value="State Board">State Board</option>
              </select>
            </div>
          </div>

          <!-- Technical Settings -->
          <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 20px; align-items: end;">
            <div class="form-group">
              <label style="display: block; font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">Duration (Mins)</label>
              <input type="number" name="durationMinutes" class="form-control" value="60" style="height: 44px;" required>
            </div>
            <div style="background: #fff; border: 1px solid #edf2f7; padding: 12px 16px; border-radius: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <label style="display:flex; align-items:center; gap:8px; font-size: 12px; font-weight: 600; color: #475569; cursor: pointer;">
                <input type="checkbox" name="requireCamera" checked style="accent-color: var(--primary-indigo);"> Camera
              </label>
              <label style="display:flex; align-items:center; gap:8px; font-size: 12px; font-weight: 600; color: #475569; cursor: pointer;">
                <input type="checkbox" name="enableAIProctoring" checked style="accent-color: var(--primary-indigo);"> AI Proctor
              </label>
              <label style="display:flex; align-items:center; gap:8px; font-size: 12px; font-weight: 600; color: #475569; cursor: pointer;">
                <input type="checkbox" name="lockBrowser" checked style="accent-color: var(--primary-indigo);"> Lock UI
              </label>
              <label style="display:flex; align-items:center; gap:8px; font-size: 12px; font-weight: 600; color: #475569; cursor: pointer;">
                <input type="checkbox" name="shuffleQuestions" style="accent-color: var(--primary-indigo);"> Shuffle
              </label>
            </div>
          </div>

          <!-- Actions -->
          <div style="display: flex; gap: 12px; margin-top: 8px;">
            <button type="button" class="btn btn-secondary" style="flex: 1; height: 46px;" onclick="Modal.close()">Cancel</button>
            <button type="submit" class="btn btn-primary" style="flex: 2; height: 46px; background: var(--primary-indigo);">
              <i class="fas fa-rocket"></i> Create Exam Session
            </button>
          </div>
        </form>
      </div>

      <style>
        /* Hide fixed header for this modal */
        #modal-overlay-create-session header, 
        #modal-overlay-create-session .flex-between:first-child { display: none !important; }
      </style>
    `, { title: '', width: '650px' });
    ExamManager.initFormTiming('create-session-form');
  },

  showEditSession(sessionId) {
    const sessions = (window.AdminDashboard && window.AdminDashboard.sessions) || [];
    const courses = (window.AdminDashboard && window.AdminDashboard.courses) || [];
    const session = sessions.find((s) => String(s._id) === String(sessionId));
    if (!session) {
      notifications.error('Session not found');
      return;
    }

    const courseOptions = courses.map(c => {
      const selected = session.courseId && String(c._id) === String(session.courseId) ? 'selected' : '';
      return `<option value="${c._id}" ${selected}>${c.courseName}</option>`;
    }).join('');

    let localDate = '';
    if (session.startTime) {
      const d = new Date(session.startTime);
      if (!isNaN(d.getTime())) {
        const pad = (n) => String(n).padStart(2, '0');
        localDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      }
    }

    Modal.show('edit-session', `
      <div style="position: relative; padding: 10px;">
        <!-- Custom Header inside content -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px;">
          <div>
            <h2 style="font-size: 24px; font-weight: 800; color: var(--primary-indigo); letter-spacing: -0.5px; margin: 0;">Edit Exam Session</h2>
            <p class="p-dim" style="font-size: 13px; margin-top: 4px;">Update session parameters and proctoring settings.</p>
          </div>
          <button onclick="Modal.close()" style="background: #f1f5f9; border: none; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #64748b; transition: all 0.2s;">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <form id="edit-session-form" onsubmit="ExamManager.handleEdit(event, '${session._id}')" style="display: flex; flex-direction: column; gap: 24px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div class="form-group">
              <label style="display: block; font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">Exam Title</label>
              <input type="text" name="title" class="form-control" value="${(session.title || '').replace(/"/g, '&quot;')}" style="height: 44px;" required>
            </div>
            <div class="form-group">
              <label style="display: block; font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">Scheduled Start</label>
              <input type="datetime-local" name="scheduledStart" class="form-control" value="${localDate}" style="height: 44px;" required>
            </div>
          </div>

          <div style="background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div class="form-group">
              <label style="display: block; font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 6px;">COURSE (LOCKED)</label>
              <select name="courseId" class="form-control" style="width: 100%; background: #f1f5f9; height: 40px;" disabled>
                <option value="" ${!session.courseId ? 'selected' : ''}>Global Session</option>
                ${courseOptions}
              </select>
            </div>
            <div class="form-group">
              <label style="display: block; font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 6px;">EDUCATIONAL BOARD</label>
              <select name="board" class="form-control" style="width: 100%; background: #fff; height: 40px;" required>
                <option value="All" ${!session.board || session.board === 'All' || session.board === '' ? 'selected' : ''}>All Boards</option>
                <option value="CBSE" ${session.board === 'CBSE' ? 'selected' : ''}>CBSE</option>
                <option value="ICSE" ${session.board === 'ICSE' ? 'selected' : ''}>ICSE</option>
                <option value="State Board" ${session.board === 'State Board' ? 'selected' : ''}>State Board</option>
              </select>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 20px; align-items: end;">
            <div class="form-group">
              <label style="display: block; font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">Duration (Mins)</label>
              <input type="number" name="durationMinutes" class="form-control" value="${session.duration || 60}" style="height: 44px;" required>
            </div>
            <div style="background: #fff; border: 1px solid #edf2f7; padding: 12px 16px; border-radius: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <label style="display:flex; align-items:center; gap:8px; font-size: 12px; font-weight: 600; color: #475569; cursor: pointer;">
                <input type="checkbox" name="requireCamera" ${session.requireCamera !== false ? 'checked' : ''} style="accent-color: var(--primary-indigo);"> Camera
              </label>
              <label style="display:flex; align-items:center; gap:8px; font-size: 12px; font-weight: 600; color: #475569; cursor: pointer;">
                <input type="checkbox" name="enableAIProctoring" ${session.enableAIProctoring !== false ? 'checked' : ''} style="accent-color: var(--primary-indigo);"> AI Proctor
              </label>
              <label style="display:flex; align-items:center; gap:8px; font-size: 12px; font-weight: 600; color: #475569; cursor: pointer;">
                <input type="checkbox" name="lockBrowser" ${session.lockBrowser !== false ? 'checked' : ''} style="accent-color: var(--primary-indigo);"> Lock UI
              </label>
            </div>
          </div>

          <!-- Actions -->
          <div style="display: flex; gap: 12px; margin-top: 8px;">
            <button type="button" class="btn btn-secondary" style="flex: 1; height: 46px;" onclick="Modal.close()">Cancel</button>
            <button type="submit" class="btn btn-primary" style="flex: 2; height: 46px; background: var(--primary-indigo);">
              <i class="fas fa-save"></i> Save Session Changes
            </button>
          </div>
        </form>
      </div>

      <style>
        /* Hide fixed header for this modal */
        #modal-overlay-edit-session header, 
        #modal-overlay-edit-session .flex-between:first-child { display: none !important; }
      </style>
    `, { title: '', width: '650px' });
    ExamManager.initFormTiming('edit-session-form');
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
      if (typeof AdminDashboard !== 'undefined') {
        AdminDashboard.loadDashboardData();
        AdminDashboard.loadMCQBanks();
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
      if (typeof AdminDashboard !== 'undefined') {
        await AdminDashboard.loadDashboardData();
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
  },

  initFormTiming(formId) {
    setTimeout(() => {
      const form = document.getElementById(formId);
      if (!form) return;
      
      const startInput = form.elements['scheduledStart'];
      const durationInput = form.elements['durationMinutes'];
      
      // Inject preview element if it doesn't exist
      let previewEl = form.querySelector('.calculated-stop-time');
      if (!previewEl) {
        previewEl = document.createElement('div');
        previewEl.className = 'calculated-stop-time';
        previewEl.style.cssText = 'font-size: 12px; margin-top: 6px; display: none;';
        if (startInput && startInput.parentNode) {
          startInput.parentNode.appendChild(previewEl);
        }
      }

      const updateTiming = () => {
        const startVal = startInput.value;
        const durationVal = parseInt(durationInput.value, 10);
        
        previewEl.style.display = 'block';
        
        if (startVal && !isNaN(durationVal)) {
          const start = new Date(startVal);
          if (!isNaN(start.getTime())) {
            const end = new Date(start.getTime() + durationVal * 60 * 1000);
            
            const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: true };
            const dateOptions = { weekday: 'short', month: 'short', day: 'numeric' };
            
            previewEl.style.color = 'var(--primary-indigo)';
            previewEl.style.fontWeight = '700';
            previewEl.innerHTML = `<i class="far fa-clock"></i> Stops at: <strong>${end.toLocaleTimeString('en-US', timeOptions)}</strong> (${end.toLocaleDateString('en-US', dateOptions)})`;
            return;
          }
        }
        
        previewEl.style.color = 'var(--text-muted, #64748b)';
        previewEl.style.fontWeight = '500';
        previewEl.innerHTML = `<i class="far fa-clock"></i> Stops at: <span style="font-weight: 600;">--:-- (awaiting start time)</span>`;
      };

      if (startInput) {
        startInput.addEventListener('input', updateTiming);
        startInput.addEventListener('change', updateTiming);
      }
      if (durationInput) {
        durationInput.addEventListener('input', updateTiming);
        durationInput.addEventListener('change', updateTiming);
      }
      updateTiming();
    }, 100);
  }
};

window.ExamManager = ExamManager;
