/**
 * js/shared/notifications.js
 * Toast notification system
 */

const notifications = {
  container: null,

  init() {
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 12px;
    `;
    document.body.appendChild(this.container);
  },

  show(message, type = 'info', duration = 4000) {
    if (!this.container) this.init();

    const toast = document.createElement('div');
    toast.className = 'glass-card animate-fade-in';

    const colors = {
      success: '#34c759',
      error: '#ff3b30',
      info: '#0071e3',
      warning: '#ff9f0a'
    };

    toast.style.cssText = `
      padding: 14px 24px;
      min-width: 300px;
      border-left: 4px solid ${colors[type]};
      background: rgba(28, 28, 30, 0.95);
      color: #fff;
      backdrop-filter: blur(10px);
      box-shadow: 0 10px 40px rgba(0,0,0,0.4);
      font-size: 14px;
      font-weight: 500;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-radius: 12px;
    `;

    toast.innerHTML = `
      <span>${message}</span>
      <span style="cursor:pointer; opacity:0.5; font-size:18px" onclick="this.parentElement.remove()">×</span>
    `;

    this.container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      toast.style.transition = 'all 0.5s ease';
      setTimeout(() => toast.remove(), 500);
    }, duration);
  },

  success(msg) { this.show(msg, 'success'); },
  error(msg) { this.show(msg, 'error'); },
  info(msg) { this.show(msg, 'info'); },
  warn(msg) { this.show(msg, 'warning'); }
};

window.notifications = notifications;
