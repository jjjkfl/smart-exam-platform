/**
 * js/student/timer.js
 * Countdown timer for exams
 */

const ExamTimer = {
  interval: null,
  timeLeft: 0,
  callback: null,

  start(seconds, onComplete) {
    this.timeLeft = seconds;
    this.callback = onComplete;
    this.updateUI();

    this.interval = setInterval(() => {
      this.timeLeft--;
      this.updateUI();

      if (this.timeLeft <= 0) {
        this.stop();
        if (this.callback) this.callback();
      }
      
      // Visual warning at 5 minutes
      if (this.timeLeft === 300) {
        notifications.warn('5 minutes remaining!');
      }
    }, 1000);
  },

  sync(serverTimeLeft) {
    // Only sync if significant drift or first sync
    if (Math.abs(this.timeLeft - serverTimeLeft) > 5 || this.timeLeft === 0) {
      this.timeLeft = serverTimeLeft;
      this.updateUI();
    }
  },

  updateUI() {
    const el = document.getElementById('exam-timer');
    if (!el) return;
    
    el.innerText = utils.formatTime(this.timeLeft);
    
    if (this.timeLeft < 60) {
      el.style.color = 'var(--danger)';
      el.style.animation = 'pulse 1s infinite';
    }
  },

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
};

window.ExamTimer = ExamTimer;
