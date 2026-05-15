/**
 * js/student/privacyGuard.js
 * Advanced Active Anti-Cheating & Privacy Guard v3.0
 */

const PrivacyGuard = {
    overlay: null,
    watermark: null,
    isLocked: false,
    studentId: 'Student',

    init(email) {
        this.studentId = email || 'Secure Session';
        this.overlay = document.getElementById('security-lock-overlay');
        this.watermark = document.getElementById('watermark-container');
        
        this.setupWatermark();
        this.setupListeners();
        this.startHealthCheck();
        
        console.log('🛡️ PrivacyGuard: v3.0 Active');
    },

    setupWatermark() {
        if (!this.watermark) return;
        this.watermark.innerHTML = '';
        // Create a grid of watermark items
        for (let i = 0; i < 40; i++) {
            const span = document.createElement('span');
            span.className = 'watermark-item';
            span.textContent = this.studentId;
            this.watermark.appendChild(span);
        }
    },

    setupListeners() {
        // Detect window blur (Alt-Tab, Switching Windows)
        window.addEventListener('blur', () => this.lock('Window focus lost. Screenshot protection active.'));
        
        // Resume button logic
        const resumeBtn = document.getElementById('btn-resume-security');
        if (resumeBtn) {
            resumeBtn.onclick = () => this.unlock();
        }

        // Block context menu
        document.addEventListener('contextmenu', (e) => e.preventDefault());

        // Block PrintScreen / Win+Shift+S / F12
        document.addEventListener('keydown', (e) => {
            if (e.key === 'PrintScreen' || (e.metaKey && e.shiftKey && e.key === 'S')) {
                this.lock('Screenshot attempt detected.');
                navigator.clipboard.writeText('[SECURITY BLOCK: Content Protected]');
            }
            if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
                e.preventDefault();
            }
        });
    },

    lock(reason) {
        if (this.isLocked) return;
        this.isLocked = true;
        
        if (this.overlay) {
            document.getElementById('lock-msg').textContent = reason || 'Security protocol active.';
            this.overlay.style.display = 'flex';
        }
        document.body.classList.add('blur-active');

        // Start exposure ruiner loop (50ms interval)
        this.exposureInterval = setInterval(() => this.ruinExposure(), 50);
        
        // Log violation via existing proctoring if available
        if (window.ProctorEngine) {
            window.ProctorEngine.logViolation('PrivacyGuard Lock', reason);
        }
    },

    unlock() {
        this.isLocked = false;
        if (this.overlay) this.overlay.style.display = 'none';
        document.body.classList.remove('blur-active');
        
        const main = document.getElementById('main-exam-content');
        if (main) main.style.filter = 'none';
        
        if (this.exposureInterval) {
            clearInterval(this.exposureInterval);
            this.exposureInterval = null;
        }
    },

    // Bridge with Proctoring Engine (proctor.js)
    startHealthCheck() {
        setInterval(() => {
            // Respect Teacher settings: Only lock if camera is REQUIRED
            const requiresCamera = window.ExamEngine && window.ExamEngine.examData && window.ExamEngine.examData.requireCamera !== false;
            
            const cameraStatus = document.getElementById('camera-status-label');
            if (requiresCamera && cameraStatus && cameraStatus.textContent === 'OFF' && !this.isLocked) {
                if (window.ExamEngine && window.ExamEngine.examStarted) {
                    this.lock('Camera feed lost. Content hidden for security.');
                }
            }
        }, 1000);
    },

    // RUIN EXPOSURE for mobile cameras
    ruinExposure() {
        if (!this.isLocked) return;
        const main = document.getElementById('main-exam-content');
        if (main) {
            // Rapidly shift brightness to blow out mobile camera exposure
            main.style.filter = `blur(40px) brightness(${Math.random() > 0.5 ? 2.0 : 0.2})`;
        }
    }
};

window.PrivacyGuard = PrivacyGuard;
