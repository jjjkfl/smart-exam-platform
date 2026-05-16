/**
 * js/shared/auth.js
 * Authentication and Session Management
 */

const auth = {
  /**
   * Login user and save token
   */
  async login(email, password) {
    try {
      const result = await api.post('/auth/login', { email, password });
      this.setSession(result.accessToken, result.user);
      this.redirectByRole(result.user.role);
    } catch (error) {
      throw error;
    }
  },

  /**
   * Register user
   */
  async register(userData) {
    try {
      const result = await api.post('/auth/register', userData);
      this.setSession(result.accessToken, result.user);
      this.redirectByRole(result.user.role);
    } catch (error) {
      throw error;
    }
  },

  setSession(token, user) {
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('user', JSON.stringify(user));
  },

  getUser() {
    const user = sessionStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  getToken() {
    return sessionStorage.getItem('token');
  },

  isAuthenticated() {
    return !!this.getToken();
  },

  logout() {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    // Use replace to prevent the user from clicking "Back" to a logged-out session
    window.location.replace('/login.html');
  },

  redirectByRole(role) {
    if (role === 'teacher') {
      window.location.replace('/teacher.html');
    } else if (role === 'admin') {
      window.location.replace('/admin.html');
    } else {
      window.location.replace('/index.html');
    }
  },

  /**
   * Route protection check with role-based redirection
   */
  checkAuth() {
    if (!this.isAuthenticated()) {
      window.location.href = '/login.html';
      return false;
    }

    const user = this.getUser();
    if (!user) {
      this.logout();
      return false;
    }

    const path = window.location.pathname;

    // Prevent student from accessing teacher dashboard
    if (path.includes('teacher') && user.role !== 'teacher') {
      this.redirectByRole(user.role);
      return false;
    }

    // Prevent teacher/admin from accessing student dashboard
    if ((path === '/' || path.includes('index.html') || path === '/student' || path === '/student/')
      && user.role !== 'student') {
      this.redirectByRole(user.role);
      return false;
    }

    return true;
  }
};

// Prevent back/forward cache (Bfcache) from bypassing authentication
window.addEventListener('pageshow', function (event) {
  // If the page is loaded from cache (e.g., via back button)
  if (event.persisted) {
    if (!auth.isAuthenticated()) {
      window.location.replace('/login.html');
    }
  }
});

window.auth = auth;
