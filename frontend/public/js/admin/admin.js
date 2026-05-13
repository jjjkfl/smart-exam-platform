/**
 * js/admin/admin.js
 */

const AdminDashboard = {
  users: [],
  courses: [],
  pollingInterval: null,

  async init() {
    if (!auth.checkAuth()) return;

    Navbar.render('nav-container', 'dashboard');

    // Initial loads
    await this.loadDashboardData();
    await this.loadUsers();
    await this.loadCourses();

    // Poll overview every 5 seconds
    this.pollingInterval = setInterval(() => this.loadDashboardData(), 5000);
  },

  switchTab(tabId) {
    document.getElementById('tab-overview').style.display = 'none';
    document.getElementById('tab-users').style.display = 'none';
    document.getElementById('tab-courses').style.display = 'none';

    document.getElementById(`tab-${tabId}`).style.display = 'block';
  },

  async loadDashboardData() {
    try {
      const res = await api.get('/portal/admin/dashboard');
      if (res.success) {
        this.renderMetrics(res.data.stats);
        this.renderGlobalSessions(res.data.recentSessions);
      }
    } catch (e) {
      console.error('Failed to load admin overview', e);
    }
  },

  renderMetrics(stats) {
    document.getElementById('metric-teachers').querySelector('.metric-value').textContent = stats.totalTeachers || 0;
    document.getElementById('metric-students').querySelector('.metric-value').textContent = stats.totalStudents || 0;
    document.getElementById('metric-courses').querySelector('.metric-value').textContent = stats.totalCourses || 0;
    document.getElementById('metric-active').querySelector('.metric-value').textContent = stats.activeSessions || 0;
  },

  renderGlobalSessions(sessions) {
    const tbody = document.getElementById('global-sessions');
    if (!sessions || sessions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;" class="p-dim">No sessions found</td></tr>';
      return;
    }

    tbody.innerHTML = sessions.map(s => `
      <tr>
        <td>${s.title}</td>
        <td>${s.courseId ? s.courseId.courseName : 'N/A'}</td>
        <td>${s.division}</td>
        <td>${utils.formatDate(s.startTime)}</td>
        <td><span class="status-pill ${s.status === 'active' ? 'active' : 'inactive'}">${s.status.toUpperCase()}</span></td>
      </tr>
    `).join('');
  },

  // ==============================
  // USER CRUD
  // ==============================
  async loadUsers() {
    try {
      const res = await api.get('/portal/admin/users');
      if (res.success) {
        this.users = res.data;
        this.renderUsers();
      }
    } catch (e) { console.error('Failed to load users'); }
  },

  renderUsers() {
    const tbody = document.getElementById('users-list');
    if (this.users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;" class="p-dim">No users found</td></tr>';
      return;
    }

    tbody.innerHTML = this.users.map(u => `
      <tr>
        <td>${u.name}</td>
        <td>${u.email}</td>
        <td><span class="badge" style="background:#f1f5f9; color:#64748b; font-size:11px;">${u.role.toUpperCase()}</span></td>
        <td>${u.role === 'student' ? (u.courseId ? u.courseId.courseName : 'N/A') + ' (Div ' + u.division + ')' : 'N/A'}</td>
        <td>
          <button onclick="AdminDashboard.showEditUserModal('${u._id}')" class="btn btn-secondary btn-sm"><i class="fas fa-edit"></i></button>
          <button onclick="AdminDashboard.deleteUser('${u._id}')" class="btn btn-secondary btn-sm" style="color:var(--danger);"><i class="fas fa-trash"></i></button>
        </td>
      </tr>
    `).join('');
  },

  async deleteUser(id) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      const res = await api.delete(`/portal/admin/users/${id}`);
      if (res.success) {
        notifications.success('User deleted');
        this.loadUsers();
      }
    } catch (e) {
      notifications.error('Failed to delete user');
    }
  },

  // Modals for Create/Edit User would go here (using Modal.show)
  showCreateUserModal() {
    Modal.show('create-user', `
      <form onsubmit="AdminDashboard.handleCreateUser(event)">
        <div class="form-group">
          <label>Name</label>
          <input type="text" name="name" class="form-control" required>
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" name="email" class="form-control" required>
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" name="password" class="form-control" required>
        </div>
        <div class="form-group">
          <label>Role</label>
          <select name="role" class="form-control" required>
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
          </select>
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%; margin-top:16px;">Create User</button>
      </form>
    `, { title: 'Create New User' });
  },

  async handleCreateUser(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    try {
      const res = await api.post('/portal/admin/users', data);
      if (res.success) {
        Modal.hide();
        notifications.success('User created successfully');
        this.loadUsers();
      }
    } catch (err) {
      notifications.error('Failed to create user');
    }
  },

  showEditUserModal(id) {
    const user = this.users.find(u => u._id === id);
    if (!user) return;

    Modal.show('edit-user', `
      <form onsubmit="AdminDashboard.handleEditUser(event, '${id}')">
        <div class="form-group">
          <label>Name</label>
          <input type="text" name="name" class="form-control" value="${user.name}" required>
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" name="email" class="form-control" value="${user.email}" required>
        </div>
        <div class="form-group">
          <label>Role</label>
          <select name="role" class="form-control" required>
            <option value="student" ${user.role === 'student' ? 'selected' : ''}>Student</option>
            <option value="teacher" ${user.role === 'teacher' ? 'selected' : ''}>Teacher</option>
          </select>
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%; margin-top:16px;">Update User</button>
      </form>
    `, { title: 'Edit User' });
  },

  async handleEditUser(e, id) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    try {
      const res = await api.put(`/portal/admin/users/${id}`, data);
      if (res.success) {
        Modal.hide();
        notifications.success('User updated successfully');
        this.loadUsers();
      }
    } catch (err) {
      notifications.error('Failed to update user');
    }
  },

  // ==============================
  // COURSE CRUD
  // ==============================
  async loadCourses() {
    try {
      const res = await api.get('/portal/admin/courses');
      if (res.success) {
        this.courses = res.data;
        this.renderCourses();
      }
    } catch (e) { console.error('Failed to load courses'); }
  },

  renderCourses() {
    const tbody = document.getElementById('courses-list');
    if (this.courses.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;" class="p-dim">No courses found</td></tr>';
      return;
    }

    tbody.innerHTML = this.courses.map(c => `
      <tr>
        <td>${c.courseName}</td>
        <td>${c.teacherId ? c.teacherId.name : 'Unassigned'}</td>
        <td>${utils.formatDate(c.createdAt)}</td>
        <td>
          <button onclick="AdminDashboard.showEditCourseModal('${c._id}')" class="btn btn-secondary btn-sm"><i class="fas fa-edit"></i></button>
          <button onclick="AdminDashboard.deleteCourse('${c._id}')" class="btn btn-secondary btn-sm" style="color:var(--danger);"><i class="fas fa-trash"></i></button>
        </td>
      </tr>
    `).join('');
  },

  async deleteCourse(id) {
    if (!confirm('Are you sure you want to delete this course?')) return;
    try {
      const res = await api.delete(`/ portal / admin / courses / ${id} `);
      if (res.success) {
        notifications.success('Course deleted');
        this.loadCourses();
      }
    } catch (e) {
      notifications.error('Failed to delete course');
    }
  },

  showCreateCourseModal() {
    // Populate teacher dropdown
    const teachers = this.users.filter(u => u.role === 'teacher');
    const teacherOptions = teachers.map(t => `< option value = "${t._id}" > ${t.name} (${t.email})</option > `).join('');

    Modal.show('create-course', `
  < form onsubmit = "AdminDashboard.handleCreateCourse(event)" >
        <div class="form-group">
          <label>Course Name</label>
          <input type="text" name="courseName" class="form-control" required>
        </div>
        <div class="form-group">
          <label>Assign Teacher</label>
          <select name="teacherId" class="form-control" required>
            ${teacherOptions}
          </select>
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%; margin-top:16px;">Create Course</button>
      </form >
  `, { title: 'Create New Course' });
  },

  async handleCreateCourse(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    try {
      const res = await api.post('/portal/admin/courses', data);
      if (res.success) {
        Modal.hide();
        notifications.success('Course created successfully');
        this.loadCourses();
        this.loadUsers(); // Refresh users to show course assignment
      }
    } catch (err) {
      notifications.error('Failed to create course');
    }
  },

  showEditCourseModal(id) {
    const course = this.courses.find(c => c._id === id);
    if (!course) return;

    const teachers = this.users.filter(u => u.role === 'teacher');
    const teacherOptions = teachers.map(t =>
      `< option value = "${t._id}" ${course.teacherId && course.teacherId._id === t._id ? 'selected' : ''}> ${t.name} (${t.email})</option > `
    ).join('');

    Modal.show('edit-course', `
  < form onsubmit = "AdminDashboard.handleEditCourse(event, '${id}')" >
        <div class="form-group">
          <label>Course Name</label>
          <input type="text" name="courseName" class="form-control" value="${course.courseName}" required>
        </div>
        <div class="form-group">
          <label>Assign Teacher</label>
          <select name="teacherId" class="form-control" required>
            ${teacherOptions}
          </select>
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%; margin-top:16px;">Update Course</button>
      </form >
  `, { title: 'Edit Course' });
  },

  async handleEditCourse(e, id) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    try {
      const res = await api.put(`/portal/admin/courses/${id}`, data);
      if (res.success) {
        Modal.hide();
        notifications.success('Course updated successfully');
        this.loadCourses();
        this.loadUsers();
      }
    } catch (err) {
      notifications.error('Failed to update course');
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  AdminDashboard.init();
});
