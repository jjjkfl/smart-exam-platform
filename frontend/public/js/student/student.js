/**
 * js/student/student.js
 * MCQPro Student Dashboard Controller
 */

const StudentDashboard = {
  async init() {
    if (!auth.checkAuth()) return;

    // Handle one-time setup
    if (!this._bound) {
      this._bound = true;
      this.bindSidebarNav();
      window.addEventListener('popstate', (e) => {
        const params = new URLSearchParams(window.location.search);
        const view = params.get('view') || 'dashboard';

        this.handleUrlView();
      });

      // "Start Fresh" & "Disable Back/Forward" Logic
      // We use replaceState only to ensure history.length stays at 1.
      const url = new URL(window.location);
      if (!url.searchParams.has('view')) {
        url.searchParams.set('view', 'dashboard');
      }
      window.history.replaceState({ view: url.searchParams.get('view') }, '', url);
    }

    // Populate user info in UI
    const user = auth.getUser();
    if (user) {
      const firstName = (user.name || 'Student').split(' ')[0];
      const initials = (user.name || 'S').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      const nameEls = document.querySelectorAll('#prof-name, #sidebar-name');
      nameEls.forEach(el => { if (el) el.textContent = firstName; });
      const avatarEl = document.getElementById('sidebar-avatar');
      if (avatarEl) avatarEl.textContent = initials;
    }

    // Board Preference Check
    this.checkBoardPreference();

    // Attach listeners immediately so UI is responsive even if data fails
    this.handleUrlView();
    this.initAnnouncements();

    try {
      await this.renderAll();
      this.checkUnreadMessages();
    } catch (err) {
      console.error('Dashboard stabilization check failed:', err);
    }
  },

  checkBoardPreference() {
    const board = localStorage.getItem('mcqpro_selected_board');
    if (!board) {
      this.showBoardSelection();
    } else {
      this.updateBoardUI(board);
    }
  },

  showBoardSelection() {
    const overlay = document.getElementById('board-selection-overlay');
    if (overlay) overlay.style.display = 'flex';
  },

  scrollToSection(sectionId) {
    const el = document.getElementById(sectionId);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  },

  selectBoard(board) {
    localStorage.setItem('mcqpro_selected_board', board);
    this.updateBoardUI(board);
    notifications.success(`Switched to ${board || 'All'} Boards stream`);

    this.loadPriorityExams();
    this.loadLiveExams();

    // Immediately open the live exams view for the selected board
    this.switchView('live-exams');
  },

  updateBoardUI(board) {
    utils.$all('#selected-board-name, #live-exam-board-label, #live-board-label').forEach(el => {
      if (el) el.textContent = board || 'All Boards';
    });

    // Update sidebar active state
    document.querySelectorAll('.board-nav').forEach(el => {
      el.classList.remove('active');
      if (el.dataset.board === (board || '')) {
        el.classList.add('active');
      }
    });

    const labelEl = document.getElementById('user-board-label');
    if (labelEl) labelEl.textContent = `${board || 'All'} Board Candidate`;

    // Update topbar if in live-exams view
    const tb = document.getElementById('topbar-title');
    if (tb && document.getElementById('view-live-exams').classList.contains('active')) {
      tb.textContent = board || 'All Boards';
    }
  },

  async checkUnreadMessages() {
    try {
      const res = await api.get('/portal/student/announcements');
      const messages = res.data || [];
      const totalMessages = messages.length;

      const lastReadCount = parseInt(localStorage.getItem('mcqpro_messages_read_count') || '0', 10);
      const unreadCount = Math.max(0, totalMessages - lastReadCount);

      const badge = document.getElementById('unread-messages-badge');
      if (badge) {
        if (unreadCount > 0) {
          badge.innerText = unreadCount;
          badge.style.display = 'inline-block';
        } else {
          badge.style.display = 'none';
        }
      }
    } catch (err) {
      console.warn('Failed to check unread messages');
    }
  },

  initAnnouncements() {
    // Basic WebSocket notification handler (if socket.io is present globally)
    if (typeof io !== 'undefined') {
      const socket = io();
      socket.on('announcement', (data) => {
        this.showAnnouncementToast(data);
      });
    }
  },

  showAnnouncementToast(data) {
    const container = document.getElementById('announcement-toast');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'glass-card animate-fade-in';
    div.style.padding = '16px';
    div.style.marginBottom = '12px';
    div.innerHTML = `
      <div style="font-weight:800; color:var(--primary); font-size:11px; text-transform:uppercase;">New Broadcast</div>
      <div style="font-weight:700; margin:4px 0;">${data.title}</div>
      <div style="font-size:13px; opacity:0.8;">${data.content}</div>
    `;
    container.appendChild(div);
    setTimeout(() => div.remove(), 8000);
  },

  handleUrlView() {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    if (view) this.showView(view);
  },

  showView(viewId) {
    // Hide all views
    document.querySelectorAll('.view').forEach(v => { v.style.display = 'none'; v.classList.remove('active'); });

    // Deactivate sidebar items
    document.querySelectorAll('.sidebar .nav-item').forEach(n => n.classList.remove('active'));

    // Activate sidebar item
    const key = viewId === 'dashboard' ? 'overview' : viewId;
    const navItem = document.querySelector(`.sidebar .nav-item[data-action="${key}"]`);
    if (navItem) navItem.classList.add('active');

    // Show target view
    const elementId = viewId === 'overview' ? 'dashboard' : viewId;
    const target = document.getElementById(`view-${elementId}`);
    if (target) {
      target.style.display = 'block';
      target.classList.add('active');
    }

    // Update topbar title
    const titles = { 
      dashboard: 'Overview', 
      overview: 'Overview', 
      'live-exams': 'Live Exams', 
      'exam-results': 'My Results',
      'global-analytics': 'Global Analytics'
    };
    const tb = document.getElementById('topbar-title');
    if (tb) tb.textContent = titles[viewId] || 'Overview';

    // Load data
    if (viewId === 'dashboard' || viewId === 'overview') this.renderAll();
    if (viewId === 'live-exams') this.loadLiveExams();
    if (viewId === 'exam-results') this.loadResults();
    if (viewId === 'global-analytics') this.loadGlobalAnalytics();
  },

  bindSidebarNav() {
    document.querySelectorAll('.sidebar .nav-item[data-action]').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        this.switchView(action);
      });
    });
  },

  switchView(viewId) {
    const url = new URL(window.location);
    url.searchParams.set('view', viewId);
    
    // Prevent history pollution
    if (window.location.search === url.search) return;

    window.history.pushState({ view: viewId }, '', url);
    this.showView(viewId);
  },

  async loadSchedule() {
    const container = document.getElementById('weekly-calendar');
    if (!container) return;

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    Loader.show('weekly-calendar', 'Syncing academic schedule...');

    try {
      const res = await api.get('/portal/student/schedule');
      const entries = res.data || [];

      const scheduleData = { 'Monday': [], 'Tuesday': [], 'Wednesday': [], 'Thursday': [], 'Friday': [] };
      entries.forEach(entry => {
        if (scheduleData[entry.day]) {
          scheduleData[entry.day].push({ time: entry.time, title: entry.title });
        }
      });

      container.innerHTML = days.map(day => {
        const hasEntries = scheduleData[day] && scheduleData[day].length > 0;
        return `
          <div class="schedule-day ${hasEntries ? 'active' : ''}">
            <div class="schedule-day-header">
              <span>${day}</span>
              <i class="far fa-calendar-alt"></i>
            </div>
            <div class="schedule-day-content">
              ${hasEntries ? (scheduleData[day].map(entry => `
                <div class="schedule-item animate-fade-in">
                  <div class="schedule-item-time-row">
                     <i class="far fa-clock"></i>
                     <span>${entry.time}</span>
                  </div>
                  <div class="schedule-item-title">${entry.title}</div>
                  <div class="schedule-item-type">Clinical Lecture</div>
                </div>
              `).join('')) : `
                <div class="schedule-empty animate-fade-in">
                  <div class="empty-icon">☕</div>
                  <div class="empty-text">Rest & Study Day</div>
                </div>
              `}
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      notifications.error('Failed to load schedule');
    }
  },

  async loadMessages() {
    const container = document.getElementById('broadcast-container');
    if (!container) return;
    Loader.show('broadcast-container', 'Syncing secure transmissions...');

    try {
      const res = await api.get('/portal/student/announcements');
      const messages = (res.data || []).map(a => {
        let senderName = 'Academic Faculty';
        if (a.authorId && typeof a.authorId === 'object' && a.authorId.name) {
          senderName = a.authorId.name;
        } else if (typeof a.authorId === 'string') {
          senderName = 'Instructor'; // ID exists but not populated/found
        }

        return {
          sender: senderName,
          faculty: 'Medical',
          title: a.title || 'Broadcast',
          content: a.content || '',
          time: a.createdAt ? utils.formatDate(a.createdAt) : 'Recent'
        };
      });

      if (messages.length === 0) {
        messages.push({
          sender: 'MCQ Pro Admin',
          faculty: 'System',
          title: 'System Ready',
          content: 'Database maintenance completed. Academic hashes are now anchored to the local blockchain.',
          time: 'Active'
        });
      }

      container.innerHTML = messages.map(m => {
        // Extract Initials for Avatar
        const names = m.sender.split(' ');
        const initials = names.length > 1
          ? (names[0][0] + names[names.length - 1][0])
          : names[0].substring(0, 2);

        return `
          <div class="announcement-card animate-slide-up">
            <div class="announcement-avatar">${initials.toUpperCase()}</div>
            <div class="announcement-content">
              <div class="announcement-header">
                <span class="announcement-author">${m.sender}</span>
                <span class="badge badge-primary" style="font-size: 10px;">${m.faculty}</span>
                <span class="announcement-time" style="margin-left: auto;">${m.time}</span>
              </div>
              <div class="announcement-title">${m.title}</div>
              <div class="announcement-text">${m.content}</div>
            </div>
          </div>
        `;
      }).join('');

      // Reset unread count
      const totalMessages = (res.data || []).length;
      localStorage.setItem('mcqpro_messages_read_count', totalMessages.toString());
      const badge = document.getElementById('unread-messages-badge');
      if (badge) badge.style.display = 'none';

    } catch (err) {
      console.error('Announcements Error Details:', {
        message: err.message,
        stack: err.stack,
        error: err
      });
      notifications.error('Failed to load broadcasts');
    }
  },

  async loadCourses() {
    const container = document.getElementById('courses-grid');
    if (!container) return;

    // Ensure visibility (fix for "came and gone" bug)
    container.style.display = 'grid';
    const matView = document.getElementById('course-materials-view');
    if (matView) matView.style.display = 'none';

    Loader.show('courses-grid', 'Syncing curriculum...');

    try {
      const res = await api.get('/portal/student/courses');
      const courses = res.data || [];

      container.innerHTML = courses.map(c => `
        <div class="course-card" onclick="StudentDashboard.loadMaterials('${c._id}', '${c.courseName}')">
          <div class="course-header">
            <div class="course-icon"><i class="fas fa-book-open"></i></div>
            <div class="course-info">
              <h4 class="course-title">${c.courseName}</h4>
              <p class="course-instructor">${c.department || 'Clinical Department'}</p>
            </div>
          </div>
          <div class="course-progress">
            <div class="course-progress-bar">
              <div class="course-progress-fill" style="width: 75%"></div>
            </div>
            <div class="course-progress-text">
              <span>Status</span>
              <span>Enrolled</span>
            </div>
          </div>
          <button class="btn btn-secondary" style="margin-top:1.25rem; width:100%;">View Resources</button>
        </div>
      `).join('');
    } catch (err) {
      notifications.error('Failed to load courses');
    }
  },

  async loadMaterials(courseId, title) {
    const grid = document.getElementById('courses-grid');
    if (grid) grid.style.display = 'none';
    const view = document.getElementById('course-materials-view');
    if (view) view.style.display = 'block';
    const titleEl = document.getElementById('course-title-display');
    if (titleEl) titleEl.innerText = title;

    const list = document.getElementById('materials-list');
    if (!list) return;
    Loader.show('materials-list', 'Unlocking secure materials...');

    try {
      const res = await api.get(`/portal/edu/courses/${courseId}/materials`);
      const materials = res.data || [];

      if (materials.length === 0) {
        list.innerHTML = '<div class="glass-card" style="text-align:center; padding:40px; grid-column: 1 / -1;"><p class="p-dim">No materials uploaded for this module yet.</p></div>';
        return;
      }

      list.innerHTML = materials.map(m => `
        <div class="glass-card" style="padding:20px; display:flex; flex-direction:column; gap:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size:24px;">${m.type === 'video' ? '📽️' : '📄'}</div>
            <span class="badge badge-info" style="font-size:10px; background: rgba(79, 70, 229, 0.1); color: var(--primary);">${m.subject || 'General'}</span>
          </div>
          <div style="font-weight:700; font-size:14px;">${m.title}</div>
          <p class="p-dim" style="font-size:12px;">${m.description || 'Academic Resource'}</p>
          <button onclick="StudentDashboard.viewMaterial('${m._id}', '${m.url}')" class="btn btn-primary" style="margin-top:auto; font-size:12px; justify-content:center;">Review Content</button>
        </div>
      `).join('');
    } catch (err) { notifications.error('Failed to load materials'); }
  },

  async viewMaterial(materialId, url) {
    // If it's an external link, just open it
    if (url.startsWith('http')) {
      return window.open(url, '_blank');
    }

    try {
      notifications.info('Opening secure material...');
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${auth.getToken()}` }
      });

      if (!res.ok) throw new Error('Could not retrieve file');

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } catch (err) {
      notifications.error('Access Denied: ' + err.message);
    }
  },

  async loadLiveExams() {
    const container = document.getElementById('live-exams-grid');
    if (!container) return;
    Loader.show('live-exams-grid', 'Initializing proctored session list...');

    try {
      const board = localStorage.getItem('mcqpro_selected_board') || '';
      const res = await api.get(`/portal/student/exams?board=${board}`);
      let exams = res.data || [];

      // Sort exams so the latest is at the top
      exams.sort((a, b) => {
        const dateA = new Date(a.scheduledStart || a.startTime).getTime();
        const dateB = new Date(b.scheduledStart || b.startTime).getTime();
        return dateB - dateA;
      });

      this.allLiveExams = exams;

      // Populate subjects filter
      const subjectSelect = document.getElementById('filter-subject');
      if (subjectSelect) {
        const subjects = [...new Set(exams.map(e => e.subject || 'General'))];
        subjectSelect.innerHTML = '<option value="all">All Subjects</option>' + 
          subjects.map(s => `<option value="${s}">${s}</option>`).join('');
      }

      this.renderLiveExams();
    } catch (err) { notifications.error('Failed to load exams'); }
  },

  applyLiveExamFilters() {
    this.renderLiveExams();
  },

  renderLiveExams() {
    const container = document.getElementById('live-exams-grid');
    if (!container) return;

    let exams = this.allLiveExams || [];
    
    // Apply filters
    const subjectFilter = document.getElementById('filter-subject')?.value || 'all';

    const now = new Date();

    exams = exams.filter(e => {
      let matchSubject = true;
      if (subjectFilter !== 'all') {
        matchSubject = (e.subject || 'General') === subjectFilter;
      }

      return matchSubject;
    });

    if (exams.length === 0) {
      container.innerHTML = '<div class="glass-card" style="grid-column: 1 / -1; text-align:center; padding:60px;"><i class="fas fa-check-circle" style="font-size:48px; color:var(--secondary); margin-bottom:20px;"></i><h3 class="h2">No Active Exams</h3><p class="p-dim">There are no live exams matching your filters right now.</p></div>';
      return;
    }

    container.innerHTML = exams.map(e => {
      const start = new Date(e.scheduledStart || e.startTime);
      const duration = e.duration || e.durationMinutes || 60;
      const end = new Date(start.getTime() + duration * 60 * 1000);
      
      let buttonText = 'Take Test';
      let disabledAttr = '';
      let buttonStyle = '';

      if (now < start) {
        buttonText = 'Upcoming';
        disabledAttr = 'disabled';
        buttonStyle = 'background: #cbd5e1; border-color: #cbd5e1; color: #64748b; cursor: not-allowed;';
      } else if (now > end) {
        buttonText = 'Expired';
        disabledAttr = 'disabled';
        buttonStyle = 'background: #f1f5f9; border-color: #e2e8f0; color: #94a3b8; cursor: not-allowed;';
      }

      return `
        <div class="exam-card-v2 animate-slide-up">
          <div class="exam-card-icon">
            <img src="https://img.icons8.com/color/96/trophy.png" alt="trophy" />
          </div>
          <div class="exam-card-content" style="width: 100%;">
            <h3 class="exam-card-title">${e.title}</h3>
            <div class="exam-card-meta">
              <div class="meta-pill"><i class="fas fa-globe"></i> ${e.board && e.board !== 'All' ? e.board : 'Global'}</div>
              <div class="meta-pill"><i class="fas fa-users"></i> ${e.division || 'All Classes'}</div>
              <div class="meta-pill"><i class="fas fa-book-open"></i> ${e.subject || 'General'}</div>
              <div class="meta-pill"><i class="far fa-clock"></i> ${utils.formatDateTimeRange(e.scheduledStart || e.startTime, e.duration || e.durationMinutes)}</div>
            </div>
            <button onclick="StudentDashboard.joinExam('${e._id}')" class="btn btn-primary" style="${buttonStyle}" ${disabledAttr}>${buttonText}</button>
          </div>
        </div>
      `;
    }).join('');
  },

  async loadPriorityExams() {
    const container = document.getElementById('priority-exams-list');
    if (!container) return;

    try {
      const board = localStorage.getItem('mcqpro_selected_board') || '';
      const res = await api.get(`/portal/student/exams?board=${board}`);
      const exams = res.data || [];
      const activeExams = exams.filter(e => e.status === 'active');

      if (activeExams.length === 0) {
        container.innerHTML = `
          <div style="grid-column: 1/-1; padding: 40px; text-align: center; background: #fff; border-radius: 20px; border: 1px dashed #cbd5e1;">
            <p class="p-dim">No active exams right now. Check back later!</p>
          </div>`;
        return;
      }

      // Show top 3 active exams on dashboard
      container.innerHTML = activeExams.slice(0, 3).map(e => {
        const now = new Date();
        const start = new Date(e.scheduledStart || e.startTime);
        const duration = e.duration || e.durationMinutes || 60;
        const end = new Date(start.getTime() + duration * 60 * 1000);
        
        let buttonText = 'Take Test';
        let disabledAttr = '';
        let buttonStyle = '';

        if (now < start) {
          buttonText = 'Upcoming';
          disabledAttr = 'disabled';
          buttonStyle = 'background: #cbd5e1; border-color: #cbd5e1; color: #64748b; cursor: not-allowed;';
        } else if (now > end) {
          buttonText = 'Expired';
          disabledAttr = 'disabled';
          buttonStyle = 'background: #f1f5f9; border-color: #e2e8f0; color: #94a3b8; cursor: not-allowed;';
        }

        return `
          <div class="exam-card-v2 animate-slide-up">
            <div class="exam-card-icon">
              <img src="https://img.icons8.com/color/96/trophy.png" alt="trophy" />
            </div>
            <div class="exam-card-content" style="width: 100%;">
              <h3 class="exam-card-title">${e.title}</h3>
              <div class="exam-card-meta">
                <div class="meta-pill"><i class="fas fa-globe"></i> ${e.board && e.board !== 'All' ? e.board : 'Global'}</div>
                <div class="meta-pill"><i class="fas fa-users"></i> ${e.division || 'All Classes'}</div>
                <div class="meta-pill"><i class="fas fa-book-open"></i> ${e.subject || 'General'}</div>
                <div class="meta-pill"><i class="far fa-clock"></i> ${utils.formatDateTimeRange(e.scheduledStart || e.startTime, e.duration || e.durationMinutes)}</div>
              </div>
              <button onclick="StudentDashboard.joinExam('${e._id}')" class="btn btn-primary" style="${buttonStyle}" ${disabledAttr}>${buttonText}</button>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.warn('Failed to load priority exams');
    }
  },

  async loadResults() {
    const container = document.getElementById('results-detailed-list');
    if (!container) return;
    
    // Ensure we exit full page mode if returning from detailed view
    document.querySelector('.student-layout')?.classList.remove('full-page-mode');
    container.classList.add('results-list');

    // Restore the global page-header if it was hidden by detailed view
    const globalHeader = document.querySelector('#view-exam-results .page-header');
    if (globalHeader) globalHeader.style.display = 'block';

    Loader.show('results-detailed-list', 'Synchronizing transcripts...');

    try {
      const res = await api.get('/portal/student/results');
      const results = res.data || [];

      if (results.length === 0) {
        container.innerHTML = '<div class="glass-card" style="text-align:center; padding:60px;"><i class="fas fa-file-invoice" style="font-size:48px; color:var(--neutral-300); margin-bottom:20px;"></i><h3>No Transcripts Found</h3><p class="p-dim">Complete an exam to see your graded analysis here.</p></div>';
        return;
      }

      container.innerHTML = results.map(r => {
        const isPass = r.score >= 50;
        const statusClass = isPass ? 'pass' : 'fail';
        return `
          <div class="result-card-v2 animate-slide-up">
            <div class="result-status-bar ${statusClass}"></div>
            <div class="result-card-header">
              <div class="result-card-icon"><i class="fas fa-clipboard-check"></i></div>
              <div class="result-score-pill ${statusClass}">${r.score}%</div>
            </div>
            <div class="result-card-body">
              <h4>${r.sessionId ? r.sessionId.title : 'Final Assessment'}</h4>
              <p>${r.sessionId?.subject || 'Academic Module'}</p>
            </div>
            <div class="result-card-footer">
              <span class="result-date"><i class="far fa-calendar-alt"></i> ${new Date(r.createdAt).toLocaleDateString()}</span>
              <button onclick="StudentDashboard.showDetailedResult('${r._id}')" class="btn-report" style="border:none; cursor:pointer; background:none;">Review <i class="fas fa-chevron-right"></i></button>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      notifications.error('Failed to load results');
    }
  },

  async showDetailedResult(resultId) {
    const content = document.getElementById('results-detailed-list');
    if (!content) return;

    // Enable Full Page Mode and Hide Header
    document.querySelector('.student-layout')?.classList.add('full-page-mode');
    content.classList.remove('results-list');
    const globalHeader = document.querySelector('#view-exam-results .page-header');
    if (globalHeader) globalHeader.style.display = 'none';

    content.innerHTML = '<div style="text-align:center; padding:100px 20px;"><div class="spinner"></div><p style="font-weight: 600; margin-top: 1rem; color: #64748b;">Generating premium comprehensive analysis...</p></div>';

    try {
      const res = await api.get(`/portal/student/results/${resultId}`);
      if (!res.success) throw new Error(res.message);
      const data = res.data;

      const answers = data.answers || [];
      const correctCount = answers.filter(a => a.isCorrect).length;
      const wrongCount = answers.filter(a => a.selectedAnswer && !a.isCorrect).length;
      const skippedCount = answers.filter(a => !a.selectedAnswer).length;
      const totalQuestions = answers.length;
      const attemptedCount = answers.filter(a => a.selectedAnswer).length;
      const percentage = data.percentage || 0;
      const accuracy = attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : 0;
      const isPassed = percentage >= 50;

      content.innerHTML = `
        <div class="result-fullpage-container animate-slide-up" style="max-width: 1100px; margin: 0 auto; padding: 2rem 0 4rem;">
          
          <!-- Premium Navigation Header -->
          <div style="display: flex; align-items: center; gap: 1.5rem; margin-bottom: 2.5rem;">
            <button onclick="StudentDashboard.loadResults()" style="border-radius: 50%; width: 44px; height: 44px; padding: 0; display: flex; align-items: center; justify-content: center; border: 1px solid #e2e8f0; background: white; cursor: pointer; color: #475569; transition: all 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.02);"><i class="fas fa-arrow-left"></i></button>
            <div>
              <h1 style="font-size: 2.2rem; font-weight: 900; color: #0f172a; line-height: 1.2; letter-spacing: -0.5px;">${data.sessionId?.title || 'Examination Result'}</h1>
              <p style="color: #64748b; font-weight: 600; font-size: 0.95rem; margin-top: 4px;">${data.sessionId?.subject || 'Academic Module'} &nbsp;&bull;&nbsp; Submitted ${new Date(data.createdAt || Date.now()).toLocaleDateString()}</p>
            </div>
          </div>

          <!-- High-Impact Hero Stats Section -->
          <div style="background: linear-gradient(135deg, #1e1b4b 0%, #3730a3 100%); border-radius: 24px; padding: 3rem 4rem; color: white; display: flex; justify-content: space-between; align-items: center; margin-bottom: 3rem; box-shadow: 0 20px 40px rgba(55, 48, 163, 0.25); position: relative; overflow: hidden; flex-wrap: wrap; gap: 2rem;">
            <!-- Decorative background elements -->
            <div style="position: absolute; top: -50%; right: -10%; width: 500px; height: 500px; background: radial-gradient(circle, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 70%); border-radius: 50%; pointer-events: none;"></div>
            
            <div style="position: relative; z-index: 1;">
              <p style="text-transform: uppercase; letter-spacing: 2px; font-size: 0.8rem; font-weight: 800; color: #a5b4fc; margin-bottom: 0.5rem;">Total Score Achieved</p>
              <h2 style="font-size: 4.5rem; font-weight: 900; line-height: 1; letter-spacing: -2px;">${correctCount}<span style="font-size: 2rem; color: #818cf8; font-weight: 600; letter-spacing: 0;">/${totalQuestions}</span></h2>
              <div style="display:inline-flex; align-items:center; gap:8px; padding:6px 16px; border-radius:100px; font-weight:800; font-size:0.85rem; margin-top:1rem; background:${isPassed ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}; color:${isPassed ? '#34d399' : '#fca5a5'}; border:1px solid ${isPassed ? 'rgba(52, 211, 153, 0.3)' : 'rgba(252, 165, 165, 0.3)'};">
                ${isPassed ? '✅ EXAM PASSED' : '❌ EXAM FAILED'}
              </div>
            </div>
            
            <div style="position: relative; z-index: 1; display: flex; align-items: center; gap: 3rem; flex-wrap: wrap;">
              <!-- Dynamic CSS Donut Chart -->
              <div style="width: 140px; height: 140px; border-radius: 50%; background: conic-gradient(#10b981 0% ${totalQuestions > 0 ? (correctCount/totalQuestions)*100 : 0}%, #ef4444 ${totalQuestions > 0 ? (correctCount/totalQuestions)*100 : 0}% ${totalQuestions > 0 ? ((correctCount+wrongCount)/totalQuestions)*100 : 0}%, #6366f1 ${totalQuestions > 0 ? ((correctCount+wrongCount)/totalQuestions)*100 : 0}% 100%); display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
                <div style="width: 100px; height: 100px; border-radius: 50%; background: #2e267c; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: inset 0 4px 10px rgba(0,0,0,0.3);">
                  <span style="font-size: 1.5rem; font-weight: 900; color: #fff; line-height: 1;">${accuracy}%</span>
                  <span style="font-size: 0.6rem; text-transform: uppercase; letter-spacing: 1px; color: #a5b4fc; font-weight: 700; margin-top: 2px;">Accuracy</span>
                </div>
              </div>

              <!-- Stat Boxes Grid -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 1.25rem; min-width: 120px; display: flex; flex-direction: column; gap: 0.5rem; backdrop-filter: blur(10px);">
                  <div style="display: flex; align-items: center; gap: 8px; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; color: #a5b4fc; font-weight: 700;">
                    <div style="width: 10px; height: 10px; border-radius: 50%; background: #10b981;"></div> Correct
                  </div>
                  <div style="font-size: 2rem; font-weight: 800; line-height: 1; color: #34d399;">${correctCount}</div>
                </div>

                <div style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 1.25rem; min-width: 120px; display: flex; flex-direction: column; gap: 0.5rem; backdrop-filter: blur(10px);">
                  <div style="display: flex; align-items: center; gap: 8px; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; color: #a5b4fc; font-weight: 700;">
                    <div style="width: 10px; height: 10px; border-radius: 50%; background: #ef4444;"></div> Wrong
                  </div>
                  <div style="font-size: 2rem; font-weight: 800; line-height: 1; color: #fca5a5;">${wrongCount}</div>
                </div>

                <div style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 1.25rem; min-width: 120px; display: flex; flex-direction: column; gap: 0.5rem; backdrop-filter: blur(10px);">
                  <div style="display: flex; align-items: center; gap: 8px; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; color: #a5b4fc; font-weight: 700;">
                    <div style="width: 10px; height: 10px; border-radius: 50%; background: #3b82f6;"></div> Attempted
                  </div>
                  <div style="font-size: 2rem; font-weight: 800; line-height: 1; color: #93c5fd;">${attemptedCount}</div>
                </div>

                <div style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 1.25rem; min-width: 120px; display: flex; flex-direction: column; gap: 0.5rem; backdrop-filter: blur(10px);">
                  <div style="display: flex; align-items: center; gap: 8px; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; color: #a5b4fc; font-weight: 700;">
                    <div style="width: 10px; height: 10px; border-radius: 50%; background: #6366f1;"></div> Skipped
                  </div>
                  <div style="font-size: 2rem; font-weight: 800; line-height: 1; color: #a5b4fc;">${skippedCount}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Professional Review Section -->
          <div style="background: white; border-radius: 24px; padding: 3.5rem; box-shadow: 0 10px 40px rgba(0,0,0,0.03); border: 1px solid #f1f5f9;">
            <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #f8fafc; padding-bottom: 1.5rem; margin-bottom: 3rem;">
               <h3 style="font-size: 1.5rem; font-weight: 800; color: #0f172a; margin: 0;">Detailed Question Analysis</h3>
               <div style="display: flex; gap: 1.5rem;">
                  <span style="font-size: 0.85rem; font-weight: 600; color: #475569;"><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#10b981; margin-right:6px;"></span>Correct (${correctCount})</span>
                  <span style="font-size: 0.85rem; font-weight: 600; color: #475569;"><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#ef4444; margin-right:6px;"></span>Incorrect (${wrongCount})</span>
               </div>
            </div>
              ${answers.map((a, i) => {
                const correctAnswer = a.correctAnswer ? (Array.isArray(a.correctAnswer) ? a.correctAnswer : String(a.correctAnswer).split(',').map(x => x.trim())) : [];
                const selectedAnswerArr = a.selectedAnswer ? (Array.isArray(a.selectedAnswer) ? a.selectedAnswer : String(a.selectedAnswer).split(',').map(x => x.trim())) : [];
                const isSelectedCorrect = a.isCorrect;
                const statusColor = isSelectedCorrect ? '#10b981' : (a.selectedAnswer ? '#ef4444' : '#f59e0b');
                const statusIcon = isSelectedCorrect ? 'fa-check' : (a.selectedAnswer ? 'fa-times' : 'fa-minus');
                const statusText = isSelectedCorrect ? 'Correct' : (a.selectedAnswer ? 'Incorrect' : 'Skipped');
                const bgPulse = isSelectedCorrect ? 'rgba(16, 185, 129, 0.03)' : (a.selectedAnswer ? 'rgba(239, 68, 68, 0.03)' : '#fff');

                return `
                  <div style="border: 1px solid #e2e8f0; background: ${bgPulse}; border-radius: 16px; padding: 2rem; position: relative; overflow: hidden; transition: all 0.2s;">
                    <div style="position: absolute; top: 0; left: 0; width: 6px; height: 100%; background: ${statusColor}; border-radius: 16px 0 0 16px;"></div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem;">
                      <div style="display: flex; gap: 1.25rem; align-items: flex-start;">
                        <div style="background: white; color: #0f172a; font-weight: 800; width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 1.1rem; border: 1px solid #e2e8f0; box-shadow: 0 2px 5px rgba(0,0,0,0.02);">${i + 1}</div>
                        <div style="font-size: 1.15rem; font-weight: 700; color: #1e293b; line-height: 1.6; padding-top: 6px;">
                          ${this.esc(a.questionText || '')}
                          ${a.image ? `<br><img src="${window.SERVER_URL}${a.image}" style="max-width: 100%; max-height: 220px; border-radius: 10px; border: 1px solid #e2e8f0; margin-top: 16px;" onerror="this.style.display='none'">` : ''}
                        </div>
                      </div>
                      <div style="background: white; border: 1px solid ${statusColor}30; color: ${statusColor}; padding: 6px 14px; border-radius: 20px; font-weight: 800; font-size: 0.8rem; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 10px ${statusColor}15;">
                        <i class="fas ${statusIcon}"></i> ${statusText}
                      </div>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.25rem; margin-left: 3.75rem;">
                      ${(a.options || []).map(opt => {
                        const isCorrectOpt = correctAnswer.includes(opt.label);
                        const isSelectedOpt = selectedAnswerArr.includes(opt.label);
                        
                        let optStyle = 'border: 1px solid #cbd5e1; background: #fff; color: #475569;';
                        if (isCorrectOpt) {
                           optStyle = 'border: 2px solid #10b981; background: #f0fdf4; color: #065f46; font-weight: 700; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.1);';
                        } else if (isSelectedOpt && !isCorrectOpt) {
                           optStyle = 'border: 2px solid #ef4444; background: #fef2f2; color: #991b1b; font-weight: 700; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.1);';
                        }

                        return `
                          <div style="padding: 1.25rem 1.5rem; border-radius: 14px; font-size: 0.95rem; display: flex; align-items: center; justify-content: space-between; transition: all 0.2s; ${optStyle}">
                             <div style="display: flex; gap: 12px; align-items: center; flex: 1; padding-right: 1rem;">
                               <span style="font-weight: 800; font-size: 0.85rem; background: rgba(0,0,0,0.06); width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 8px; flex-shrink: 0;">${opt.label}</span> 
                               <div style="display: flex; flex-direction: column; gap: 8px;">
                                 <span style="line-height: 1.4;">${this.esc(opt.text)}</span>
                                 ${opt.image ? `<img src="${window.SERVER_URL}${opt.image}" style="max-width: 160px; max-height: 100px; border-radius: 6px; border: 1px solid #e2e8f0;" onerror="this.style.display='none'">` : ''}
                               </div>
                             </div>
                             ${isCorrectOpt ? '<i class="fas fa-check-circle" style="color: #10b981; font-size: 1.25rem; flex-shrink: 0;"></i>' : ''}
                             ${isSelectedOpt && !isCorrectOpt ? '<i class="fas fa-times-circle" style="color: #ef4444; font-size: 1.25rem; flex-shrink: 0;"></i>' : ''}
                          </div>`;
                      }).join('')}
                    </div>
                    
                    ${!isSelectedCorrect ? `
                    <div style="margin-top: 2rem; margin-left: 3.75rem; padding: 1.25rem 1.5rem; background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #3b82f6; border-radius: 12px; display: flex; align-items: flex-start; gap: 1rem;">
                      <div style="color: #3b82f6; font-size: 1.25rem; margin-top: 2px;"><i class="fas fa-info-circle"></i></div>
                      <div>
                        <p style="font-size: 0.95rem; color: #334155; margin: 0;"><strong style="font-weight: 800; color: #0f172a;">Correct Answer:</strong> Option ${correctAnswer.join(', ')} - ${(a.options?.find(o => o.label === correctAnswer[0])?.text || '')}</p>
                      </div>
                    </div>
                    ` : ''}

                    ${a.explanation ? `
                    <div style="margin-top: 1rem; margin-left: 3.75rem; padding: 1.5rem; background: #fdf4ff; border: 1px solid #fce7f3; border-left: 4px solid #d946ef; border-radius: 12px; display: flex; align-items: flex-start; gap: 1rem;">
                      <div style="color: #d946ef; font-size: 1.25rem; margin-top: 2px;"><i class="fas fa-lightbulb"></i></div>
                      <div>
                        <h4 style="font-size: 0.85rem; font-weight: 800; color: #86198f; margin: 0 0 0.5rem 0; text-transform: uppercase; letter-spacing: 1.5px;">Explanation</h4>
                        <p style="font-size: 0.95rem; color: #4a044e; margin: 0; line-height: 1.6;">${this.esc(a.explanation)}</p>
                      </div>
                    </div>
                    ` : ''}
                  </div>`;
              }).join('')}
            </div>
          </div>
        </div>`;

    } catch (err) {
      notifications.error('Failed to load result analysis');
      content.innerHTML = `<div class="empty-state"><h3>Analysis Failed</h3><p>${err.message}</p></div>`;
    }
  },


  esc(t) { if (!t) return ''; const d = document.createElement('div'); d.textContent = t; return d.innerHTML; },

  async loadGlobalAnalytics() {
    const tableBody = document.getElementById('analytic-comparison-table-body');
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 3rem;">
            <div class="spinner" style="margin: 0 auto 1rem;"></div>
            <p>Syncing class analytics standing...</p>
          </td>
        </tr>
      `;
    }

    try {
      const res = await api.get('/portal/student/global-analytics');
      if (!res.success) throw new Error(res.message);
      this.renderGlobalAnalytics(res.data);
    } catch (err) {
      notifications.error('Failed to load global analytics: ' + err.message);
      if (tableBody) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align: center; color: var(--danger); padding: 3rem;">
              <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
              <p>Failed to retrieve analytics. Please try again later.</p>
            </td>
          </tr>
        `;
      }
    }
  },

  renderGlobalAnalytics(data) {
    if (!data) return;

    // 1. Populate stats cards
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setVal('analytic-student-gpa', data.studentStats.gpa || '0.0');
    setVal('analytic-student-rank', this.formatRank(data.studentStats.rank));
    setVal('analytic-student-peers', `vs ${data.studentStats.totalPeers || 0} scholars`);
    setVal('analytic-student-avg', (data.studentStats.avgScore || 0) + '%');
    setVal('analytic-student-exams', data.studentStats.totalExamsTaken || 0);

    setVal('analytic-cohort-avg', (data.tenantStats.avgScore || 0) + '%');
    setVal('analytic-cohort-highest', (data.tenantStats.highestScore || 0) + '%');
    setVal('analytic-cohort-submissions', data.tenantStats.totalSubmissions || 0);
    setVal('analytic-cohort-passrate', (data.tenantStats.passRate || 0) + '%');

    // 2. Render grade breakdown progress bars
    const gradeDistributionContainer = document.getElementById('analytic-grade-distribution');
    if (gradeDistributionContainer) {
      const maxCount = Math.max(...Object.values(data.gradeBreakdown), 1);
      const gradeColors = {
        'A+': '#10b981',
        'A': '#34d399',
        'B': '#3b82f6',
        'C': '#60a5fa',
        'D': '#f59e0b',
        'F': '#ef4444'
      };

      const hasGrades = Object.values(data.gradeBreakdown).some(c => c > 0);
      if (!hasGrades) {
        gradeDistributionContainer.innerHTML = `
          <div style="text-align: center; color: var(--text-muted); padding: 2rem 0;">
            <p style="font-size: 0.95rem;">No grades recorded yet.</p>
          </div>
        `;
      } else {
        gradeDistributionContainer.innerHTML = Object.entries(data.gradeBreakdown).map(([grade, count]) => {
          const percent = (count / maxCount) * 100;
          const color = gradeColors[grade] || '#94a3b8';
          return `
            <div class="grade-bar-container">
              <span class="grade-label">${grade}</span>
              <div class="grade-progress-bar">
                <div class="grade-progress-fill" style="width: ${percent}%; background: ${color};"></div>
              </div>
              <span class="grade-count">${count}</span>
            </div>
          `;
        }).join('');
      }
    }

    // 3. Render Subject Mastery Chart
    const ctx = document.getElementById('studentSubjectAnalyticsChart');
    if (ctx && typeof Chart !== 'undefined') {
      if (this.subjectAnalyticsChart) {
        this.subjectAnalyticsChart.destroy();
      }

      const subjects = data.subjectPerformance || [];
      if (subjects.length === 0) {
        // Render empty chart feedback
        const parent = ctx.parentElement;
        if (parent) {
          parent.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-muted);">
              <i class="fas fa-chart-bar" style="font-size: 2.5rem; opacity: 0.3; margin-bottom: 1rem;"></i>
              <p>No subject performance data available yet.</p>
            </div>
            <canvas id="studentSubjectAnalyticsChart" style="display:none;"></canvas>
          `;
        }
      } else {
        // Clean out any previously-injected placeholder error/empty states before re-rendering the canvas
        const parent = ctx.parentElement;
        if (parent && parent.querySelector('.empty-state-placeholder')) {
          parent.innerHTML = `<canvas id="studentSubjectAnalyticsChart"></canvas>`;
        }

        const freshCtx = document.getElementById('studentSubjectAnalyticsChart') || ctx;

        this.subjectAnalyticsChart = new Chart(freshCtx, {
          type: 'bar',
          data: {
            labels: subjects.map(s => s.subject),
            datasets: [
              {
                label: 'Your Average',
                data: subjects.map(s => s.studentAvg),
                backgroundColor: 'rgba(79, 70, 229, 0.85)',
                borderColor: '#4f46e5',
                borderWidth: 1,
                borderRadius: 8,
                barThickness: 18
              },
              {
                label: 'Class Cohort Average',
                data: subjects.map(s => s.tenantAvg),
                backgroundColor: 'rgba(203, 213, 225, 0.65)',
                borderColor: '#cbd5e1',
                borderWidth: 1,
                borderRadius: 8,
                barThickness: 18
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'top',
                labels: { boxWidth: 12, font: { weight: '600', family: 'Outfit', size: 11 } }
              }
            },
            scales: {
              x: { grid: { display: false }, ticks: { font: { weight: '600', family: 'Outfit' } } },
              y: { beginAtZero: true, max: 100, ticks: { font: { family: 'Outfit' } } }
            }
          }
        });
      }
    }

    // 4. Populate recent exams comparison table
    const tableBody = document.getElementById('analytic-comparison-table-body');
    if (tableBody) {
      const exams = data.recentExams || [];
      if (exams.length === 0) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 3rem;">
              <i class="fas fa-folder-open" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
              <p>No examinations published in this tenant cohort yet.</p>
            </td>
          </tr>
        `;
      } else {
        tableBody.innerHTML = exams.map(e => {
          const studentScoreStr = e.studentScore != null ? `<span class="score-badge-pill student-score">${e.studentScore}%</span>` : `<span style="color:var(--text-muted); font-size:0.85rem; font-style:italic;">Not Taken</span>`;
          const cohortAvgStr = e.avgScore != null ? `<span class="score-badge-pill cohort-avg">${e.avgScore}%</span>` : `<span style="color:var(--text-muted);">0%</span>`;
          const highestScoreStr = e.maxScore != null ? `<span class="score-badge-pill highest-score">${e.maxScore}%</span>` : `<span style="color:var(--text-muted);">0%</span>`;

          return `
            <tr>
              <td>
                <div class="table-exam-title">${this.esc(e.title)}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500; margin-top: 2px;">
                  Scheduled: ${new Date(e.startTime).toLocaleDateString()}
                </div>
              </td>
              <td><span class="badge badge-info" style="font-size: 10px; background: rgba(79, 70, 229, 0.1); color: var(--primary-indigo);">${this.esc(e.subject)}</span></td>
              <td>${studentScoreStr}</td>
              <td>${cohortAvgStr}</td>
              <td>${highestScoreStr}</td>
              <td><span style="font-weight: 700; color: var(--text-dark);">${e.submissionCount}</span></td>
            </tr>
          `;
        }).join('');
      }
    }
  },

  async loadInternalMarks() {
    const container = document.getElementById('student-marks-list');
    if (!container) return;
    Loader.show('student-marks-list', 'Syncing Assessment Data...');

    try {
      const res = await api.get('/portal/student/marks');
      const marks = res.data || [];

      if (marks.length === 0) {
        container.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:32px;" class="p-dim">No internal marks recorded by faculty yet.</td></tr>';
        return;
      }

      container.innerHTML = marks.map(m => `
        <tr class="animate-fade-in">
          <td><div style="font-weight:600;">${m.subject}</div></td>
          <td>${m.teacherId?.name || 'Faculty Member'}</td>
          <td><span class="badge badge-info" style="font-size:10px;">${m.examType}</span></td>
          <td>
            <div style="font-weight:700;">${m.marksObtained} / ${m.totalMarks}</div>
            <div style="font-size:11px; opacity:0.7;">${Math.round((m.marksObtained / m.totalMarks) * 100)}%</div>
          </td>
          <td>
            <div style="width: 100px; height: 6px; background: #f1f5f9; border-radius: 3px; overflow: hidden;">
              <div style="width: ${(m.marksObtained / m.totalMarks) * 100}%; height: 100%; background: ${m.marksObtained / m.totalMarks >= 0.5 ? '#10b981' : '#f43f5e'};"></div>
            </div>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      notifications.error('Failed to load internal assessment marks');
    }
  },

  async loadCertificates() {
    const list = document.getElementById('certificates-list');
    if (!list) return;

    // Ensure visibility (fix for "came and gone" bug)
    list.style.display = 'grid';
    const viewer = document.getElementById('certificate-viewer');
    if (viewer) viewer.style.display = 'none';

    Loader.show('certificates-list', 'Verifying blockchain credentials...');

    try {
      const res = await api.get('/portal/student/courses');
      const courses = res.data || [];

      list.innerHTML = courses.map(c => `
         <div class="glass-card" style="text-align:center; padding:32px;">
          <div style="position:relative; display:inline-block;">
            <div style="font-size:48px; margin-bottom:16px;">🏆</div>
            <div style="position:absolute; top:0; right:-10px; color:var(--secondary); font-size:20px;"><i class="fas fa-certificate animate-pulse"></i></div>
          </div>
          <h4 class="h3" style="margin-bottom:8px;">${c.courseName}</h4>
          <p class="p-dim" style="font-size:12px; margin-bottom:24px;">Digital Proficiency Badge • Blockchain Secured</p>
          <button onclick="StudentDashboard.viewCertificate('${c._id}')" class="btn btn-primary" style="width:100%; justify-content:center;">Download Certificate</button>
        </div>
      `).join('');
    } catch (err) { notifications.error('Failed to load certificates'); }
  },

  async viewCertificate(courseId) {
    try {
      const res = await api.get(`/portal/edu/certificates/${courseId}`);
      if (!res.success) throw new Error(res.message);

      const d = res.data;
      const list = document.getElementById('certificates-list');
      if (list) list.style.display = 'none';
      const viewer = document.getElementById('certificate-viewer');
      if (viewer) viewer.style.display = 'block';

      const content = document.getElementById('cert-content');
      if (content) content.innerHTML = `
        <h1 style="font-size: 56px; color: var(--primary); margin-bottom: 8px; font-weight:900;">CERTIFICATE</h1>
        <h2 style="font-size: 20px; color: var(--neutral-500); margin-bottom: 48px; letter-spacing:4px;">OF ACADEMIC COMPETENCE</h2>
        <p style="font-size: 18px; font-style: italic; color: var(--neutral-600);">This academic achievement is proudly presented to</p>
        <h3 style="font-size: 36px; margin: 24px 0; border-bottom: 3px solid var(--primary); display: inline-block; padding: 0 60px; font-weight:800;">${d.studentName}</h3>
        <p style="font-size: 18px; font-style: italic; color: var(--neutral-600); margin-top:20px;">for mastering the comprehensive curriculum of</p>
        <h4 style="font-size: 28px; margin-top: 12px; color: var(--neutral-800); font-weight:700;">${d.courseName}</h4>
        <div style="margin-top: 80px; display: flex; justify-content: space-between; align-items: flex-end; padding: 0 40px;">
          <div style="text-align: left;">
            <div style="font-weight: 700; font-size:12px; color:var(--neutral-400);">ISSUE DATE</div>
            <div style="font-weight: 600;">${new Date(d.issueDate).toLocaleDateString()}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 700; font-size:12px; color:var(--neutral-400);">VERIFICATION ID</div>
            <div style="font-family: monospace; font-size:12px; color:var(--primary);">${d.certificateId}</div>
          </div>
        </div>
      `;
    } catch (err) { notifications.error('Certificate verification failed: ' + err.message); }
  },

  async renderAll() {
    try {
      const result = await api.get('/portal/student/dashboard');
      if (!result.success) throw new Error(result.message);

      const d = result.data;
      this.renderProfile(d.profile);
      this.renderStats(d.profile);
      this.renderSubjectPerformance(d.subjectPerformance);
      this.renderCharts(d.subjectPerformance, d.recentResults);
      this.loadPriorityExams();
    } catch (err) { notifications.error('Core sync failed: ' + err.message); }
  },

  renderProfile(p) {
    if (!p) return;
    const nameEl = document.getElementById('prof-name');
    const secEl = document.getElementById('prof-section');
    if (nameEl) nameEl.innerText = p.name ? p.name.split(' ')[0] : 'Resident';
    if (secEl) secEl.innerText = p.section || 'MCQ Pro Scholar';
  },

  renderStats(p) {
    if (!p) return;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    set('stat-gpa', p.gpa || '0.00');
    set('stat-attendance', (p.attendance || 0) + '%');
    set('stat-sessions', `${p.sessionsLogged || 0} / ${p.totalSessions || 0} Sessions`);
    set('stat-tasks', p.tasks || 0);
    set('stat-rank', this.formatRank(p.rank || 0));
    set('stat-peers', `vs ${p.totalPeers || 0} Scholars`);
  },

  renderSubjectPerformance(subjects) {
    const container = document.getElementById('subject-performance-list');
    if (!container) return;
    if (!subjects || subjects.length === 0) {
      container.innerHTML = '<p class="p-dim">No academic performance data available.</p>';
      return;
    }
    container.innerHTML = subjects.map(s => `
      <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--neutral-100);">
        <span style="font-weight: 500;">${s.subject}</span>
        <span style="font-weight: 700; color: var(--primary);">${s.score}%</span>
      </div>
    `).join('');
  },

  renderCharts(subjects, results) {
    // Subject Mastery Bar
    const ctxS = document.getElementById('subjectChart');
    if (ctxS && subjects && typeof Chart !== 'undefined') {
      if (this.chartS) this.chartS.destroy();
      this.chartS = new Chart(ctxS, {
        type: 'bar',
        data: {
          labels: subjects.map(s => s.subject),
          datasets: [{
            data: subjects.map(s => s.score),
            backgroundColor: 'rgba(79, 70, 229, 0.1)',
            borderColor: '#4f46e5',
            borderWidth: 2,
            borderRadius: 8,
            hoverBackgroundColor: '#4f46e5'
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { beginAtZero: true, max: 100, grid: { display: false }, ticks: { color: '#94a3b8' } },
            y: { grid: { display: false }, ticks: { color: '#64748b', font: { weight: '600' } } }
          }
        }
      });
    }

    // Trend Line
    const ctxT = document.getElementById('trendChart');
    if (ctxT && results && typeof Chart !== 'undefined') {
      if (this.chartT) this.chartT.destroy();
      const rev = [...results].reverse();
      this.chartT = new Chart(ctxT, {
        type: 'line',
        data: {
          labels: rev.map(r => new Date(r.submittedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })),
          datasets: [{
            data: rev.map(r => r.percentage),
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.05)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: '#10b981'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, max: 100, grid: { color: '#f1f5f9' }, ticks: { display: false } },
            x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 10 } } }
          }
        }
      });
    }
  },

  async joinExam(sessionId) {
    window.location.href = `/exam.html?sessionId=${sessionId}`;
  },

  bindDashboardNav() {
    document.querySelectorAll('.sidebar .nav-item[data-action]').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        const viewIdMap = {
          'overview': 'dashboard',
          'courses': 'courses',
          'schedule': 'schedule',
          'messages': 'messages',
          'live-exams': 'live-exams',
          'exam-results': 'exam-results',
          'internal-marks': 'internal-marks',
          'certificates': 'certificates',
          'global-analytics': 'global-analytics'
        };
        const viewId = viewIdMap[action] || 'dashboard';

        const url = new URL(window.location);
        url.searchParams.set('view', viewId);
        window.history.pushState({}, '', url);
        this.showView(viewId);
      });
    });
  },

  formatRank(r) {
    const n = Number(r); if (!n) return '--';
    const j = n % 10, k = n % 100;
    if (j === 1 && k !== 11) return `${n}st`;
    if (j === 2 && k !== 12) return `${n}nd`;
    if (j === 3 && k !== 13) return `${n}rd`;
    return `${n}th`;
  }
};

window.StudentDashboard = StudentDashboard;
