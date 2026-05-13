const Loader = {
  show(containerId, message = 'Loading...') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = `
      <div class="loader-container animate-fade-in">
        <div class="loader-animation">
          <div class="loader__bar"></div>
          <div class="loader__bar"></div>
          <div class="loader__bar"></div>
          <div class="loader__bar"></div>
          <div class="loader__bar"></div>
          <div class="loader__ball"></div>
        </div>
        <p class="p-dim" style="font-weight: 600; margin-top: 10px;">${message}</p>
      </div>
    `;
  },

  hide(containerId) {
    const container = document.getElementById(containerId);
    if (container) container.innerHTML = '';
  }
};

window.Loader = Loader;
