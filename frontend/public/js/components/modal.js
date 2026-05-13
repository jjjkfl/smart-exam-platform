/**
 * js/components/modal.js
 * Apple-style Modal Component
 */

const Modal = {
  activeModal: null,

  show(id, contentHtml, options = {}) {
    this.close();

    const overlay = document.createElement('div');
    overlay.id = `modal-overlay-${id}`;
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(8px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;

    const modal = document.createElement('div');
    modal.className = 'card';
    modal.style.cssText = `
      width: 90%;
      max-width: ${options.width || '500px'};
      max-height: 90vh;
      overflow-y: auto;
      background: var(--bg-card, #ffffff);
      border-radius: var(--radius-lg, 16px);
      padding: 32px;
      transform: scale(0.9) translateY(20px);
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: var(--shadow-xl, 0 20px 40px rgba(0,0,0,0.2));
    `;

    modal.innerHTML = `
      <div class="flex-between" style="margin-bottom: 24px; position: sticky; top: 0; background: var(--bg-card, #ffffff); z-index: 10; padding-bottom: 8px;">
        <h3 class="h3" style="margin: 0;">${options.title || ''}</h3>
        <button onclick="Modal.close()" style="background: transparent; border: none; font-size: 28px; line-height: 1; cursor: pointer; color: var(--text-muted, #666); transition: opacity 0.2s; padding: 0;">&times;</button>
      </div>
      <div class="modal-body">${contentHtml}</div>
      ${options.footer ? `<div class="modal-footer" style="margin-top: 32px; display:flex; gap:12px; justify-content:flex-end;">${options.footer}</div>` : ''}
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Trigger animation
    setTimeout(() => {
      overlay.style.opacity = '1';
      modal.style.transform = 'scale(1) translateY(0)';
    }, 10);

    this.activeModal = overlay;
  },

  close() {
    if (this.activeModal) {
      const modal = this.activeModal.firstChild;
      this.activeModal.style.opacity = '0';
      modal.style.transform = 'scale(0.9) translateY(20px)';
      setTimeout(() => {
        this.activeModal.remove();
        this.activeModal = null;
      }, 300);
    }
  }
};

window.Modal = Modal;
