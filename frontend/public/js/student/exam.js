/**
 * js/student/exam.js
 * Exam Engine — Color-coded progress, image support, strict proctoring integration
 */

const ReadinessCheck = {
  checks: { camera: false, fullscreen: false, consent: false, landmarks: false },

  async allowCamera() {
    try {
      await Proctor.startCamera();
      
      // Granular loading progress
      const lStatus = document.getElementById('landmarks-status');
      const lLoader = document.getElementById('landmarks-loader');
      if (lLoader) lLoader.style.display = 'block';

      if (typeof Proctor !== 'undefined') {
        const isAIEnabled = ExamEngine.examData && ExamEngine.examData.enableAIProctoring !== false;
        if (isAIEnabled) {
          if (lStatus) lStatus.textContent = 'Initializing AI engine...';
          await Proctor._loadModels(); 
        } else {
          if (lStatus) lStatus.textContent = 'Camera initialized.';
          if (lLoader) lLoader.style.display = 'none';
          this.checks.landmarks = true; // Auto-pass landmarks if AI is disabled
        }
      }
      
      this.checks.camera = true;
      document.getElementById('check-camera').classList.add('done');
      document.getElementById('btn-allow-camera').innerText = '✅ Active';
      document.getElementById('btn-allow-camera').disabled = true;

      this.validate();
    } catch (err) {
      console.error('[Readiness] Camera Error:', err);
      let msg = `Camera error: ${err.message}.`;
      if (err.name === 'NotAllowedError' || err.message.toLowerCase().includes('denied')) {
        msg = "🚫 Camera Access Denied! Please click the 'Lock' or 'Camera' icon in your browser's address bar (at the top) and change 'Block' to 'Allow', then refresh the page.";
      }
      notifications.error(msg, { duration: 10000 });
    }
  },

  async enterFullscreen() {
    try {
      await document.documentElement.requestFullscreen();
      this.checks.fullscreen = true;
      document.getElementById('check-fullscreen').classList.add('done');
      document.getElementById('btn-enter-fullscreen').innerText = '✅ Fullscreen';
      document.getElementById('btn-enter-fullscreen').disabled = true;
      this.validate();
    } catch (err) {
      notifications.error('Fullscreen is required for security.');
    }
  },

  updateConsent() {
    this.checks.consent = document.getElementById('consent-checkbox').checked;
    if (this.checks.consent) {
      document.getElementById('check-consent').classList.add('done');
    } else {
      document.getElementById('check-consent').classList.remove('done');
    }
    this.validate();
  },

  validate() {
    const canStart = this.checks.camera && this.checks.fullscreen && this.checks.consent && this.checks.landmarks;
    document.getElementById('btn-start-exam').disabled = !canStart;
  },

  onLandmarksDetected() {
    if (this.checks.landmarks) return; // Already done
    
    this.checks.landmarks = true;
    const item = document.getElementById('check-landmarks');
    const loader = document.getElementById('landmarks-loader');
    const done = document.getElementById('landmarks-done');
    const status = document.getElementById('landmarks-status');
    
    if (item) item.classList.add('done');
    if (loader) loader.style.display = 'none';
    if (done) done.style.display = 'inline';
    if (status) status.textContent = 'AI sync complete. Landmarks working well.';
    
    this.validate();
    notifications.success('AI Proctoring Active: Landmarks detected.');
  },

  async startExam() {
    document.getElementById('readiness-view').style.display = 'none';
    document.getElementById('main-exam-content').style.display = 'grid';

    // Resume original exam flow
    await ExamEngine.loadExam();
    ExamEngine.setupProctoring();
    ExamSocket.init(ExamEngine.sessionId);

    // Ensure proctoring uses the existing camera and stays in fullscreen
    Proctor.updateSecurityBar();
  }
};

window.ReadinessCheck = ReadinessCheck;

