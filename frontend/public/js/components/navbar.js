/**
 * js/components/navbar.js
 * Dynamic Navbar Component
 */

const Navbar = {
  render(containerId, activeLink = '') {
    const user = auth.getUser();
    if (!user) return;

    const container = document.getElementById(containerId);
    if (!container) return;

    const navHtml = `
      <nav class="glass-card" style="padding: 12px 24px; margin-bottom: 40px; display: flex; justify-content: space-between; align-items: center; border-radius: var(--radius-md); border: 1px solid rgba(255,255,255,0.4); margin-top: 10px;">
        <div class="flex-center" style="gap: 32px;">
          <div style="font-weight: 800; font-size: 22px; letter-spacing: -1px; display: flex; align-items: center; gap: 8px;">
            <div style="width: 32px; height: 32px; background: var(--gradient-primary); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-size: 16px;">M</div>
            <span>MCQ<span style="color: #0ea5e9">PRO</span></span>
          </div>
          <div class="flex-center" style="gap: 24px;">
            ${user.role === 'student' ? `
              <a href="/index.html" class="nav-link ${activeLink === 'dashboard' ? 'active' : ''}">Dashboard</a>
              <a href="/index.html?view=courses" class="nav-link ${activeLink === 'courses' ? 'active' : ''}">Courses</a>
              <a href="/index.html?view=forum" class="nav-link ${activeLink === 'forum' ? 'active' : ''}">Forum</a>
              <a href="/index.html?view=exam-results" class="nav-link ${activeLink === 'results' ? 'active' : ''}">Results</a>
            ` : `
              <a href="/teacher.html" class="nav-link ${activeLink === 'dashboard' ? 'active' : ''}">Dashboard</a>
              <a href="/teacher.html?view=materials" class="nav-link ${activeLink === 'materials' ? 'active' : ''}">Courses</a>
              <a href="/teacher.html?view=students" class="nav-link ${activeLink === 'students' ? 'active' : ''}">Students</a>
              <a href="/teacher.html?view=forum" class="nav-link ${activeLink === 'forum' ? 'active' : ''}">Forum</a>
              <a href="/teacher.html?view=analytics-all" class="nav-link ${activeLink === 'analytics' ? 'active' : ''}">Analytics</a>
            `}
          </div>
        </div>
        <div class="flex-center" style="gap: 20px;">
          <button onclick="document.body.toggleAttribute('data-theme', document.body.hasAttribute('data-theme') ? '' : 'dark')" 
            class="btn-ghost" style="padding: 8px; border-radius: 50%; font-size: 18px;">🌓</button>
          
          <div style="display: flex; align-items: center; gap: 12px; padding: 6px 12px; background: rgba(0,0,0,0.03); border-radius: 12px;">
            <div style="text-align: right">
              <div style="font-size: 13px; font-weight: 700; color: var(--text-main);">${user.name}</div>
              <div style="font-size: 10px; font-weight: 800; color: #8b5cf6; text-transform: uppercase; letter-spacing: 0.5px;">${user.role}</div>
            </div>
            <div class="avatar-sm" style="background: var(--gradient-primary); font-size: 12px;">${user.name[0]}</div>
          </div>
          
          <button onclick="auth.logout()" class="btn btn-secondary" style="padding: 8px 16px; font-size: 12px; border-radius: 10px;">
            <i class="fas fa-sign-out-alt"></i> Logout
          </button>
        </div>
      </nav>
      <style>
        .nav-link {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-secondary);
          text-decoration: none;
          transition: var(--transition-base);
          position: relative;
          padding: 4px 0;
        }
        .nav-link:hover {
          color: var(--text-main);
        }
        .nav-link.active {
          color: #0ea5e9;
        }
        .nav-link.active::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 0;
          width: 100%;
          height: 2px;
          background: #0ea5e9;
          border-radius: 2px;
        }
      </style>
    `;

    container.innerHTML = navHtml;
    // Highlight active link
    const links = container.querySelectorAll('a');
    links.forEach(l => {
      if (l.classList.contains('active')) l.style.color = 'var(--primary)';
      else l.style.color = 'var(--text-main)';
      l.style.opacity = l.classList.contains('active') ? '1' : '0.6';
    });
  }
};

window.Navbar = Navbar;
