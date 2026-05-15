/**
 * js/student/student.js
 * MCQPro Student Dashboard Controller
 */

const StudentDashboard = {
  async init() {
    if (!auth.checkAuth()) return;

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
    const titles = { dashboard: 'Overview', overview: 'Overview', 'live-exams': 'Live Exams', 'exam-results': 'My Results' };
    const tb = document.getElementById('topbar-title');
    if (tb) tb.textContent = titles[viewId] || 'Overview';

    // Load data
    if (viewId === 'dashboard' || viewId === 'overview') this.renderAll();
    if (viewId === 'live-exams') this.loadLiveExams();
    if (viewId === 'exam-results') this.loadResults();
  },

  switchView(viewId) { this.showView(viewId); },

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
      const res = await api.get('/portal/student/exams');
      const exams = res.data || [];

      if (exams.length === 0) {
        container.innerHTML = '<div class="glass-card" style="grid-column: 1 / -1; text-align:center; padding:60px;"><i class="fas fa-check-circle" style="font-size:48px; color:var(--secondary); margin-bottom:20px;"></i><h3 class="h2">No Active Exams</h3><p class="p-dim">There are no live exams scheduled globally across any board stream right now.</p></div>';
        return;
      }

      container.innerHTML = exams.map(e => `
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
            </div>
            <button onclick="StudentDashboard.joinExam('${e._id}')" class="btn btn-primary">Take Test</button>
          </div>
        </div>
      `).join('');
    } catch (err) { notifications.error('Failed to load exams'); }
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
      container.innerHTML = activeExams.slice(0, 3).map(e => `
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
            </div>
            <button onclick="StudentDashboard.joinExam('${e._id}')" class="btn btn-primary">Take Test</button>
          </div>
        </div>
      `).join('');
    } catch (err) {
      console.warn('Failed to load priority exams');
    }
  },

  async loadResults() {
    const container = document.getElementById('results-detailed-list');
    if (!container) return;

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

    // Hide the global page-header
    const globalHeader = document.querySelector('#view-exam-results .page-header');
    if (globalHeader) globalHeader.style.display = 'none';

    content.innerHTML = '<div style="text-align:center; padding:100px 20px;"><div class="spinner"></div><p style="font-weight: 600;">Generating comprehensive analysis...</p></div>';

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

      content.innerHTML = `
        <div class="animate-slide-up" style="width: 100%;">
          <!-- HEADER -->
          <div style="margin-bottom: 2.5rem;">
            <a href="javascript:void(0)" onclick="StudentDashboard.loadResults()" style="color: #3b82f6; font-weight: 700; font-size: 0.9rem; text-decoration: none; display: flex; align-items: center; gap: 8px; margin-bottom: 1.5rem;">
               <i class="fas fa-arrow-left"></i> Back to My Results
            </a>
            <h1 style="font-size: 2.6rem; font-weight: 800; color: #1e293b; margin-bottom: 4px;">${data.sessionId?.title || 'Examination Result'}</h1>
            <p style="color: #64748b; font-weight: 600; font-size: 1.1rem;">${data.sessionId?.subject || 'Academic Module'}</p>
          </div>

          <!-- TOP STATS GRID -->
          <div class="result-hero-grid">
            <div class="mini-stat-card">
              <div class="stat-icon-box" style="background: rgba(59, 130, 246, 0.1); color: #3b82f6;"><i class="fas fa-file-alt"></i></div>
              <div>
                <p class="stat-label">Marks Obtained</p>
                <h4 class="stat-value"><span style="color:#3b82f6;">${Math.round(data.score || 0)}</span> / <span style="color:#1e293b;">${totalQuestions}</span></h4>
              </div>
            </div>

            <div class="mini-stat-card">
              <div class="stat-icon-box" style="background: rgba(16, 185, 129, 0.1); color: #10b981;"><i class="fas fa-chart-pie"></i></div>
              <div>
                <p class="stat-label">Percentage</p>
                <h4 class="stat-value" style="color: #10b981;">${percentage}%</h4>
                <div style="margin-top:0.75rem;"><span style="background: rgba(16, 185, 129, 0.1); color: #10b981; padding: 4px 12px; border-radius: 8px; font-size: 0.75rem; font-weight: 700;">Passed</span></div>
              </div>
            </div>

            <div class="mini-stat-card">
              <div class="stat-icon-box" style="background: rgba(245, 158, 11, 0.1); color: #f59e0b;"><i class="fas fa-clipboard-list"></i></div>
              <div>
                <p class="stat-label">Questions Attempted</p>
                <h4 class="stat-value"><span style="color:#1e293b;">${attemptedCount}</span> / <span style="color:#1e293b;">${totalQuestions}</span></h4>
              </div>
            </div>

            <!-- Performance Overview Card -->
            <div class="perf-overview-card">
              <p style="font-size: 1rem; font-weight: 800; color: #1e293b;">Performance Overview</p>
              <div class="perf-grid">
                <div style="width: 160px; height: 160px; position: relative;">
                  <canvas id="matchPerfChart"></canvas>
                  <div class="chart-center-text">
                    <p style="font-size: 0.75rem; font-weight: 700; color: #64748b; line-height: 1.2;">Total<br><span style="font-size: 1.4rem; color: #1e293b;">${totalQuestions}</span><br>Questions</p>
                  </div>
                </div>
                <div class="legend-list">
                  <div class="legend-item">
                    <span><span class="legend-dot" style="background: #10b981;"></span> Correct</span>
                    <span>${correctCount} (${Math.round(correctCount/totalQuestions*100)}%)</span>
                  </div>
                  <div class="legend-item">
                    <span><span class="legend-dot" style="background: #ef4444;"></span> Wrong</span>
                    <span>${wrongCount} (${Math.round(wrongCount/totalQuestions*100)}%)</span>
                  </div>
                  <div class="legend-item">
                    <span><span class="legend-dot" style="background: #f59e0b;"></span> Skipped</span>
                    <span>${skippedCount} (${Math.round(skippedCount/totalQuestions*100)}%)</span>
                  </div>
                  <div class="legend-item">
                    <span><span class="legend-dot" style="background: #cbd5e1;"></span> Not Visited</span>
                    <span>0 (0%)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- REVIEW SECTION -->
          <div class="review-main-card">
            <h3 style="font-size: 1.25rem; font-weight: 800; color: #1e293b; margin-bottom: 2.5rem;">Review of the Exam (All Correct Answers)</h3>
            <div class="review-list">
              ${answers.map((a, i) => {
                const correctAnswer = a.correctAnswer ? (Array.isArray(a.correctAnswer) ? a.correctAnswer : [a.correctAnswer]) : [];
                return `
                  <div class="review-q-item">
                    <div class="q-row">
                      <div class="q-num-circle">${i + 1}</div>
                      <div class="q-text-bold">${this.esc(a.questionText || '')}</div>
                    </div>
                    <div class="opt-grid-match">
                      ${(a.options || []).map(opt => {
                        const isCorrect = correctAnswer.includes(opt.label);
                        return `
                          <div class="opt-box-match ${isCorrect ? 'correct' : ''}">
                             ${opt.label}. ${this.esc(opt.text)}
                             ${isCorrect ? '<i class="fas fa-check" style="font-size: 0.75rem; margin-left: auto;"></i>' : ''}
                          </div>`;
                      }).join('')}
                    </div>
                    <div class="correct-ans-footer">
                       Correct Answer: ${correctAnswer.join(', ')}. ${(a.options?.find(o => o.label === correctAnswer[0])?.text || '')}
                    </div>
                  </div>`;
              }).join('')}
            </div>
          </div>
        </div>`;

      const ctx = document.getElementById('matchPerfChart').getContext('2d');
      new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Correct', 'Wrong', 'Skipped', 'Not Visited'],
          datasets: [{
            data: [correctCount, wrongCount, skippedCount, 0],
            backgroundColor: ['#10b981', '#ef4444', '#f59e0b', '#cbd5e1'],
            borderWidth: 0,
            hoverOffset: 10
          }]
        },
        options: {
          cutout: '75%',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { enabled: true } }
        }
      });

    } catch (err) {
      notifications.error('Failed to load result analysis');
      content.innerHTML = `<div class="empty-state"><h3>Analysis Failed</h3><p>${err.message}</p></div>`;
    }
  },


  esc(t) { if (!t) return ''; const d = document.createElement('div'); d.textContent = t; return d.innerHTML; },

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
          'certificates': 'certificates'
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