const ExamEngine = {
  sessionId: null,
  questions: [],
  currentIdx: 0,
  answers: {},       // { questionId: selectedOption }
  visited: new Set(), // Track visited question indices
  startTime: null,

  async init() {
    const params = new URLSearchParams(window.location.search);
    this.sessionId = params.get('sessionId');

    if (!this.sessionId) {
      notifications.error('No exam session found.');
      setTimeout(() => window.location.href = '/index.html', 2000);
      return;
    }

    // 1. Fetch exam configuration early to set up readiness requirements
    try {
      const result = await api.get(`/portal/student/exams/${this.sessionId}`);
      if (!result.success) throw new Error(result.message);
      this.examData = result.data;
    } catch (err) {
      console.error('Initial exam fetch error:', err);
      notifications.error('Failed to load exam details.');
      setTimeout(() => window.location.href = '/index.html', 2000);
      return;
    }

    // 2. Configure Readiness Check based on teacher's settings
    const { requireCamera, enableAIProctoring, lockBrowser } = this.examData;

    if (requireCamera === false) {
      ReadinessCheck.checks.camera = true;
      const camEl = document.getElementById('check-camera');
      if (camEl) camEl.style.display = 'none';
      
      ReadinessCheck.checks.landmarks = true;
      const landEl = document.getElementById('check-landmarks');
      if (landEl) landEl.style.display = 'none';
    } else if (enableAIProctoring === false) {
      ReadinessCheck.checks.landmarks = true;
      const landEl = document.getElementById('check-landmarks');
      if (landEl) landEl.style.display = 'none';
      if (typeof Proctor !== 'undefined') Proctor.preloadModels(); // Still preload basic models just in case
    } else {
      // Full AI Proctoring required
      if (typeof Proctor !== 'undefined') Proctor.preloadModels();
    }

    if (lockBrowser === false) {
      ReadinessCheck.checks.fullscreen = true;
      const fsEl = document.getElementById('check-fullscreen');
      if (fsEl) fsEl.style.display = 'none';
    }

    ReadinessCheck.validate();
    console.log('[ExamEngine] Waiting for Readiness Check...', { requireCamera, enableAIProctoring, lockBrowser });

    // Monitor for fullscreen exit during check
    document.addEventListener('fullscreenchange', () => {
      if (this.examData && this.examData.lockBrowser === false) return; // Ignore if not locked
      
      const view = document.getElementById('readiness-view');
      if (!document.fullscreenElement && view && view.style.display !== 'none') {
        document.getElementById('check-fullscreen').classList.remove('done');
        document.getElementById('btn-enter-fullscreen').innerText = 'Enter';
        document.getElementById('btn-enter-fullscreen').disabled = false;
        ReadinessCheck.checks.fullscreen = false;
        ReadinessCheck.validate();
      }
    });
  },

  async loadExam() {
    try {
      if (!this.examData) throw new Error('Exam data not initialized');

      this.questions = this.examData.questions;
      this.startTime = Date.now();

      if (!this.questions || this.questions.length === 0) {
        document.getElementById('question-area').innerHTML = `
          <div style="text-align:center; padding:60px;">
            <p style="font-size:18px; font-weight:600;">No questions available for this exam.</p>
            <p class="p-dim" style="margin-top:8px;">Please contact your teacher.</p>
          </div>`;
        return;
      }

      // Mark first question as visited
      this.visited.add(0);

      // Update exam title
      const titleEl = document.getElementById('exam-title');
      const subtitleEl = document.getElementById('exam-subtitle');
      if (titleEl) titleEl.textContent = this.examData.title || 'Live Examination';
      if (subtitleEl) subtitleEl.textContent = `${this.questions.length} Questions`;

      this.renderQuestion();
      this.renderProgress();
      this.updateCounters();

      // Start timer
      const duration = (this.examData.duration || this.examData.durationMinutes || 60) * 60;
      ExamTimer.start(duration, () => this.autoSubmit());

      // Init security bar
      setTimeout(() => Proctor.updateSecurityBar(), 1000);

    } catch (err) {
      console.error('Exam load error:', err);
      notifications.error('Failed to load exam: ' + err.message);
      document.getElementById('question-area').innerHTML = `
        <div style="text-align:center; padding:60px;">
          <p style="font-size:18px; font-weight:600; color:#ff3b30;">Failed to Load Exam</p>
          <p class="p-dim" style="margin-top:8px;">${err.message}</p>
          <button onclick="window.location.href='/index.html'" class="btn btn-outline" style="margin-top:20px;">Return to Dashboard</button>
        </div>`;
    }
  },

  renderQuestion() {
    const q = this.questions[this.currentIdx];
    const container = document.getElementById('question-area');
    const selectedAnswer = this.answers[q._id];

    container.innerHTML = `
      <div class="animate-fade-in">
        <div class="exam-q-header">
          <p class="p-dim" style="font-size: 13px;">Question ${this.currentIdx + 1} of ${this.questions.length}</p>
          <div class="exam-q-badges">
            ${q.marks ? `<span class="q-marks-badge">${q.marks} Mark${q.marks > 1 ? 's' : ''}</span>` : ''}
          </div>
        </div>

        <h2 style="font-size: 20px; font-weight: 500; margin: 20px 0 24px; line-height: 1.6; color: #1e293b;">
          ${this._escapeHtml(q.questionText && q.questionText.trim() ? q.questionText : (q.image ? '[Refer to the image below]' : `Question ${this.currentIdx + 1}`))}
        </h2>

        ${q.image ? `
          <div class="exam-image-container">
            <img src="${window.SERVER_URL}${q.image}" alt="Question Image" class="exam-question-image"
                 onclick="ExamEngine._zoomImage(this.src)"
                 onerror="this.src='/img/placeholder.png'; this.style.opacity='0.5';">
            <p class="p-dim" style="font-size: 11px; margin-top: 6px; text-align: center;">
              Click image to enlarge
            </p>
          </div>` : ''}

        <div class="options-list">
          ${q.options.map(opt => `
            <div class="option-item ${selectedAnswer === opt.label ? 'selected' : ''}" 
                 onclick="ExamEngine.selectOption('${q._id}', '${opt.label}')">
              <div class="option-label">${opt.label}</div>
              <div class="option-content-wrapper">
                <div class="option-text">${this._escapeHtml(opt.text)}</div>
                ${opt.image ? `
                  <div class="option-image-container">
                    <img src="${window.SERVER_URL}${opt.image}" alt="Option Image" class="exam-option-image"
                         onclick="event.stopPropagation(); ExamEngine._zoomImage(this.src)"
                         onerror="this.src='/img/placeholder.png'; this.style.opacity='0.5';">
                  </div>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>

        ${selectedAnswer ? `
          <div style="margin-top: 16px; text-align: right;">
            <button onclick="ExamEngine.clearAnswer('${q._id}')" class="btn-clear-answer">
              ✕ Clear Selection
            </button>
          </div>
        ` : ''}
      </div>
    `;

    this.updateNavButtons();
    this.renderProgress();
    this.updateCounters();
  },

  selectOption(qId, label) {
    this.answers[qId] = label;
    this.renderQuestion();
    ExamSocket.sendAnswer(this.currentIdx, label);
  },

  clearAnswer(qId) {
    delete this.answers[qId];
    this.renderQuestion();
  },

  /* ─── Color-Coded Progress ─────────────────────────────────────── */
  renderProgress() {
    const container = document.getElementById('exam-progress');
    if (!container) return;

    const answered = Object.keys(this.answers).length;
    const total = this.questions.length;
    const skipped = this.visited.size - answered;
    const notVisited = total - this.visited.size;

    container.innerHTML = `
      <div class="progress-legend">
        <div class="legend-item"><span class="legend-dot answered"></span> Answered (${answered})</div>
        <div class="legend-item"><span class="legend-dot skipped"></span> Skipped (${skipped < 0 ? 0 : skipped})</div>
        <div class="legend-item"><span class="legend-dot not-visited"></span> Not Visited (${notVisited})</div>
        <div class="legend-item"><span class="legend-dot current"></span> Current</div>
      </div>
      <div class="question-grid">
        ${this.questions.map((q, i) => {
      let status = 'not-visited';
      if (i === this.currentIdx) status = 'current';
      else if (this.answers[q._id]) status = 'answered';
      else if (this.visited.has(i)) status = 'skipped';

      return `
            <div class="q-dot ${status}" onclick="ExamEngine.goTo(${i})" title="Q${i + 1}">
              ${i + 1}
            </div>
          `;
    }).join('')}
      </div>
    `;
  },

  updateCounters() {
    const answered = Object.keys(this.answers).length;
    const counterEl = document.getElementById('question-counter');
    if (counterEl) counterEl.textContent = `${answered}/${this.questions.length} Answered`;
    const bigEl = document.getElementById('answered-count');
    if (bigEl) bigEl.textContent = answered;
  },

  updateNavButtons() {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');

    if (prevBtn) prevBtn.disabled = this.currentIdx === 0;

    if (nextBtn) {
      if (this.currentIdx === this.questions.length - 1) {
        nextBtn.textContent = '✅ Finish Exam';
        nextBtn.className = 'btn btn-finish';
        nextBtn.onclick = () => this.confirmSubmit();
      } else {
        nextBtn.textContent = 'Next →';
        nextBtn.className = 'btn btn-primary';
        nextBtn.onclick = () => this.next();
      }
    }
  },

  next() {
    if (this.currentIdx < this.questions.length - 1) {
      this.currentIdx++;
      this.visited.add(this.currentIdx);
      this.renderQuestion();
    }
  },

  prev() {
    if (this.currentIdx > 0) {
      this.currentIdx--;
      this.visited.add(this.currentIdx);
      this.renderQuestion();
    }
  },

  goTo(idx) {
    this.currentIdx = idx;
    this.visited.add(idx);
    this.renderQuestion();
  },

  async confirmSubmit() {
    const answered = Object.keys(this.answers).length;
    const unanswered = this.questions.length - answered;
    const msg = unanswered > 0
      ? `⚠️ You have ${unanswered} unanswered question${unanswered > 1 ? 's' : ''}.\n\nAre you sure you want to submit?`
      : '✅ All questions answered. Finalize your exam?';

    if (confirm(msg)) {
      await this.submit();
    }
  },

  isSubmitting: false,

  async submit(isForced = false) {
    if (this.isSubmitting) return;
    
    if (isForced) {
      notifications.error('🚨 AUTO-SUBMITTING: Security protocol breach detected.');
    }

    this.isSubmitting = true;
    try {
      // ── 1. Stop the proctoring immediately but DON'T destroy yet ──
      if (typeof ExamTimer !== 'undefined') ExamTimer.stop();
      
      const payload = {
        sessionId: this.sessionId,
        answers: Object.entries(this.answers).map(([qId, label]) => ({
          questionId: qId,
          selectedOption: label
        })),
        timeTaken: Math.floor((Date.now() - this.startTime) / 1000),
        violations: Proctor.violations.length,
        violationHistory: Proctor.violations
      };

      const result = await api.post('/portal/student/exams/submit', payload);
      if (!result.success) throw new Error(result.message);

      // ── 2. Show Result View FIRST (Prevents Black Screen) ──
      const d = result.data;
      const mainContent = document.getElementById('main-exam-content');
      const finishView = document.getElementById('finish-view');
      const resultContainer = document.getElementById('result-container');

      if (mainContent) mainContent.style.display = 'none';
      if (finishView) {
        finishView.style.display = 'flex';
        resultContainer.innerHTML = `
          <div style="font-size:64px; margin-bottom:16px;">${d.isPassed ? '🎉' : '📋'}</div>
          <h1 style="font-size:26px; font-weight:800; color:#1e293b; margin-bottom:8px;">Exam ${isForced ? 'Terminated' : 'Submitted'}!</h1>
          <p style="color:#64748b; margin-bottom:32px; font-size:15px;">Your answers have been recorded and graded.</p>

          <div style="display:flex; justify-content:center; gap:24px; margin-bottom:28px;">
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px; padding:20px 28px;">
              <div style="font-size:42px; font-weight:800; color:${d.isPassed ? '#16a34a' : '#dc2626'};">${d.percentage}%</div>
              <div style="font-size:12px; color:#94a3b8; margin-top:4px; font-weight:600; text-transform:uppercase; letter-spacing:1px;">Score</div>
            </div>
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px; padding:20px 28px;">
              <div style="font-size:42px; font-weight:800; color:#2563eb;">${d.correctCount}/${d.totalQuestions}</div>
              <div style="font-size:12px; color:#94a3b8; margin-top:4px; font-weight:600; text-transform:uppercase; letter-spacing:1px;">Correct</div>
            </div>
          </div>

          <div style="display:inline-flex; align-items:center; gap:8px; padding:10px 24px; border-radius:100px; font-weight:700; font-size:15px; margin-bottom:32px; background:${d.isPassed ? '#ecfdf5' : '#fef2f2'}; color:${d.isPassed ? '#16a34a' : '#dc2626'}; border:1.5px solid ${d.isPassed ? '#86efac' : '#fca5a5'};">
            ${d.isPassed ? '✅ PASSED' : '❌ FAILED'}
          </div>

          <div style="display:flex; flex-direction:column; gap:12px;">
            <a href="/result.html?resultId=${d.resultId}" style="display:block; padding:14px; background:#4f46e5; color:#fff; border-radius:12px; text-decoration:none; font-weight:700; font-size:15px; transition:all 0.2s;">
              📋 View Detailed Results
            </a>
            <a href="/index.html" style="display:block; padding:12px; background:#f8fafc; color:#475569; border-radius:12px; text-decoration:none; font-weight:600; font-size:14px; border:1px solid #e2e8f0;">
              🏠 Return to Dashboard
            </a>
          </div>

          <p style="margin-top:24px; font-size:12px; color:#94a3b8;">🔒 Your result has been sealed to the blockchain.</p>
        `;
      }

      // ── 3. FINALLY Cleanup Proctoring ──
      setTimeout(() => {
        if (typeof Proctor !== 'undefined') Proctor.destroy();
        document.body.style.filter = 'none';
        document.documentElement.style.filter = 'none';
      }, 500);

    } catch (err) {
      this.isSubmitting = false;
      notifications.error('Submission failed: ' + err.message);
    }
  },

  autoSubmit() {
    notifications.warn('⏰ Time is up! Submitting your exam...');
    this.submit();
  },

  setupProctoring() {
    if (typeof Proctor !== 'undefined') {
      Proctor.init(this.sessionId, this.examData || {});
    }
  },

  _zoomImage(src) {
    const overlay = document.createElement('div');
    overlay.className = 'image-zoom-overlay';
    overlay.innerHTML = `
      <div class="image-zoom-backdrop" onclick="this.parentElement.remove()"></div>
      <div class="image-zoom-content">
        <img src="${src}" alt="Zoomed Image">
        <button class="image-zoom-close" onclick="this.closest('.image-zoom-overlay').remove()">✕</button>
      </div>
    `;
    document.body.appendChild(overlay);
  },

  _escapeHtml(text) {
    if (!text) return '';
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
  }
};

window.ExamEngine = ExamEngine;
