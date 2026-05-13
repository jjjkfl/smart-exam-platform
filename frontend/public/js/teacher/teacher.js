/**
 * js/teacher/teacher.js
 * Teacher Dashboard Controller
 */

const TeacherDashboard = {
  courses: [],
  banks: [],
  sessions: [],
  async init() {
    if (!auth.checkAuth()) return;
    if (this._pollingInterval) clearInterval(this._pollingInterval);
    this.bindSidebarNav();
    this.highlightSidebar('dashboard');

    // Set teacher name in welcome header and sidebar
    const user = auth.getUser();
    if (user && user.name) {
      const nameEl = document.getElementById('teacher-name');
      const sidebarNameEl = document.getElementById('sidebar-name');
      const avatarEl = document.getElementById('sidebar-avatar');
      
      const firstName = user.name.split(' ')[0];
      const initials = user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      
      if (nameEl) nameEl.textContent = firstName;
      if (sidebarNameEl) sidebarNameEl.textContent = firstName;
      if (avatarEl) avatarEl.textContent = initials;
    }

    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');

    if (view === 'analytics-all') {
      this.highlightSidebar('analytics');
      this.switchView('analytics-all');
      this.loadAllAnalytics();
    } else if (params.has('sessionId')) {
      if (view === 'analytics') {
        this.highlightSidebar('analytics');
        this.switchView('analytics');
        Analytics.init(params.get('sessionId'));
      } else {
        this.highlightSidebar('dashboard');
        this.switchView('monitor');
        Monitor.init();
      }
    } else {
      const viewMap = {
        'materials': () => this.loadMaterials(),
        'students': () => this.loadStudentsView(),
        'timetable': () => this.loadTimetable(),
        'forum': () => this.loadForum()
      };

      this.highlightSidebar(view || 'dashboard');
      this.switchView(view || 'dashboard');

      if (viewMap[view]) {
        viewMap[view]();
      } else {
        await this.loadDashboardData();
        await this.loadMCQBanks();

        // Real-time polling every 5 seconds
        if (this._pollingInterval) clearInterval(this._pollingInterval);
        this._pollingInterval = setInterval(() => {
          this.loadDashboardData();
          this.loadMCQBanks();
        }, 5000);
      }
    }
  },

  showMCQUpload() {
    document.getElementById('ai-mcq-upload').click();
  },

  switchView(viewName) {
    utils.$all('.view').forEach(v => {
      v.style.display = 'none';
      v.classList.remove('active');
    });
    const target = utils.$(`#view-${viewName}`);
    if (target) {
      target.style.display = 'block';
      target.classList.add('active');
    }

    // Update topbar title
    const titles = {
      'dashboard': 'Educator Dashboard',
      'monitor': 'Live Monitoring',
      'analytics': 'Session Analytics',
      'analytics-all': 'Global Analytics',
      'timetable': 'Class Timetable',
      'materials': 'Curriculum Management',
      'students': 'Student Roster',
      'forum': 'Teacher Forum'
    };
    const tb = document.getElementById('topbar-title');
    if (tb) tb.textContent = titles[viewName] || 'Educator Dashboard';
  },

  async loadDashboardData() {
    try {
      const { data } = await api.get('/portal/teacher/dashboard');
      const { stats, recentSessions, recentResults, courses } = data;

        this.courses = courses || [];
        this.sessions = recentSessions || [];

        // Helper to update with pulse
      const updateStat = (id, val) => {
        const el = document.getElementById(id);
        if (el && el.innerText != val) {
          el.innerText = val;
          el.classList.remove('real-time-update');
          void el.offsetWidth; // trigger reflow
          el.classList.add('real-time-update');
        }
      };

      // Update stats
      updateStat('stat-active', stats.activeSessions);
      updateStat('stat-total-exams', stats.totalSessions);
      updateStat('stat-total-students', stats.totalStudents);
      updateStat('stat-banks', stats.totalMCQBanks);

      // Render Sessions
      this.renderSessions(recentSessions);

      // Render Results
      this.renderResults(recentResults);
    } catch (err) {
      console.error(err.message || 'Failed to load dashboard');
    }
  },
  
  renderDriveActions(courses) {
    let container = document.getElementById('drive-actions-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'drive-actions-container';
      container.className = 'drive-actions animate-fade-in';
      container.style.cssText = 'display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 2rem;';
      
      const header = document.querySelector('.dashboard-header');
      if (header) {
        header.parentNode.insertBefore(container, header.nextSibling);
      }
    }

    container.innerHTML = '';

    if (courses.length === 0) return;

    courses.forEach(course => {
      const btn = document.createElement('button');
      btn.className = 'btn btn-secondary btn-drive-link btn-sm';
      btn.style.cssText = 'background: #eff6ff; color: #3b82f6; border-color: #bfdbfe;';
      
      if (course.driveLink) {
        btn.innerHTML = `<i class="fab fa-google-drive"></i> ${course.courseName}`;
        btn.onclick = () => window.open(course.driveLink, '_blank');
      } else {
        btn.innerHTML = `<i class="fas fa-plus"></i> ${course.courseName} Drive`;
        btn.onclick = () => this.showEditDriveModal(course._id, course.courseName);
      }
      
      if (course.driveLink) {
        btn.oncontextmenu = (e) => {
          e.preventDefault();
          this.showEditDriveModal(course._id, course.courseName);
        };
        btn.title = 'Right-click to edit drive link';
      }
      
      container.appendChild(btn);
    });
  },

  showEditDriveModal(courseId, courseName) {
    const course = this.courses.find(c => String(c._id) === String(courseId));
    Modal.show('edit-drive', `
      <form onsubmit="TeacherDashboard.handleUpdateDrive(event, '${courseId}')">
        <div class="form-group">
          <label>Google Drive / Resource Link for <strong>${courseName}</strong></label>
          <input type="url" name="driveLink" class="form-control" placeholder="https://drive.google.com/..." value="${course?.driveLink || ''}" required>
          <p class="p-dim" style="font-size:12px; margin-top:8px;">This link will appear as a quick-access button on your dashboard. Right-click the button later to edit.</p>
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%;">Save Drive Link</button>
      </form>
    `, { title: 'Configure Course Drive' });
  },

  async handleUpdateDrive(event, courseId) {
    event.preventDefault();
    const driveLink = new FormData(event.target).get('driveLink');
    try {
      const res = await api.request(`/portal/teacher/courses/${courseId}/drive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driveLink })
      });

      if (res.success) {
        notifications.success('Course Drive link updated');
        Modal.close();
        await this.loadDashboardData();
      }
    } catch (err) {
      notifications.error('Failed to update drive link: ' + err.message);
    }
  },

  setBoardFilter(board) {
    this.lastSelectedBoard = board;
    this.renderSessions(); // Re-render with cached sessions
  },

  renderSessions(sessions) {
    if (sessions) this.sessions = sessions;
    const list = document.getElementById('recent-sessions');
    const boardFilterEl = document.getElementById('filter-session-board');
    
    // Ensure the dropdown matches our state (useful when polling refreshes the data)
    if (boardFilterEl && this.lastSelectedBoard) {
      boardFilterEl.value = this.lastSelectedBoard;
    }
    
    const selectedBoard = this.lastSelectedBoard || 'All';

    let filteredSessions = this.sessions || [];
    if (selectedBoard && selectedBoard !== 'All') {
      filteredSessions = filteredSessions.filter(s => 
        s.board === selectedBoard || 
        s.board === 'All' || 
        !s.board || 
        s.board === ''
      );
    }

    if (filteredSessions.length === 0) {
      list.innerHTML = '<tr><td colspan="5" class="p-dim" style="text-align:center">No sessions found</td></tr>';
      return;
    }

    list.innerHTML = filteredSessions.map(s => `
      <tr>
        <td style="white-space: nowrap;">
          <strong>${s.title || s.examId}</strong>
          ${s.board && s.board !== 'All' ? `<span class="badge" style="margin-left:8px; font-size:10px; background:rgba(79, 70, 229, 0.1); color:var(--primary);">${s.board}</span>` : ''}
        </td>
        <td>${utils.formatDate(s.scheduledStart || s.startTime)}</td>
        <td><span class="status-pill ${s.status === 'active' ? 'status-online' : 'status-offline'}">${s.status.toUpperCase()}</span></td>
        <td>${s.submissions || 0} Students</td>
        <td style="display:flex; gap:6px;">
          <button onclick="ExamManager.showEditSession('${s._id}')" class="btn btn-outline btn-sm">Edit</button>
          <button onclick="TeacherDashboard.goToMonitor('${s._id}')" class="btn btn-outline btn-sm">Monitor</button>
          <button onclick="TeacherDashboard.goToAnalytics('${s._id}')" class="btn btn-outline btn-sm">Results</button>
          <button onclick="TeacherDashboard.deleteSession('${s._id}')" class="btn btn-outline btn-sm" style="color:var(--danger); border-color:rgba(239, 68, 68, 0.2);"><i class="fas fa-trash"></i></button>
        </td>
      </tr>
    `).join('');
  },

  async deleteSession(sessionId) {
    if (!confirm('Are you sure you want to delete this session?')) return;
    try {
      const res = await api.delete(`/portal/teacher/sessions/${sessionId}`);
      if (res.success) {
        notifications.success('Session deleted');
        this.loadDashboardData();
        this.loadMCQBanks();
      }
    } catch (e) {
      notifications.error('Failed to delete session');
    }
  },

  async deleteMCQBank(bankId) {
    if (!confirm('Are you sure you want to delete this MCQ bank?')) return;
    try {
      const res = await api.delete(`/portal/teacher/mcq-banks/${bankId}`);
      if (res.success) {
        notifications.success('MCQ Bank deleted');
        this.loadDashboardData();
        this.loadMCQBanks();
      }
    } catch (e) {
      notifications.error('Failed to delete MCQ Bank');
    }
  },

  renderResults(results) {
    const list = document.getElementById('recent-results');
    if (!results || results.length === 0) {
      list.innerHTML = '<tr><td colspan="4" class="p-dim" style="text-align:center">No submissions yet</td></tr>';
      return;
    }

    list.innerHTML = results.map(r => `
      <tr>
        <td><strong>${r.studentName}</strong></td>
        <td>${r.examTitle}</td>
        <td style="font-weight:700; color:${r.score >= 50 ? 'var(--success)' : 'var(--danger)'}">${r.score}%</td>
        <td>${utils.formatDate(r.submittedAt)}</td>
      </tr>
    `).join('');
  },

  async loadMCQBanks() {
    const container = document.getElementById('mcq-banks-grid');
    if (!container) return;
    
    // Show new global loader
    Loader.show('mcq-banks-grid', 'Syncing MCQ Repositories...');

    try {
      const { data } = await api.get('/portal/teacher/mcq-banks');
      this.banks = data || [];

      if (data.length === 0) {
        container.innerHTML = '<p class="p-dim" style="grid-column: 1/-1; text-align: center; padding: 40px;">No MCQ banks found. Upload a PDF/DOCX to get started.</p>';
        return;
      }

      container.innerHTML = data.map(bank => `
        <div class="mcq-bank-card animate-slide-up" onclick="TeacherDashboard.previewMCQBank('${bank._id}')">
          <div class="mcq-bank-header">
            <div class="mcq-bank-icon">
              <i class="fas fa-file-medical"></i>
            </div>
            <div class="mcq-bank-info">
              <h4 class="mcq-bank-title">${bank.title || 'Untitled Bank'}</h4>
              <p class="mcq-bank-course">
                ${bank.subject || 'General Academic'} 
                ${bank.board ? `<span class="badge" style="margin-left:8px; font-size:10px; background:rgba(79, 70, 229, 0.1); color:var(--primary);">${bank.board}</span>` : ''}
              </p>
            </div>
          </div>
          <div class="mcq-bank-stats">
            <div class="mcq-bank-stat">
              <div class="mcq-bank-stat-value">${bank.questions ? bank.questions.length : 0}</div>
              <div class="mcq-bank-stat-label">MCQs</div>
            </div>
            <div class="mcq-bank-stat">
              <div class="mcq-bank-stat-value">${bank.usageCount || 0}</div>
              <div class="mcq-bank-stat-label">Used</div>
            </div>
          </div>
          <div class="mcq-bank-actions">
            <button onclick="event.stopPropagation(); ExamManager.showCreateSession('${bank._id}')" class="btn btn-primary btn-sm">Create Exam</button>
            <button onclick="event.stopPropagation(); TeacherDashboard.editMCQBank('${bank._id}')" class="btn btn-secondary btn-sm"><i class="fas fa-edit"></i></button>
            <button onclick="event.stopPropagation(); TeacherDashboard.deleteMCQBank('${bank._id}')" class="btn btn-secondary btn-sm" style="color: var(--danger);"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      `).join('');
    } catch (err) {
      console.error(err);
    }
  },

  async loadAllAnalytics() {
    try {
      const { data } = await api.get('/portal/teacher/results/general-analytics');

      const container = document.getElementById('global-analytics-stats');
      container.innerHTML = `
        <div class="metrics-grid">
          <div class="glass-card">
            <p class="p-dim">Total Submissions</p>
            <div class="metric-value">${data.totalSubmissions}</div>
          </div>
          <div class="glass-card">
            <p class="p-dim">Average Score</p>
            <div class="metric-value">${data.avgScore}%</div>
          </div>
          <div class="glass-card">
            <p class="p-dim">Overall Pass Rate</p>
            <div class="metric-value" style="color: var(--primary)">${data.passRate}%</div>
          </div>
        </div>
      `;

      if (typeof Charts !== 'undefined') {
        Charts.renderGrades('global-grade-chart', data.gradeBreakdown);
      }
    } catch (err) {
      notifications.error('Failed to load global analytics: ' + err.message);
    }
  },

  goToMonitor(sessionId) {
    const url = new URL(window.location);
    url.searchParams.set('sessionId', sessionId);
    url.searchParams.delete('view');
    window.history.pushState({}, '', url);
    this.init();
  },

  goToAnalytics(sessionId) {
    const url = new URL(window.location);
    url.searchParams.set('sessionId', sessionId);
    url.searchParams.set('view', 'analytics');
    window.history.pushState({}, '', url);
    this.init();
  },

  previewMCQBank(bankId) {
    const bank = this.banks.find((b) => String(b._id) === String(bankId));
    if (!bank) return notifications.error('MCQ bank not found');

    Modal.show('preview-bank', `
      <div class="preview-container">
        <div style="
          background: var(--primary-soft); 
          padding: 24px; 
          border-radius: 20px; 
          margin-bottom: 32px;
          border: 1px solid rgba(0,113,227,0.1);
        ">
          <h3 style="font-size: 24px; font-weight: 800; color: var(--primary); margin-bottom: 4px; letter-spacing: -0.02em;">${bank.title}</h3>
          <p style="font-size: 14px; font-weight: 600; color: var(--primary); opacity: 0.7; text-transform: uppercase; letter-spacing: 0.05em;">
            ${bank.subject || 'General'} • ${(bank.questions || []).length} Questions
          </p>
        </div>

        <div class="preview-scroll-custom" style="max-height: 60vh; overflow-y: auto; padding-right: 12px; margin-right: -12px;">
          ${(bank.questions || []).map((q, idx) => `
            <div style="
              background: #fff; 
              border: 1px solid #eef2f6; 
              border-radius: 20px; 
              margin-bottom: 24px; 
              padding: 32px; 
              box-shadow: 0 4px 20px rgba(0,0,0,0.03);
            ">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <span style="
                  background: var(--bg-main); 
                  color: #64748b; 
                  padding: 6px 16px; 
                  border-radius: 10px; 
                  font-size: 13px; 
                  font-weight: 800;
                  text-transform: uppercase;
                ">QUESTION ${idx + 1}</span>
                <span style="
                  background: var(--success-soft); 
                  color: var(--success); 
                  padding: 6px 16px; 
                  border-radius: 10px; 
                  font-size: 13px; 
                  font-weight: 700;
                ">Answer Key: ${q.correctAnswer || '-'}</span>
              </div>

              <div style="font-size: 18px; font-weight: 600; color: #1e293b; margin-bottom: 24px; line-height: 1.6;">${q.questionText || 'Untitled question'}</div>
              
              ${q.image ? `
                <div style="margin-bottom: 20px; border-radius: 12px; overflow: hidden; border: 1px solid #f1f5f9;">
                  <img src="${window.SERVER_URL}${q.image}" style="max-width: 100%; display: block;" onerror="this.src='/img/placeholder.png'">
                </div>
              ` : ''}

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                ${(q.options || []).map((opt) => `
                  <div style="
                    display: flex; 
                    align-items: flex-start; 
                    gap: 16px; 
                    padding: 18px; 
                    background: ${opt.label === q.correctAnswer ? 'var(--success-soft)' : '#f8fafc'}; 
                    border: 1px solid ${opt.label === q.correctAnswer ? 'rgba(16, 185, 129, 0.3)' : '#f1f5f9'}; 
                    border-radius: 14px;
                  ">
                    <span style="
                      width: 32px; 
                      height: 32px; 
                      background: ${opt.label === q.correctAnswer ? 'var(--success)' : '#fff'}; 
                      color: ${opt.label === q.correctAnswer ? '#fff' : '#64748b'}; 
                      display: flex; 
                      align-items: center; 
                      justify-content: center; 
                      border-radius: 10px; 
                      font-weight: 800; 
                      font-size: 14px; 
                      flex-shrink: 0;
                      box-shadow: 0 2px 6px rgba(0,0,0,0.06);
                    ">${opt.label}</span>
                    <div style="flex: 1;">
                      <div style="font-size: 15px; font-weight: 500; color: ${opt.label === q.correctAnswer ? '#065f46' : '#334155'}; line-height: 1.5; word-break: break-word;">
                        ${opt.text}
                      </div>
                      ${opt.image ? `
                        <div style="margin-top: 12px; border-radius: 8px; overflow: hidden; border: 1px solid rgba(0,0,0,0.05); max-width: 200px;">
                          <img src="${window.SERVER_URL}${opt.image}" style="width: 100%; display: block;" onerror="this.src='/img/placeholder.png'">
                        </div>
                      ` : ''}
                    </div>
                  </div>
                `).join('')}
              </div>

              ${q.explanation ? `
                <div style="
                  margin-top: 20px; 
                  padding: 16px; 
                  background: #f0f9ff; 
                  border-radius: 12px; 
                  border-left: 4px solid #0ea5e9;
                ">
                  <div style="font-weight: 800; font-size: 11px; color: #0369a1; text-transform: uppercase; margin-bottom: 4px;">💡 Explanation</div>
                  <div style="font-size: 14px; color: #0c4a6e; line-height: 1.5;">${q.explanation}</div>
                </div>
              ` : ''}
            </div>
          `).join('') || '<p class="p-dim">No questions found.</p>'}
        </div>
      </div>
    `, { title: '📚 MCQ Bank Library', width: '850px' });
  },

  editMCQBank(bankId) {
    const bank = this.banks.find((b) => String(b._id) === String(bankId));
    if (!bank) return notifications.error('MCQ bank not found');

    Modal.show('edit-bank', `
      <form id="edit-bank-form" onsubmit="TeacherDashboard.handleEditMCQBank(event, '${bank._id}')">
        <div class="form-group">
          <label>Bank Title</label>
          <input type="text" name="title" class="form-control" value="${(bank.title || '').replace(/"/g, '&quot;')}" required>
        </div>
        <div class="form-group">
          <label>Subject</label>
          <input type="text" name="subject" class="form-control" value="${(bank.subject || '').replace(/"/g, '&quot;')}" required>
        </div>

        <div style="margin-top: 24px; border-top: 1px solid #eee; padding-top: 16px;">
          <h4 style="margin-bottom: 16px; color: var(--primary);">Questions & Answer Keys</h4>
          <div style="max-height: 400px; overflow-y: auto; padding-right: 10px;">
            ${(bank.questions || []).map((q, i) => `
              <div class="edit-q-card" style="background: #f8fafc; padding: 16px; border-radius: 12px; margin-bottom: 16px; border: 1px solid #e2e8f0;">
                <div style="font-weight: 700; margin-bottom: 8px; color: #64748b; font-size: 12px;">QUESTION ${i + 1}</div>
                <div class="form-group">
                  <input type="text" name="q_${i}_text" class="form-control" value="${(q.questionText || '').replace(/"/g, '&quot;')}" required>
                </div>
                <div style="display: flex; gap: 12px; margin-top: 8px;">
                  <div style="flex: 1;">
                    <label style="font-size: 11px; font-weight: 700;">CORRECT KEY</label>
                    <select name="q_${i}_correct" class="form-control" style="padding: 6px 12px; font-size: 13px;">
                      <option value="A" ${q.correctAnswer === 'A' ? 'selected' : ''}>Option A</option>
                      <option value="B" ${q.correctAnswer === 'B' ? 'selected' : ''}>Option B</option>
                      <option value="C" ${q.correctAnswer === 'C' ? 'selected' : ''}>Option C</option>
                      <option value="D" ${q.correctAnswer === 'D' ? 'selected' : ''}>Option D</option>
                    </select>
                  </div>
                  <div style="flex: 2;">
                    <label style="font-size: 11px; font-weight: 700;">EXPLANATION</label>
                    <input type="text" name="q_${i}_explanation" class="form-control" style="padding: 6px 12px; font-size: 13px;" placeholder="Why is this correct?" value="${(q.explanation || '').replace(/"/g, '&quot;')}">
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <button type="submit" class="btn btn-primary" style="width:100%; margin-top: 20px;">Save All Changes</button>
      </form>
    `, { title: 'Edit MCQ Bank', width: '700px' });
  },

  async handleEditMCQBank(event, bankId) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const bank = this.banks.find((b) => String(b._id) === String(bankId));
    
    const payload = {
      title: formData.get('title'),
      subject: formData.get('subject'),
      questions: (bank.questions || []).map((q, i) => ({
        ...q,
        questionText: formData.get(`q_${i}_text`),
        correctAnswer: formData.get(`q_${i}_correct`),
        explanation: formData.get(`q_${i}_explanation`)
      }))
    };

    const btn = event.target.querySelector('button[type="submit"]');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }

    try {
      await api.request(`/portal/teacher/mcq-banks/${bankId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      notifications.success('MCQ bank and explanations updated');
      Modal.close();
      await this.loadDashboardData();
      await this.loadMCQBanks();
    } catch (err) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'Save All Changes';
      }
      notifications.error(err.message || 'Failed to update MCQ bank');
    }
  },

  // ─── Materials Management ───────────────────────────────────────────

  async loadMaterials() {
    const body = document.getElementById('materials-table-body');
    if (!body) return;
    Loader.show('materials-table-body', 'Syncing curriculum content...');

    try {
      const response = await api.get('/portal/edu/courses/all/materials');
      const materials = response.data || [];
      
      const filterGrade = document.getElementById('filter-material-grade')?.value;

      let filtered = materials || [];
      if (filterGrade) filtered = filtered.filter(m => m.targetClass === filterGrade);

      filtered.sort((a, b) => (a.targetClass || '').localeCompare(b.targetClass || ''));

      if (filtered.length === 0) {
        body.innerHTML = '<tr><td colspan="5" class="p-dim" style="text-align:center">No materials found.</td></tr>';
        return;
      }

      body.innerHTML = filtered.map(m => `
        <tr>
          <td><strong>${m.title}</strong></td>
          <td style="color:var(--primary); font-weight:600;">${m.subject || 'General'}</td>
          <td>
            <span class="badge" style="background:#f1f5f9; color:#475569; font-size:10px;">${m.targetClass}</span>
          </td>
          <td><span class="badge badge-med">${m.type.toUpperCase()}</span></td>
          <td style="display:flex; gap:8px;">
            <button onclick="TeacherDashboard.viewMaterial('${m._id}', '${m.url}')" class="btn btn-outline" style="padding:4px 8px; color:var(--primary);">View</button>
            <button onclick="TeacherDashboard.deleteMaterial('${m._id}')" class="btn btn-outline" style="color:#ef4444; padding:4px 8px;">Delete</button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      notifications.error('Failed to load materials');
    }
  },

  async viewMaterial(materialId, url) {
    if (url.startsWith('http')) return window.open(url, '_blank');
    try {
      notifications.info('Opening secure material...');
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${auth.getToken()}` }
      });
      if (!res.ok) throw new Error('File access denied');
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } catch (err) {
      notifications.error(err.message);
    }
  },

  showUploadMaterial() {
    if (this.courses.length === 0) return notifications.error('No courses available to upload to.');

    Modal.show('upload-material', `
      <form id="upload-material-form" onsubmit="TeacherDashboard.handleUploadMaterial(event)">
        <div class="form-group">
          <label>Course</label>
          <select name="courseId" class="form-control" required>
            ${this.courses.map(c => `<option value="${c._id}">${c.courseName}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Material Title</label>
          <input type="text" name="title" class="form-control" placeholder="e.g., Mathematics Lecture Notes" required>
        </div>
        <div class="form-group">
          <label>Target Class</label>
          <select name="targetClass" class="form-control" required>
            <option value="All">All Registered Students</option>
            <option value="Class 1">Class 1</option>
            <option value="Class 2">Class 2</option>
            <option value="Class 3">Class 3</option>
            <option value="Class 4">Class 4</option>
            <option value="Class 5">Class 5</option>
            <option value="Class 6">Class 6</option>
            <option value="Class 7">Class 7</option>
            <option value="Class 8">Class 8</option>
            <option value="Class 9">Class 9</option>
            <option value="Class 10">Class 10</option>
            <option value="Class 11">Class 11</option>
            <option value="Class 12">Class 12</option>
            <option value="Class 13">Class 13</option>
            <option value="Class 14">Class 14</option>
            <option value="Class 15">Class 15</option>
          </select>
        </div>
        <div class="form-group">
          <label>Subject</label>
          <select name="subject" class="form-control" required>
            <option value="Mathematics">Mathematics</option>
            <option value="Science">Science</option>
            <option value="English">English</option>
            <option value="Social Studies">Social Studies</option>
            <option value="Physics">Physics</option>
            <option value="Chemistry">Chemistry</option>
            <option value="Biology">Biology</option>
            <option value="History">History</option>
            <option value="Geography">Geography</option>
            <option value="Computer Science">Computer Science</option>
          </select>
        </div>
        <div class="form-group">
          <label>Type</label>
          <select name="type" class="form-control" onchange="TeacherDashboard.toggleMaterialInput(this.value)">
            <option value="link">External Link / Drive</option>
            <option value="pdf">Document (PDF)</option>
            <option value="note">Study Note (Docx/Text)</option>
            <option value="video">Video Link</option>
          </select>
        </div>
        <div class="form-group" id="material-url-group">
          <label>Resource URL</label>
          <input type="url" name="url" class="form-control" placeholder="https://..." required>
        </div>
        <div class="form-group" id="material-file-group" style="display:none;">
          <label>Upload File (PDF / Word)</label>
          <input type="file" name="file" class="form-control" accept=".pdf,.doc,.docx">
        </div>
        <div class="form-group">
          <label>Description (Optional)</label>
          <textarea name="description" class="form-control" rows="2"></textarea>
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%;">Upload & Distribute</button>
      </form>
    `, { title: 'Upload Course Material' });
    
    this.toggleMaterialInput('link');
  },

  toggleMaterialInput(type) {
    const isFile = ['pdf', 'note'].includes(type);
    const fileGroup = document.getElementById('material-file-group');
    const urlGroup = document.getElementById('material-url-group');
    const urlInput = urlGroup?.querySelector('input');
    const fileInput = fileGroup?.querySelector('input');

    if (fileGroup && urlGroup) {
      fileGroup.style.display = isFile ? 'block' : 'none';
      urlGroup.style.display = isFile ? 'none' : 'block';
      
      if (urlInput) urlInput.required = !isFile;
      if (fileInput) fileInput.required = isFile;
    }
  },

  async handleUploadMaterial(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    try {
      const res = await fetch('/api/portal/edu/materials', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${auth.getToken()}`
        },
        body: formData
      }).then(r => r.json());

      if (res.success) {
        notifications.success('Material added and distributed');
        Modal.close();
        this.loadMaterials();
      } else {
        throw new Error(res.message);
      }
    } catch (err) {
      notifications.error('Upload failed: ' + err.message);
    }
  },

  async deleteMaterial(id) {
    if (!confirm('Delete this material?')) return;
    try {
      await api.delete(`/portal/edu/materials/${id}`);
      notifications.success('Material removed');
      this.loadMaterials();
    } catch (err) {
      notifications.error('Failed to delete material');
    }
  },

  // ─── Attendance ─────────────────────────────────────────────────────

  async loadStudentsView() {
    const select = document.getElementById('attendance-session-select');
    const headerDiv = document.querySelector('#view-students header div[style]');
    if (!select) return;

    if (headerDiv && !document.getElementById('btn-manual-att')) {
      headerDiv.insertAdjacentHTML('afterbegin', `
        <button id="btn-manual-att" class="btn btn-outline" onclick="TeacherDashboard.showManualAttendance()">+ Manual Attendance</button>
        <button id="btn-add-student" class="btn btn-primary" onclick="TeacherDashboard.showAddStudentModal()">+ Add New Student</button>
      `);
    }

    if (this.sessions.length === 0) await this.loadDashboardData();
    select.innerHTML = '<option value="">Select Session...</option>' +
      this.sessions.map(s => `<option value="${s._id}">${s.title || s.examId}</option>`).join('');

    // Load master roster
    this.loadStudentRoster();
  },

  async loadStudentRoster() {
    const body = document.getElementById('student-roster-table-body');
    if (!body) return;
    Loader.show('student-roster-table-body', 'Syncing student database...');

    try {
      const { data: students } = await api.get('/portal/teacher/students');
      
      const filterClass = document.getElementById('filter-student-class')?.value;
      const filterBoard = document.getElementById('filter-student-board')?.value;

      let filtered = students || [];
      if (filterClass) filtered = filtered.filter(s => s.classTag === filterClass);
      if (filterBoard) filtered = filtered.filter(s => s.board === filterBoard);

      if (filtered.length === 0) {
        body.innerHTML = '<tr><td colspan="6" class="p-dim" style="text-align:center">No students found matching your filters.</td></tr>';
        return;
      }

      body.innerHTML = filtered.map(s => `
        <tr>
          <td><strong>${s.name}</strong></td>
          <td>${s.email}</td>
          <td><span class="badge badge-med" style="background:rgba(79, 70, 229, 0.1); color:var(--primary);">${s.classTag || 'N/A'}</span></td>
          <td><span class="badge badge-med">${s.board || 'All'}</span></td>
          <td style="font-weight:600; color:var(--primary)">${s.totalAttendance || 0} Sessions</td>
          <td>
            <button onclick="TeacherDashboard.showEditStudentModal('${s._id}')" class="btn btn-outline" style="padding:4px 8px; font-size:11px;">Edit</button>
            <button onclick="TeacherDashboard.handleDeleteStudent('${s._id}')" class="btn btn-outline" style="padding:4px 8px; font-size:11px; color:var(--danger); border-color:rgba(239, 68, 68, 0.2);">Delete</button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      notifications.error('Failed to load roster');
    }
  },

  async showAddStudentModal() {
    if (this.courses.length === 0) await this.loadDashboardData();

    Modal.show('add-student', `
      <form onsubmit="TeacherDashboard.handleAddStudent(event)">
        <div class="form-group">
          <label>Full Name</label>
          <input type="text" name="name" class="form-control" placeholder="e.g. John Doe" required>
        </div>
        <div class="form-group">
          <label>Email Address</label>
          <input type="email" name="email" class="form-control" placeholder="student@example.com" required>
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" name="password" class="form-control" placeholder="Minimal 6 characters" required minlength="6">
        </div>
        <div class="form-group">
          <label>Assign to Course</label>
          <select name="courseId" class="form-control" required>
            ${this.courses.map(c => `<option value="${c._id}">${c.courseName}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Class</label>
          <select name="classTag" class="form-control" required>
            <option value="All">All Registered Students</option>
            <option value="Class 1">Class 1</option>
            <option value="Class 2">Class 2</option>
            <option value="Class 3">Class 3</option>
            <option value="Class 4">Class 4</option>
            <option value="Class 5">Class 5</option>
            <option value="Class 6">Class 6</option>
            <option value="Class 7">Class 7</option>
            <option value="Class 8">Class 8</option>
            <option value="Class 9">Class 9</option>
            <option value="Class 10">Class 10</option>
            <option value="Class 11">Class 11</option>
            <option value="Class 12">Class 12</option>
            <option value="Class 13">Class 13</option>
            <option value="Class 14">Class 14</option>
            <option value="Class 15">Class 15</option>
          </select>
        </div>
        <div class="form-group">
          <label>Educational Board</label>
          <select name="board" class="form-control" required>
            <option value="All">All Boards (Global)</option>
            <option value="CBSE">CBSE</option>
            <option value="ICSE">ICSE</option>
            <option value="State">State Board</option>
            <option value="TestStream">TestStream (Mock)</option>
          </select>
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%;">Create Student Account</button>
      </form>
    `, { title: 'Register New Student' });
  },

  async handleAddStudent(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    try {
      await api.post('/portal/teacher/students', data);
      notifications.success('Student account created successfully');
      Modal.close();
      this.loadStudentRoster();
    } catch (err) {
      notifications.error('Registration failed: ' + err.message);
    }
  },

  async showEditStudentModal(id) {
    try {
      // Need a way to get details. Could fetch all or fetch single.
      // Fetching all for now since it's cached in UI or just fetch fresh.
      const { data: students } = await api.get('/portal/teacher/students');
      const s = students.find(x => x._id === id);
      if (!s) return notifications.error('Student not found');

      if (this.courses.length === 0) await this.loadDashboardData();

      Modal.show('edit-student', `
        <form onsubmit="TeacherDashboard.handleEditStudent(event, '${id}')">
          <div class="form-group">
            <label>Full Name</label>
            <input type="text" name="name" class="form-control" value="${s.name}" required>
          </div>
          <div class="form-group">
            <label>Email Address</label>
            <input type="email" name="email" class="form-control" value="${s.email}" required>
          </div>
          <div class="form-group">
            <label>Assign to Course</label>
            <select name="courseId" class="form-control" required>
              ${this.courses.map(c => `<option value="${c._id}" ${c._id === s.courseId ? 'selected' : ''}>${c.courseName}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Class</label>
            <select name="classTag" class="form-control" required>
              <option value="All" ${s.classTag === 'All' ? 'selected' : ''}>All Registered Students</option>
              <option value="Class 1" ${s.classTag === 'Class 1' ? 'selected' : ''}>Class 1</option>
              <option value="Class 2" ${s.classTag === 'Class 2' ? 'selected' : ''}>Class 2</option>
              <option value="Class 3" ${s.classTag === 'Class 3' ? 'selected' : ''}>Class 3</option>
              <option value="Class 4" ${s.classTag === 'Class 4' ? 'selected' : ''}>Class 4</option>
              <option value="Class 5" ${s.classTag === 'Class 5' ? 'selected' : ''}>Class 5</option>
              <option value="Class 6" ${s.classTag === 'Class 6' ? 'selected' : ''}>Class 6</option>
              <option value="Class 7" ${s.classTag === 'Class 7' ? 'selected' : ''}>Class 7</option>
              <option value="Class 8" ${s.classTag === 'Class 8' ? 'selected' : ''}>Class 8</option>
              <option value="Class 9" ${s.classTag === 'Class 9' ? 'selected' : ''}>Class 9</option>
              <option value="Class 10" ${s.classTag === 'Class 10' ? 'selected' : ''}>Class 10</option>
              <option value="Class 11" ${s.classTag === 'Class 11' ? 'selected' : ''}>Class 11</option>
              <option value="Class 12" ${s.classTag === 'Class 12' ? 'selected' : ''}>Class 12</option>
              <option value="Class 13" ${s.classTag === 'Class 13' ? 'selected' : ''}>Class 13</option>
              <option value="Class 14" ${s.classTag === 'Class 14' ? 'selected' : ''}>Class 14</option>
              <option value="Class 15" ${s.classTag === 'Class 15' ? 'selected' : ''}>Class 15</option>
            </select>
          </div>
          <div class="form-group">
            <label>Educational Board</label>
            <select name="board" class="form-control" required>
              <option value="All" ${!s.board || s.board === 'All' ? 'selected' : ''}>All Boards (Global)</option>
              <option value="CBSE" ${s.board === 'CBSE' ? 'selected' : ''}>CBSE</option>
              <option value="ICSE" ${s.board === 'ICSE' ? 'selected' : ''}>ICSE</option>
              <option value="State" ${s.board === 'State' ? 'selected' : ''}>State Board</option>
              <option value="TestStream" ${s.board === 'TestStream' ? 'selected' : ''}>TestStream (Mock)</option>
            </select>
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%;">Update Student Profile</button>
        </form>
      `, { title: 'Edit Student Profile' });
    } catch (err) {
      notifications.error('Failed to load student details');
    }
  },

  async handleEditStudent(event, id) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    try {
      await api.request(`/portal/teacher/students/${id}`, { method: 'PUT', body: JSON.stringify(data) });
      notifications.success('Student profile updated');
      Modal.close();
      this.loadStudentRoster();
    } catch (err) {
      notifications.error('Update failed: ' + err.message);
    }
  },

  async handleDeleteStudent(id) {
    if (!confirm('Are you sure you want to permanently delete this student? All academic records for this student will be lost.')) return;
    try {
      await api.delete(`/portal/teacher/students/${id}`);
      notifications.success('Student deleted');
      this.loadStudentRoster();
    } catch (err) {
      notifications.error('Delete failed: ' + err.message);
    }
  },

  async showManualAttendance() {
    const sessionId = document.getElementById('attendance-session-select').value;
    if (!sessionId) return notifications.error('Please select a session first');

    try {
      const { data: students } = await api.get('/portal/teacher/students');

      Modal.show('manual-attendance', `
        <form onsubmit="TeacherDashboard.handleManualAttendance(event, '${sessionId}')">
          <div class="form-group">
            <label>Select Student</label>
            <select name="studentId" class="form-control" required>
              ${students.map(s => `<option value="${s._id}">${s.name} (${s.email})</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Status</label>
            <select name="status" class="form-control">
              <option value="present">Present</option>
              <option value="absent">Absent</option>
            </select>
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%;">Mark Attendance</button>
        </form>
      `, { title: 'Manual Attendance Entry' });
    } catch (err) {
      notifications.error('Failed to load students');
    }
  },

  async handleManualAttendance(event, sessionId) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    try {
      await api.post('/portal/edu/attendance', { ...data, sessionId });
      notifications.success('Attendance marked manually');
      Modal.close();
      this.loadAttendance(sessionId);
      this.loadStudentRoster(); // Sync the master roster count
    } catch (err) {
      notifications.error('Failed to mark attendance');
    }
  },

  async loadAttendance(sessionId) {
    if (!sessionId) return;
    const body = document.getElementById('attendance-table-body');
    body.innerHTML = '<tr><td colspan="5" class="p-dim" style="text-align:center">Loading attendance records...</td></tr>';

    try {
      const { data } = await api.get(`/portal/edu/attendance/${sessionId}`);
      const students = data || [];

      if (students.length === 0) {
        body.innerHTML = '<tr><td colspan="5" class="p-dim" style="text-align:center">No students have joined this session yet.</td></tr>';
        return;
      }

      body.innerHTML = students.map(att => `
        <tr>
          <td><strong>${att.studentId?.name || 'Unknown'}</strong></td>
          <td>${att.studentId?.email || '-'}</td>
          <td>
            <span class="status-pill ${att.status === 'present' ? 'status-online' : 'status-offline'}">
              ${att.status.toUpperCase()}
            </span>
          </td>
          <td>${new Date(att.markedAt).toLocaleTimeString()}</td>
          <td style="display:flex; gap:8px;">
            <button onclick="TeacherDashboard.markAttendanceStatus('${sessionId}', '${att.studentId?._id}', 'present')" class="btn btn-outline" style="padding:4px 8px; font-size:11px;">Present</button>
            <button onclick="TeacherDashboard.markAttendanceStatus('${sessionId}', '${att.studentId?._id}', 'absent')" class="btn btn-outline" style="padding:4px 8px; font-size:11px;">Absent</button>
            <button onclick="TeacherDashboard.deleteAttendanceRecord('${att._id}', '${sessionId}')" class="btn btn-outline" style="padding:4px 8px; font-size:11px; color:#ef4444;"><i class="fas fa-trash"></i></button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      notifications.error('Failed to load attendance');
    }
  },

  async markAttendanceStatus(sessionId, studentId, status) {
    try {
      await api.post('/portal/edu/attendance', { sessionId, studentId, status });
      notifications.success(`Status updated to ${status}`);
      this.loadAttendance(sessionId);
      this.loadStudentRoster(); // Sync the master roster count
    } catch (err) {
      notifications.error('Failed to update status');
    }
  },

  async deleteAttendanceRecord(id, sessionId) {
    if (!confirm('Remove this attendance record?')) return;
    try {
      await api.delete(`/portal/edu/attendance/${id}`);
      notifications.success('Record removed');
      this.loadAttendance(sessionId);
    } catch (err) {
      notifications.error('Failed to delete record');
    }
  },

  loadForum() {
    const container = document.getElementById('teacher-forum-container');
    container.innerHTML = `
      <div class="glass-card" style="margin-bottom:24px;">
        <h3 class="h3">Forum Management</h3>
        <p class="p-dim">Teachers can monitor discussions and guide student queries.</p>
      </div>
      <div id="forum-content-mount"></div>
    `;
    const mount = document.getElementById('forum-content-mount');
    this.loadForumThreads(mount);
  },

  async loadForumThreads(container) {
    try {
      const res = await api.get('/portal/edu/forum/threads');
      const threads = res.data || [];
      if (threads.length === 0) {
        container.innerHTML = '<div class="glass-card" style="text-align:center; padding: 40px;"><p class="p-dim">No forum discussions available yet.</p></div>';
        return;
      }
      container.innerHTML = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 24px;">' +
        threads.map(t => `
        <div class="glass-card animate-slide-up" style="cursor: pointer;">
          <h4 class="h3" style="font-size:16px; margin-bottom: 8px;">${t.title}</h4>
          <p class="p-dim" style="margin-bottom: 16px;">${(t.content || '').substring(0, 100)}...</p>
          <div style="font-size: 12px; color: var(--primary); font-weight: 600;">
             By: ${t.authorId ? t.authorId.name : 'Student'} • ${new Date(t.createdAt).toLocaleDateString()}
          </div>
        </div>
      `).join('') + '</div>';
    } catch (e) {
      container.innerHTML = '<p class="p-dim" style="color:var(--danger)">Failed to load forum threads.</p>';
    }
  },

  navigateToView(viewId) {
    const url = new URL(window.location);
    url.searchParams.set('view', viewId);
    url.searchParams.delete('sessionId');
    window.history.pushState({}, '', url);
    this.init();
  },

  async showBroadcastModal() {
    if (this.courses.length === 0) return notifications.error('No courses available to broadcast to.');

    Modal.show('announcement', `
      <div class="form-group">
        <label>Course</label>
        <select id="ann-courseId" class="form-control">
          ${this.courses.map(c => `<option value="${c._id}">${c.courseName}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Announcement Title</label>
        <input type="text" id="ann-title" class="form-control" placeholder="Flash: Important update">
      </div>
      <div class="form-group">
        <label>Message Content</label>
        <textarea id="ann-content" class="form-control" rows="4"></textarea>
      </div>
      <button onclick="TeacherDashboard.sendAnnouncement()" class="btn btn-primary" style="width:100%;">Broadcast to Students</button>
    `, { title: 'Broadcast Announcement' });
  },

  async sendAnnouncement() {
    const courseId = document.getElementById('ann-courseId').value;
    const title = document.getElementById('ann-title').value;
    const content = document.getElementById('ann-content').value;
    if (!courseId || !title || !content) {
      return notifications.error('Please fill in all fields before broadcasting');
    }

    try {
      // Emit via socket for real-time
      if (window.TeacherSocket && TeacherSocket.socket) {
        TeacherSocket.socket.emit('broadcast-announcement', { title, content, courseId });
      }
      // Save to DB
      await api.post('/portal/edu/announcements', { courseId, title, content });
      notifications.success('Announcement broadcasted');
      Modal.close();
    } catch (err) {
      notifications.error('Failed to send announcement');
    }
  },

  bindSidebarNav() {
    document.querySelectorAll('.sidebar .nav-item[data-action]').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        const viewMap = {
          'overview': 'dashboard',
          'courses': 'materials',
          'students': 'students',
          'forum': 'forum',
          'analytics': 'analytics-all'
        };
        const viewId = viewMap[action] || 'dashboard';

        const url = new URL(window.location);
        url.searchParams.set('view', viewId);
        url.searchParams.delete('sessionId');
        window.history.pushState({}, '', url);
        this.init();
      });
    });
  },

  highlightSidebar(viewName) {
    document.querySelectorAll('.sidebar .nav-item').forEach(n => n.classList.remove('active'));

    const mapping = {
      'dashboard': 'overview',
      'materials': 'courses',
      'students': 'students',
      'timetable': 'timetable',
      'forum': 'forum',
      'analytics-all': 'analytics',
      'analytics': 'analytics'
    };

    const action = mapping[viewName] || 'overview';
    const navItem = document.querySelector(`.sidebar .nav-item[data-action="${action}"]`);
    if (navItem) navItem.classList.add('active');
  },

  // ─── Timetable Management ────────────────────────────────────────────────

  async loadTimetable() {
    const body = document.getElementById('timetable-list');
    if (!body) return;
    Loader.show('timetable-list', 'Syncing timetable...');

    try {
      const { data } = await api.get('/portal/teacher/timetable');
      if (!data || data.length === 0) {
        body.innerHTML = '<tr><td colspan="6" class="p-dim" style="text-align:center">No scheduled classes found.</td></tr>';
        return;
      }

      body.innerHTML = data.map(entry => `
        <tr>
          <td><strong>${entry.day}</strong></td>
          <td>${entry.time}</td>
          <td style="color:var(--primary); font-weight:600;">${entry.title}</td>
          <td><span class="badge" style="background:rgba(79, 70, 229, 0.1); color:var(--primary); font-size:10px;">${entry.targetClass}</span></td>
          <td>
            <button onclick="TeacherDashboard.deleteTimetableEntry('${entry._id}')" class="btn btn-outline btn-sm" style="color:var(--danger); border-color:rgba(239, 68, 68, 0.2);"><i class="fas fa-trash"></i></button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      notifications.error('Failed to load timetable');
    }
  },

  showAddTimetableModal() {
    Modal.show('add-timetable', `
      <form onsubmit="TeacherDashboard.handleCreateTimetable(event)">
        <div class="form-group">
          <label>Day of Week</label>
          <select name="day" class="form-control" required>
            <option value="Monday">Monday</option>
            <option value="Tuesday">Tuesday</option>
            <option value="Wednesday">Wednesday</option>
            <option value="Thursday">Thursday</option>
            <option value="Friday">Friday</option>
            <option value="Saturday">Saturday</option>
          </select>
        </div>
        <div class="form-group">
          <label>Time (e.g., 09:00 AM - 10:30 AM)</label>
          <input type="text" name="time" class="form-control" placeholder="09:00 AM" required>
        </div>
        <div class="form-group">
          <label>Subject / Class Title</label>
          <input type="text" name="title" class="form-control" placeholder="e.g. Surgical Rounds" required>
        </div>
        <div class="form-group">
          <label>Target Class</label>
          <select name="targetClass" class="form-control" required>
            <option value="All">All Registered Students</option>
            <option value="Class 1">Class 1</option>
            <option value="Class 2">Class 2</option>
            <option value="Class 3">Class 3</option>
            <option value="Class 4">Class 4</option>
            <option value="Class 5">Class 5</option>
            <option value="Class 6">Class 6</option>
            <option value="Class 7">Class 7</option>
            <option value="Class 8">Class 8</option>
            <option value="Class 9">Class 9</option>
            <option value="Class 10">Class 10</option>
            <option value="Class 11">Class 11</option>
            <option value="Class 12">Class 12</option>
            <option value="Class 13">Class 13</option>
            <option value="Class 14">Class 14</option>
            <option value="Class 15">Class 15</option>
          </select>
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%;">Add to Schedule</button>
      </form>
    `, { title: 'Add Class Schedule' });
  },

  async handleCreateTimetable(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());

    try {
      await api.post('/portal/teacher/timetable', data);
      notifications.success('Schedule added successfully');
      Modal.close();
      this.loadTimetable();
    } catch (err) {
      notifications.error('Failed to add schedule: ' + err.message);
    }
  },

  async deleteTimetableEntry(id) {
    if (!confirm('Are you sure you want to remove this scheduled class?')) return;
    try {
      await api.delete(`/portal/teacher/timetable/${id}`);
      notifications.success('Schedule removed');
      this.loadTimetable();
    } catch (err) {
      notifications.error('Failed to remove schedule');
    }
  }
};

document.addEventListener('DOMContentLoaded', () => TeacherDashboard.init());
window.TeacherDashboard = TeacherDashboard;
