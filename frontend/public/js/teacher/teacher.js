/**
 * js/teacher/teacher.js
 * Teacher Dashboard Controller
 */

const TeacherDashboard = {
  courses: [],
  banks: [],
  sessions: [],
  currentBoardFolder: null,
  async init() {
    if (!auth.checkAuth()) return;

    // Handle one-time setup
    if (!this._bound) {
      this._bound = true;
      this.bindSidebarNav();
      window.addEventListener('popstate', () => this.init());

      // "Start Fresh" & "Disable Back/Forward" Logic
      // We use replaceState only to ensure history.length stays at 1.
      const url = new URL(window.location);
      if (!url.searchParams.has('view')) {
        url.searchParams.set('view', 'dashboard');
      }
      window.history.replaceState({ view: url.searchParams.get('view') }, '', url);
    }

    if (this._pollingInterval) clearInterval(this._pollingInterval);

    // Set teacher name in welcome header and sidebar
    const user = auth.getUser();
    if (user && user.name) {
      const nameEl = document.getElementById('teacher-name');
      const sidebarNameEl = document.getElementById('sidebar-name');
      const avatarEl = document.getElementById('sidebar-avatar');
      
      const firstName = user.name.split(' ')[0];
      const initials = user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      
      if (nameEl) nameEl.textContent = user.name;
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
    this.currentBoardFolder = null; // Reset folder view on tab switch
    this._forceBankRender = true; // Force render when switching back to materials
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
    this.sessionsPage = 1;
    this.renderSessions(null, 1); // Re-render with cached sessions
  },

  renderSessions(sessions, page = null) {
    if (sessions) this.sessions = sessions;
    if (page !== null) {
      this.sessionsPage = page;
    } else if (!this.sessionsPage) {
      this.sessionsPage = 1;
    }

    const list = document.getElementById('recent-sessions');
    const boardFilterEl = document.getElementById('filter-session-board');
    const paginationContainer = document.getElementById('recent-sessions-pagination');
    
    // Ensure the dropdown matches our state (useful when polling refreshes the data)
    if (boardFilterEl && this.lastSelectedBoard) {
      boardFilterEl.value = this.lastSelectedBoard;
    }
    
    const selectedBoard = this.lastSelectedBoard || 'All';

    let filteredSessions = this.sessions || [];
    if (selectedBoard && selectedBoard !== 'All') {
      const targetBoard = selectedBoard.toLowerCase().trim();
      filteredSessions = filteredSessions.filter(s => {
        if (!s.board) return false; // Hide unassigned sessions when a specific board is selected
        const sessionBoard = s.board.toLowerCase().trim();
        // Support partial matches in case "State Board" is stored as "State"
        return sessionBoard === targetBoard || sessionBoard.includes(targetBoard) || targetBoard.includes(sessionBoard);
      });
    }

    if (filteredSessions.length === 0) {
      list.innerHTML = '<tr><td colspan="5" class="p-dim" style="text-align:center">No sessions found</td></tr>';
      if (paginationContainer) paginationContainer.innerHTML = '';
      return;
    }

    const itemsPerPage = 5;
    const totalPages = Math.ceil(filteredSessions.length / itemsPerPage);
    if (this.sessionsPage > totalPages) this.sessionsPage = totalPages;
    const p = this.sessionsPage;

    const paginated = filteredSessions.slice((p - 1) * itemsPerPage, p * itemsPerPage);

    list.innerHTML = paginated.map(s => `
      <tr>
        <td style="white-space: nowrap;">
          <strong>${s.title || s.examId}</strong>
          ${s.board && s.board !== 'All' ? `<span class="badge" style="margin-left:8px; font-size:10px; background:rgba(79, 70, 229, 0.1); color:var(--primary);">${s.board}</span>` : ''}
        </td>
        <td>${utils.formatDateTimeRange(s.scheduledStart || s.startTime, s.duration)}</td>
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

    if (paginationContainer) {
      this.renderSquarePagination('recent-sessions-pagination', p, totalPages, 'TeacherDashboard.renderSessions(null, ');
    }
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

  renderResults(results, page = null) {
    if (results) this.results = results;
    if (page !== null) {
      this.resultsPage = page;
    } else if (!this.resultsPage) {
      this.resultsPage = 1;
    }

    const list = document.getElementById('recent-results');
    const paginationContainer = document.getElementById('recent-results-pagination');
    const allResults = this.results || [];

    if (allResults.length === 0) {
      list.innerHTML = '<tr><td colspan="4" class="p-dim" style="text-align:center">No submissions yet</td></tr>';
      if (paginationContainer) paginationContainer.innerHTML = '';
      return;
    }

    const itemsPerPage = 5;
    const totalPages = Math.ceil(allResults.length / itemsPerPage);
    if (this.resultsPage > totalPages) this.resultsPage = totalPages;
    const p = this.resultsPage;

    const paginated = allResults.slice((p - 1) * itemsPerPage, p * itemsPerPage);

    list.innerHTML = paginated.map(r => `
      <tr>
        <td><strong>${r.studentName}</strong></td>
        <td>${r.examTitle}</td>
        <td style="font-weight:700; color:${r.score >= 50 ? 'var(--success)' : 'var(--danger)'}">${r.score}%</td>
        <td>${utils.formatDate(r.submittedAt)}</td>
      </tr>
    `).join('');

    if (paginationContainer) {
      this.renderSquarePagination('recent-results-pagination', p, totalPages, 'TeacherDashboard.renderResults(null, ');
    }
  },

  renderSquarePagination(containerId, current, total, prefix) {
    const container = document.getElementById(containerId);
    if (!container) return;
    let html = `<div class="sq-pagination">`;
    html += `<button class="sq-nav-btn" ${current === 1 ? 'disabled' : ''} onclick="${prefix}${current - 1})"><i class="fas fa-chevron-left"></i></button>`;
    
    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || (i >= current - 1 && i <= current + 1)) {
        html += `<button class="sq-num-btn ${i === current ? 'active' : ''}" onclick="${prefix}${i})">${i}</button>`;
      } else if (i === current - 2 || i === current + 2) {
        html += `<span class="sq-num-btn" style="cursor:default">...</span>`;
      }
    }
    
    // Remove duplicate ellipsis if any
    html = html.replace(/<span class="sq-num-btn" style="cursor:default">\.\.\.<\/span><span class="sq-num-btn" style="cursor:default">\.\.\.<\/span>/g, '<span class="sq-num-btn" style="cursor:default">...</span>');

    html += `<button class="sq-nav-btn" ${current === total ? 'disabled' : ''} onclick="${prefix}${current + 1})"><i class="fas fa-chevron-right"></i></button>`;
    html += `</div>`;
    
    container.innerHTML = html;
  },

  async loadMCQBanks() {
    const container = document.getElementById('mcq-banks-grid');
    if (!container) return;
    
    // Only show loader on initial load to prevent UI flickering during polling
    if (this.banks.length === 0 && !this.currentBoardFolder && !this._lastBanksHash) {
      Loader.show('mcq-banks-grid', 'Syncing MCQ Repositories...');
    }

    try {
      const { data } = await api.get('/portal/teacher/mcq-banks');
      
      const newHash = JSON.stringify(data || []);
      if (this._lastBanksHash === newHash && !this._forceBankRender) {
         this.banks = data || [];
         return; 
      }
      this._lastBanksHash = newHash;
      this._forceBankRender = false;

      this.banks = data || [];

      if (data.length === 0) {
        container.innerHTML = '<p class="p-dim" style="grid-column: 1/-1; text-align: center; padding: 40px;">No MCQ banks found. Upload a PDF/DOCX to get started.</p>';
        return;
      }

      const groupedBanks = data.reduce((acc, bank) => {
        const board = bank.board || 'Uncategorized';
        if (!acc[board]) acc[board] = [];
        acc[board].push(bank);
        return acc;
      }, {});

      if (!this.currentBoardFolder) {
        // Render Folders
        container.innerHTML = Object.keys(groupedBanks).sort().map(board => `
          <div class="mcq-bank-card animate-slide-up" style="cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; text-align: center; border: 2px dashed #cbd5e1; background: #f8fafc;" onclick="TeacherDashboard.openBoardFolder('${board}')">
            <i class="fas fa-folder" style="font-size: 56px; color: var(--primary); margin-bottom: 16px;"></i>
            <h3 style="font-size: 18px; font-weight: 800; color: #1e293b; margin-bottom: 8px;">${board === 'All' || board === 'Uncategorized' ? 'Global / Cross-Board' : board + ' Board'}</h3>
            <span style="background: var(--primary-soft); color: var(--primary); font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 20px; display: inline-block;">
              ${groupedBanks[board].length} Bank${groupedBanks[board].length > 1 ? 's' : ''}
            </span>
          </div>
        `).join('');
      } else {
        // Render Banks inside the Folder
        const board = this.currentBoardFolder;
        const banks = groupedBanks[board] || [];
        
        let html = `
          <div style="grid-column: 1/-1; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #f1f5f9; padding-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 16px;">
              <button class="btn btn-secondary btn-sm" style="border-radius: 12px; padding: 8px 16px; display: flex; align-items: center; gap: 8px;" onclick="TeacherDashboard.closeBoardFolder()">
                <i class="fas fa-arrow-left"></i> Back
              </button>
              <h3 style="font-size: 20px; font-weight: 800; color: #1e293b; margin: 0; display: flex; align-items: center;">
                <i class="fas fa-folder-open" style="color: var(--primary); margin-right: 12px; font-size: 24px;"></i>
                ${board === 'All' || board === 'Uncategorized' ? 'Global / Cross-Board' : board + ' Board'}
              </h3>
            </div>
            <span style="background: var(--primary-soft); color: var(--primary); font-size: 13px; font-weight: 700; padding: 6px 16px; border-radius: 20px;">
              ${banks.length} Exam${banks.length > 1 ? 's' : ''}
            </span>
          </div>
        `;

        html += banks.map(bank => `
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

        container.innerHTML = html;
      }
    } catch (err) {
      console.error(err);
      container.innerHTML = `<p class="p-dim" style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--danger);">Failed to load repositories: ${err.message || err}</p>`;
    }
  },

  openBoardFolder(board) {
    this.currentBoardFolder = board;
    this._forceBankRender = true;
    this.loadMCQBanks();
  },

  closeBoardFolder() {
    this.currentBoardFolder = null;
    this._forceBankRender = true;
    this.loadMCQBanks();
  },

  async loadAllAnalytics() {
    try {
      const { data } = await api.get('/portal/teacher/results/general-analytics');

      const container = document.getElementById('global-analytics-stats');
      container.innerHTML = `
        <div class="glass-card metric-card" style="color: var(--primary-indigo); flex: 1;">
          <i class="fas fa-users" style="font-size: 20px; margin-bottom: 12px; opacity: 0.8;"></i>
          <span class="metric-label">Total Submissions</span>
          <div class="metric-value">${data.totalSubmissions}</div>
          <p style="font-size: 11px; color: var(--text-muted); font-weight: 500;">Across all active sessions</p>
        </div>
        <div class="glass-card metric-card" style="color: var(--accent-cyan); flex: 1;">
          <i class="fas fa-chart-line" style="font-size: 20px; margin-bottom: 12px; opacity: 0.8;"></i>
          <span class="metric-label">Average Score</span>
          <div class="metric-value">${data.avgScore}%</div>
          <p style="font-size: 11px; color: var(--text-muted); font-weight: 500;">Global academic mean</p>
        </div>
        <div class="glass-card metric-card" style="color: var(--success); flex: 1;">
          <i class="fas fa-award" style="font-size: 20px; margin-bottom: 12px; opacity: 0.8;"></i>
          <span class="metric-label">Overall Pass Rate</span>
          <div class="metric-value" style="color: var(--success)">${data.passRate}%</div>
          <p style="font-size: 11px; color: var(--text-muted); font-weight: 500;">Students meeting threshold</p>
        </div>
      `;

      if (typeof Charts !== 'undefined') {
        Charts.renderGrades('global-grade-chart', data.gradeBreakdown, true);
      }

      if (data.sessions) {
        this._globalAnalyticsSessions = data.sessions;
        this.renderAnalyticsExamsPage(1);
      }
    } catch (err) {
      notifications.error('Failed to load global analytics: ' + err.message);
    }
  },

  renderAnalyticsExamsPage(page) {
    const listContainer = document.getElementById('global-exams-list-container');
    if (!listContainer || !this._globalAnalyticsSessions) return;
    
    this._globalAnalyticsPage = page;
    const sessions = this._globalAnalyticsSessions;
    const itemsPerPage = 5;
    const totalPages = Math.ceil(sessions.length / itemsPerPage) || 1;
    const startIdx = (page - 1) * itemsPerPage;
    const paginatedSessions = sessions.slice(startIdx, startIdx + itemsPerPage);

    const formatTime = (s) => {
      const m = Math.floor(s / 60);
      const sec = s % 60;
      return `${m}m ${sec}s`;
    };

    listContainer.innerHTML = `
      ${paginatedSessions.length === 0 ? '<p class="p-dim">No session data available.</p>' : ''}
      ${paginatedSessions.map((session) => {
        const normalized = Analytics.normalizePayload({ results: session.results, sessionTitle: session.title });
        const stats = normalized.stats;
        const results = normalized.results;
        const passRate = stats.total > 0 ? ((stats.passed / stats.total) * 100).toFixed(1) : '0.0';

        return `
          <div class="glass-card" id="report-card-${session._id}" style="margin-bottom: 48px; padding: 40px;">
            <div class="session-header-flex" style="margin-bottom: 40px;">
              <div>
                <h3 class="h3" style="font-size: 1.5rem; margin-bottom: 8px; color: #1e293b;">${normalized.sessionTitle}</h3>
                <div style="display: flex; gap: 16px; align-items: center;">
                  <span class="status-pill status-success" style="padding: 4px 12px; font-size: 11px;">Completed</span>
                  <p class="p-dim" style="font-size: 13px; font-weight: 500;">
                    <i class="far fa-user-circle"></i> ${stats.total} Total Submissions
                  </p>
                </div>
              </div>
              <div class="session-actions-flex">
                <button class="btn btn-outline" style="font-size: 12px; padding: 8px 16px; border-color: #10b981; color: #10b981;" onclick="TeacherDashboard.exportToExcel('${session._id}')">
                  <i class="fas fa-file-excel"></i> Export Excel
                </button>
                <button class="btn btn-outline" style="font-size: 12px; padding: 8px 16px;" onclick="TeacherDashboard.exportToPDF('${session._id}')">
                  <i class="fas fa-file-pdf"></i> Export PDF
                </button>
              </div>
            </div>
            
            <div class="session-report-grid">
              <!-- Left: Session Metrics (Vertical) -->
              <div style="display: flex; flex-direction: column; gap: 12px;">
                <div class="glass-card metric-card" style="padding: 16px; border: 1px solid rgba(16,185,129,0.1); background: rgba(16,185,129,0.02); flex: 1;">
                  <p class="p-dim" style="font-size:10px; font-weight:700; text-transform:uppercase; margin-bottom: 4px;">Pass Rate</p>
                  <div class="metric-value" style="font-size:22px; color: #10b981; margin:0;">${passRate}%</div>
                </div>
                <div class="glass-card metric-card" style="padding: 16px; border: 1px solid rgba(59,130,246,0.1); background: rgba(59,130,246,0.02); flex: 1;">
                  <p class="p-dim" style="font-size:10px; font-weight:700; text-transform:uppercase; margin-bottom: 4px;">Avg Score</p>
                  <div class="metric-value" style="font-size:22px; color: #3b82f6; margin:0;">${stats.avgPercent || 0}%</div>
                </div>
                <div class="glass-card metric-card" style="padding: 16px; border: 1px solid rgba(16,185,129,0.1); background: rgba(16,185,129,0.02); flex: 1;">
                  <p class="p-dim" style="font-size:10px; font-weight:700; text-transform:uppercase; margin-bottom: 4px;">High Score</p>
                  <div class="metric-value" style="font-size:22px; color: #10b981; margin:0;">${stats.highScore || 0}%</div>
                </div>
                <div class="glass-card metric-card" style="padding: 16px; border: 1px solid rgba(239,68,68,0.1); background: rgba(239,68,68,0.02); flex: 1;">
                  <p class="p-dim" style="font-size:10px; font-weight:700; text-transform:uppercase; margin-bottom: 4px;">Low Score</p>
                  <div class="metric-value" style="font-size:22px; color: #ef4444; margin:0;">${stats.lowScore || 0}%</div>
                </div>
              </div>

              <!-- Right: Session Grade Distribution -->
              <div style="background: rgba(0,0,0,0.01); padding: 24px; border-radius: 16px; border: 1px solid rgba(0,0,0,0.03); height: 100%; display: flex; flex-direction: column;">
                <div class="flex-between" style="margin-bottom: 20px;">
                  <h4 style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Grade Distribution</h4>
                  <span style="font-size: 10px; color: var(--text-muted); opacity: 0.6;">Session Analysis</span>
                </div>
                <div class="chart-container" style="flex: 1; min-height: 200px; position: relative;">
                  <canvas id="chart-${session._id}"></canvas>
                </div>
              </div>
            </div>

            ${results.length === 0 ? `
              <div style="padding: 20px; text-align: center; background: rgba(0,0,0,0.02); border-radius: 10px;">
                <p class="p-dim" style="font-size:13px">No student submissions yet.</p>
              </div>
            ` : `
              <div class="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Student</th>
                      <th>Score</th>
                      <th>Correct</th>
                      <th>Time</th>
                      <th>Violations</th>
                      <th>Grade</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${results.map((r, i) => `
                      <tr>
                        <td>${i + 1}</td>
                        <td>
                          <div style="font-weight:600">${r.studentName}</div>
                          <div class="p-dim" style="font-size:11px">${r.studentEmail}</div>
                        </td>
                        <td style="font-weight:700; color:${r.isPassed ? 'var(--success)' : 'var(--danger)'}">${r.score}%</td>
                        <td>${r.correctCount}/${r.totalQuestions}</td>
                        <td>${formatTime(r.timeTaken)}</td>
                        <td>
                          ${r.violations > 0
                            ? `<span class="status-pill status-warning" style="cursor:help" 
                                    title="${(r.violationHistory || []).map(v => `${v.violationType || v.type || 'Violation'}: ${v.detail || ''}`).join('\n')}">
                                 ⚠️ ${r.violations}
                               </span>`
                            : '<span class="p-dim">0</span>'}
                        </td>
                        <td><strong>${r.grade}</strong></td>
                        <td>
                          <span class="status-pill ${r.isPassed ? 'status-online' : 'status-offline'}">
                            ${r.isPassed ? 'PASSED' : 'FAILED'}
                          </span>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>
        `;
      }).join('')}
      
      ${totalPages > 1 ? `
        <div class="pagination-wrapper">
          <div class="pagination-pill">
            <button class="page-btn text-btn" ${page === 1 ? 'disabled' : ''} onclick="TeacherDashboard.renderAnalyticsExamsPage(${page - 1})">&larr; Prev</button>
            ${(() => {
              let html = '';
              const showEllipsis = totalPages > 5;
              
              if (!showEllipsis) {
                // Show all pages if <= 5
                for(let i=1; i<=totalPages; i++) {
                  html += `<button class="page-btn num-btn ${i === page ? 'active' : ''}" onclick="TeacherDashboard.renderAnalyticsExamsPage(${i})">${i}</button>`;
                }
              } else {
                // Handle pagination with ellipsis based on reference image pattern
                // 1 2 3 ... 11
                if (page <= 3) {
                  for(let i=1; i<=3; i++) {
                    html += `<button class="page-btn num-btn ${i === page ? 'active' : ''}" onclick="TeacherDashboard.renderAnalyticsExamsPage(${i})">${i}</button>`;
                  }
                  html += `<span class="page-btn num-btn ellipsis">...</span>`;
                  html += `<button class="page-btn num-btn" onclick="TeacherDashboard.renderAnalyticsExamsPage(${totalPages})">${totalPages}</button>`;
                } else if (page >= totalPages - 2) {
                  html += `<button class="page-btn num-btn" onclick="TeacherDashboard.renderAnalyticsExamsPage(1)">1</button>`;
                  html += `<span class="page-btn num-btn ellipsis">...</span>`;
                  for(let i=totalPages-2; i<=totalPages; i++) {
                    html += `<button class="page-btn num-btn ${i === page ? 'active' : ''}" onclick="TeacherDashboard.renderAnalyticsExamsPage(${i})">${i}</button>`;
                  }
                } else {
                  html += `<button class="page-btn num-btn" onclick="TeacherDashboard.renderAnalyticsExamsPage(1)">1</button>`;
                  html += `<span class="page-btn num-btn ellipsis">...</span>`;
                  html += `<button class="page-btn num-btn active" onclick="TeacherDashboard.renderAnalyticsExamsPage(${page})">${page}</button>`;
                  html += `<span class="page-btn num-btn ellipsis">...</span>`;
                  html += `<button class="page-btn num-btn" onclick="TeacherDashboard.renderAnalyticsExamsPage(${totalPages})">${totalPages}</button>`;
                }
              }
              return html;
            })()}
            <button class="page-btn text-btn" ${page === totalPages ? 'disabled' : ''} onclick="TeacherDashboard.renderAnalyticsExamsPage(${page + 1})">Next &rarr;</button>
          </div>
        </div>
      ` : ''}
    `;

    // Render all individual exam charts
    setTimeout(() => {
      paginatedSessions.forEach((session) => {
        const normalized = Analytics.normalizePayload({ results: session.results, sessionTitle: session.title });
        if (typeof Charts !== 'undefined') {
          Charts.renderGrades(`chart-${session._id}`, normalized.stats.gradeBreakdown, true);
        }
      });
      const viewContainer = document.getElementById('view-analytics-all');
      if (viewContainer) viewContainer.scrollTo({ top: 0, behavior: 'smooth' });
      const mainContent = document.querySelector('.main-content');
      if (mainContent) mainContent.scrollTo({ top: 0, behavior: 'smooth' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  },

  exportToPDF(sessionId) {
    const card = document.getElementById(`report-card-${sessionId}`);
    if (!card) return;
    
    const titleEl = card.querySelector('h3');
    const sessionTitle = titleEl ? titleEl.innerText : 'analytics';
    
    // Temporarily hide the export button
    const btn = card.querySelector('.btn-outline');
    if (btn) btn.style.display = 'none';

    // Workaround for html2canvas rendering empty PDFs:
    // 1. Disable backdrop-filter (known to break html2canvas completely)
    // 2. Set a solid background
    const originalBackground = card.style.background;
    const originalBackdrop = card.style.backdropFilter;
    const originalWebkitBackdrop = card.style.webkitBackdropFilter;
    
    card.style.background = '#ffffff';
    card.style.backdropFilter = 'none';
    card.style.webkitBackdropFilter = 'none';

    // Set up html2pdf options
    const opt = {
      margin:       0.4,
      filename:     `${sessionTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_report.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { 
        scale: 2, 
        useCORS: true,
        scrollY: 0 // Helps if the element is in a scrolled container
      },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'landscape' }
    };

    // Generate PDF
    if (typeof html2pdf !== 'undefined') {
      html2pdf().set(opt).from(card).save().then(() => {
        // Restore original styles
        if (btn) btn.style.display = '';
        card.style.background = originalBackground;
        card.style.backdropFilter = originalBackdrop;
        card.style.webkitBackdropFilter = originalWebkitBackdrop;
      });
    } else {
      if (typeof notifications !== 'undefined') {
        notifications.error("PDF engine not loaded yet. Please wait a moment and try again.");
      }
      if (btn) btn.style.display = '';
      card.style.background = originalBackground;
      card.style.backdropFilter = originalBackdrop;
      card.style.webkitBackdropFilter = originalWebkitBackdrop;
    }
  },

  exportToExcel(sessionId) {
    const session = this._globalAnalyticsSessions.find(s => String(s._id) === String(sessionId));
    if (!session) return;
    
    const normalized = Analytics.normalizePayload({ results: session.results, sessionTitle: session.title });
    const results = normalized.results;
    
    const headers = ['Student Name', 'Student Email', 'Score (%)', 'Correct', 'Time Taken (s)', 'Violations', 'Grade', 'Status'];
    const rows = results.map(r => [
      `"${(r.studentName || '').replace(/"/g, '""')}"`,
      `"${(r.studentEmail || '').replace(/"/g, '""')}"`,
      r.score,
      `="${r.correctCount}/${r.totalQuestions}"`,
      r.timeTaken,
      r.violations,
      `"${r.grade || ''}"`,
      `"${r.isPassed ? 'PASSED' : 'FAILED'}"`
    ]);
    
    const csvContent = headers.join(',') + '\n' + rows.map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${normalized.sessionTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_report.csv`);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

              <div style="font-size: 18px; font-weight: 600; color: #1e293b; margin-bottom: 24px; line-height: 1.6;">
                ${q.questionText && q.questionText.trim() ? q.questionText : `<span style="color: #94a3b8; font-style: italic;">Question text unavailable</span>`}
              </div>
              
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
                    background: ${(q.correctAnswer || '').split(',').map(s => s.trim()).includes(opt.label) ? 'var(--success-soft)' : '#f8fafc'}; 
                    border: 1px solid ${(q.correctAnswer || '').split(',').map(s => s.trim()).includes(opt.label) ? 'rgba(16, 185, 129, 0.3)' : '#f1f5f9'}; 
                    border-radius: 14px;
                  ">
                    <span style="
                      width: 32px; 
                      height: 32px; 
                      background: ${(q.correctAnswer || '').split(',').map(s => s.trim()).includes(opt.label) ? 'var(--success)' : '#fff'}; 
                      color: ${(q.correctAnswer || '').split(',').map(s => s.trim()).includes(opt.label) ? '#fff' : '#64748b'}; 
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
                      <div style="font-size: 15px; font-weight: 500; color: ${(q.correctAnswer || '').split(',').map(s => s.trim()).includes(opt.label) ? '#065f46' : '#334155'}; line-height: 1.5; word-break: break-word;">
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
                    <div style="display: flex; gap: 8px; align-items: center; padding: 6px 0;">
                      ${['A','B','C','D'].map(opt => `
                        <label style="display:flex; align-items:center; gap:4px; font-size:12px; cursor:pointer;">
                          <input type="checkbox" name="q_${i}_correct" value="${opt}" ${q.correctAnswer && q.correctAnswer.includes(opt) ? 'checked' : ''}> ${opt}
                        </label>
                      `).join('')}
                    </div>
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
        correctAnswer: formData.getAll(`q_${i}_correct`).join(','),
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
      <div style="position: relative; padding: 10px;">
        <!-- Custom Header inside content -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px;">
          <div>
            <h2 style="font-size: 24px; font-weight: 800; color: var(--primary-indigo); letter-spacing: -0.5px; margin: 0;">Upload Course Material</h2>
            <p class="p-dim" style="font-size: 13px; margin-top: 4px;">Share educational resources, documents, or links with your students.</p>
          </div>
          <button onclick="Modal.close()" style="background: #f1f5f9; border: none; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #64748b; transition: all 0.2s;">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <form id="upload-material-form" onsubmit="TeacherDashboard.handleUploadMaterial(event)" style="display: flex; flex-direction: column; gap: 24px;">
          <!-- Primary Info Grid -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div class="form-group">
              <label style="display: block; font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.05em;">Source Course</label>
              <select name="courseId" class="form-control" style="width: 100%; height: 44px;" required>
                ${this.courses.map(c => `<option value="${c._id}">${c.courseName}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label style="display: block; font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.05em;">Material Title</label>
              <input type="text" name="title" class="form-control" placeholder="e.g. Mathematics Lecture Notes" style="width: 100%; height: 44px;" required>
            </div>
          </div>

          <!-- Type and Source Row -->
          <div style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 20px;">
            <div class="form-group">
              <label style="display: block; font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">Resource Type</label>
              <select name="type" class="form-control" style="width: 100%; height: 44px;" onchange="TeacherDashboard.toggleMaterialInput(this.value)">
                <option value="link">External Link / Drive</option>
                <option value="pdf">Document (PDF)</option>
                <option value="note">Study Note (Docx/Text)</option>
                <option value="video">Video Link</option>
              </select>
            </div>
            <div class="form-group" id="material-url-group">
              <label style="display: block; font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">Source URL</label>
              <input type="url" name="url" class="form-control" placeholder="https://..." style="width: 100%; height: 44px;" required>
            </div>
            <div class="form-group" id="material-file-group" style="display:none;">
              <label style="display: block; font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">Select File</label>
              <input type="file" name="file" class="form-control" accept=".pdf,.doc,.docx" style="width: 100%; height: 44px; padding: 8px;">
            </div>
          </div>

          <!-- Academic Context Box -->
          <div style="background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div class="form-group">
              <label style="display: block; font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 6px;">TARGET CLASS</label>
              <select name="targetClass" class="form-control" style="width: 100%; background: #fff;" required>
                ${Array.from({length: 12}, (_, i) => `<option value="Class ${i+1}">Class ${i+1}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label style="display: block; font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 6px;">SUBJECT TAG</label>
              <select name="subject" class="form-control" style="width: 100%; background: #fff;" required>
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
          </div>

          <div class="form-group">
            <label style="display: block; font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">Description (Optional)</label>
            <textarea name="description" class="form-control" rows="2" placeholder="Briefly explain what this material covers..." style="width: 100%; resize: none;"></textarea>
          </div>

          <!-- Actions -->
          <div style="display: flex; gap: 12px; margin-top: 8px;">
            <button type="button" class="btn btn-secondary" style="flex: 1; height: 46px;" onclick="Modal.close()">Cancel</button>
            <button type="submit" class="btn btn-primary" style="flex: 2; height: 46px; background: var(--primary-indigo);">
              <i class="fas fa-cloud-upload-alt"></i> Upload Material
            </button>
          </div>
        </form>
      </div>

      <style>
        /* Temporarily hide the fixed modal header for this specific modal */
        #modal-overlay-upload-material header, 
        #modal-overlay-upload-material .flex-between:first-child {
          display: none !important;
        }
      </style>
    `, { title: '', width: '650px' });
    
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
    if (!select) return;

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

    // Passing title: false or similar doesn't work with current modal.js, 
    // so we'll just use the content to handle the header.
    Modal.show('add-student', `
      <div style="position: relative; padding: 10px;">
        <!-- Custom Header inside content -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px;">
          <div>
            <h2 style="font-size: 24px; font-weight: 800; color: var(--primary-indigo); letter-spacing: -0.5px; margin: 0;">Add New Student</h2>
            <p class="p-dim" style="font-size: 13px; margin-top: 4px;">Enroll a student into the digital examination platform.</p>
          </div>
          <button onclick="Modal.close()" style="background: #f1f5f9; border: none; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #64748b; transition: all 0.2s;">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <form onsubmit="TeacherDashboard.handleAddStudent(event)" style="display: flex; flex-direction: column; gap: 24px;">
          <!-- Primary Info Grid -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div class="form-group">
              <label style="display: block; font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.05em;">Full Name</label>
              <input type="text" name="name" class="form-control" placeholder="e.g. John Doe" style="width: 100%; height: 44px;" required>
            </div>
            <div class="form-group">
              <label style="display: block; font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.05em;">Email Address</label>
              <input type="email" name="email" class="form-control" placeholder="student@example.com" style="width: 100%; height: 44px;" required>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div class="form-group">
              <label style="display: block; font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.05em;">Access Password</label>
              <input type="password" name="password" class="form-control" placeholder="Min. 6 chars" style="width: 100%; height: 44px;" required minlength="6">
            </div>
            <div class="form-group">
              <label style="display: block; font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.05em;">Course Assignment</label>
              <select name="courseId" class="form-control" style="width: 100%; height: 44px;" required>
                ${this.courses.map(c => `<option value="${c._id}">${c.courseName}</option>`).join('')}
              </select>
            </div>
          </div>

          <!-- Academic Context Box -->
          <div style="background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div class="form-group">
              <label style="display: block; font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 6px;">CLASS</label>
              <select name="classTag" class="form-control" style="width: 100%; background: #fff;" required>
                ${Array.from({length: 12}, (_, i) => `<option value="Class ${i+1}">Class ${i+1}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label style="display: block; font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 6px;">BOARD / STREAM</label>
              <select name="board" class="form-control" style="width: 100%; background: #fff;" required>
                <option value="All">All Boards</option>
                <option value="CBSE">CBSE</option>
                <option value="ICSE">ICSE</option>
                <option value="State">State Board</option>
              </select>
            </div>
          </div>

          <!-- Actions -->
          <div style="display: flex; gap: 12px; margin-top: 8px;">
            <button type="button" class="btn btn-secondary" style="flex: 1; height: 46px;" onclick="Modal.close()">Cancel</button>
            <button type="submit" class="btn btn-primary" style="flex: 1.5; height: 46px; background: var(--primary-indigo);">
              <i class="fas fa-plus"></i> Add Student
            </button>
          </div>
        </form>
      </div>

      <style>
        /* Temporarily hide the fixed modal header for this specific modal */
        #modal-overlay-add-student header, 
        #modal-overlay-add-student .flex-between:first-child {
          display: none !important;
        }
      </style>
    `, { title: '', width: '650px' });
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
      Loader.show('modal-body', 'Fetching student roster...');
      const [{ data: students }, { data: currentAtt }] = await Promise.all([
        api.get('/portal/teacher/students'),
        api.get(`/portal/edu/attendance/${sessionId}`)
      ]);
      
      const attMap = {};
      (currentAtt || []).forEach(a => {
        attMap[a.studentId?._id || a.studentId] = a.status;
      });

      Modal.show('manual-attendance', `
        <form onsubmit="TeacherDashboard.handleManualAttendance(event, '${sessionId}')">
          <p class="p-dim" style="margin-bottom: 14px;">Marking attendance for all students in the selected session.</p>

          <!-- Quick-Select All Buttons -->
          <div style="display: flex; gap: 10px; margin-bottom: 16px;">
            <button type="button" onclick="TeacherDashboard.markAllAttendance('present')"
              style="flex:1; padding: 10px 16px; border-radius: 10px; border: 2px solid #10b981;
                     background: #ecfdf5; color: #065f46; font-weight: 700; font-size: 13px;
                     cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px;">
              ✅ Mark All Present
            </button>
            <button type="button" onclick="TeacherDashboard.markAllAttendance('absent')"
              style="flex:1; padding: 10px 16px; border-radius: 10px; border: 2px solid #ef4444;
                     background: #fef2f2; color: #991b1b; font-weight: 700; font-size: 13px;
                     cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px;">
              ❌ Mark All Absent
            </button>
          </div>
          
          <div style="max-height: 360px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 12px; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse;">
              <thead style="position: sticky; top: 0; background: #f8fafc; z-index: 10; border-bottom: 2px solid var(--border-color);">
                <tr>
                  <th style="padding: 14px 20px; text-align: left; font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Student Details</th>
                  <th style="padding: 14px 20px; text-align: center; font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Attendance Status</th>
                </tr>
              </thead>
              <tbody>
                ${students.map(s => {
                  const currentStatus = attMap[s._id] || '';
                  return `
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 14px 20px;">
                      <div style="font-weight: 600; color: var(--text-dark);">${s.name}</div>
                      <div style="font-size: 12px; color: var(--text-muted);">${s.email}</div>
                    </td>
                    <td style="padding: 14px 20px;">
                      <div style="display: flex; gap: 24px; justify-content: center;">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--success); font-weight: 700; font-size: 14px;">
                          <input type="radio" name="status_${s._id}" value="present" ${currentStatus === 'present' ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--success);"> P
                        </label>
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--danger); font-weight: 700; font-size: 14px;">
                          <input type="radio" name="status_${s._id}" value="absent" ${currentStatus === 'absent' ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--danger);"> A
                        </label>
                      </div>
                    </td>
                  </tr>
                `}).join('')}
              </tbody>
            </table>
          </div>
          
          <div style="display: flex; gap: 12px;">
            <button type="button" class="btn btn-secondary" style="flex: 1;" onclick="Modal.close()">Cancel</button>
            <button type="submit" class="btn btn-primary" id="btn-submit-att" style="flex: 2;">
              <i class="fas fa-check-double"></i> Save Attendance
            </button>
          </div>
        </form>
      `, { title: 'Attendance Entry', width: '650px' });
    } catch (err) {
      notifications.error('Failed to load students');
    }
  },

  markAllAttendance(status) {
    // Select all radio inputs with value matching status inside the modal form
    const form = document.querySelector('#modal-manual-attendance form, .modal-body form, [id*="manual-attendance"] form');
    if (!form) {
      // Fallback: find all radio buttons in the current document modal
      document.querySelectorAll(`input[type="radio"][value="${status}"]`).forEach(radio => {
        radio.checked = true;
        // Flash the row to confirm selection
        const row = radio.closest('tr');
        if (row) {
          row.style.transition = 'background 0.3s';
          row.style.background = status === 'present' ? '#ecfdf5' : '#fef2f2';
          setTimeout(() => { row.style.background = ''; }, 800);
        }
      });
      return;
    }
    form.querySelectorAll(`input[type="radio"][value="${status}"]`).forEach(radio => {
      radio.checked = true;
      const row = radio.closest('tr');
      if (row) {
        row.style.transition = 'background 0.3s';
        row.style.background = status === 'present' ? '#ecfdf5' : '#fef2f2';
        setTimeout(() => { row.style.background = ''; }, 800);
      }
    });
  },

  async handleManualAttendance(event, sessionId) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const records = [];
    
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('status_')) {
        records.push({ studentId: key.replace('status_', ''), status: value });
      }
    }

    if (records.length === 0) return notifications.error('Please mark attendance for at least one student');

    const btn = document.getElementById('btn-submit-att');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving Records...';
    }

    try {
      await Promise.all(records.map(rec => 
        api.post('/portal/edu/attendance', { ...rec, sessionId })
      ));
      
      notifications.success(`Attendance saved for ${records.length} students`);
      Modal.close();
      this.loadAttendance(sessionId);
      this.loadStudentRoster();
    } catch (err) {
      notifications.error('Failed to save attendance: ' + err.message);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check-double"></i> Save Attendance';
      }
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
      <header class="flex-between" style="margin-bottom: 32px;">
        <div>
          <h2 class="h2">Forum Management</h2>
          <p class="p-dim">Teachers can monitor discussions and guide student queries.</p>
        </div>
      </header>
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
    
    // Check if we are already on this view to prevent history pollution
    if (window.location.search === url.search) return;

    window.history.pushState({ view: viewId }, '', url);
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
      item.addEventListener('click', (e) => {
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
        
        // If already on this view, do nothing
        if (window.location.search === url.search) return;

        window.history.pushState({ view: viewId }, '', url);
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
      'forum': 'forum',
      'analytics-all': 'analytics',
      'analytics': 'analytics'
    };

    const action = mapping[viewName] || 'overview';
    const navItem = document.querySelector(`.sidebar .nav-item[data-action="${action}"]`);
    if (navItem) navItem.classList.add('active');
  }
};


document.addEventListener('DOMContentLoaded', () => TeacherDashboard.init());
window.TeacherDashboard = TeacherDashboard;
