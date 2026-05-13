/**
 * js/teacher/analytics.js
 * Exam Data Analytics — Results view with stats + student results table
 */

const Analytics = {
  async init(sessionId) {
    try {
      const { data } = await api.get(`/portal/teacher/sessions/${sessionId}/results`);
      const normalized = this.normalizePayload(data);
      this.renderOverview(normalized.stats, normalized.sessionTitle);
      this.renderResultsTable(normalized.results);
      this.renderCharts(normalized.stats);
    } catch (err) {
      console.error('Analytics error:', err);
      notifications.error('Failed to load analytics: ' + (err.message || ''));
    }
  },

  normalizePayload(data) {
    const rawResults = (data && data.results) || [];
    const results = rawResults.map((r) => {
      const score = Number(r.score || 0);
      const totalQuestions = Number(r.totalQuestions || 0);
      const correctCount = Number(r.correctCount || Math.round((score / 100) * (totalQuestions || 0)));
      const isPassed = score >= 60;
      let grade = 'F';
      if (score >= 90) grade = 'A';
      else if (score >= 80) grade = 'B';
      else if (score >= 70) grade = 'C';
      else if (score >= 60) grade = 'D';

      return {
        studentName: r.studentId?.name || 'Student',
        studentEmail: r.studentId?.email || '',
        score,
        totalQuestions,
        correctCount,
        timeTaken: Number(r.timeTaken || 0),
        violations: Number(r.violationCount || r.violations || 0),
        violationHistory: r.violationHistory || [],
        isPassed,
        grade
      };
    });

    const scores = results.map(r => r.score);
    const total = results.length;
    const passed = results.filter(r => r.isPassed).length;
    const avgPercent = total ? (scores.reduce((a, b) => a + b, 0) / total).toFixed(1) : 0;
    const highScore = total ? Math.max(...scores) : 0;
    const lowScore = total ? Math.min(...scores) : 0;

    const gradeBreakdown = {
      A: results.filter(r => r.grade === 'A').length,
      B: results.filter(r => r.grade === 'B').length,
      C: results.filter(r => r.grade === 'C').length,
      D: results.filter(r => r.grade === 'D').length,
      F: results.filter(r => r.grade === 'F').length
    };

    return {
      sessionTitle: data.sessionTitle || 'Session',
      results,
      stats: { total, passed, avgPercent, highScore, lowScore, gradeBreakdown }
    };
  },

  renderOverview(stats, title) {
    const container = document.getElementById('analytics-overview');
    const passRate = stats.total > 0 ? ((stats.passed / stats.total) * 100).toFixed(1) : '0.0';

    container.innerHTML = `
      <div style="margin-bottom: 24px;">
        <h2 class="h2">${title || 'Session'} — Results</h2>
        <p class="p-dim">${stats.total} student${stats.total !== 1 ? 's' : ''} submitted</p>
      </div>
      <div class="metrics-grid">
        <div class="glass-card metric-card">
          <p class="p-dim">Pass Rate</p>
          <div class="metric-value">${passRate}%</div>
          <p class="p-dim" style="font-size:12px">${stats.passed || 0} of ${stats.total || 0} Passed</p>
        </div>
        <div class="glass-card metric-card">
          <p class="p-dim">Average Score</p>
          <div class="metric-value">${stats.avgPercent || 0}%</div>
        </div>
        <div class="glass-card metric-card">
          <p class="p-dim">Highest Score</p>
          <div class="metric-value" style="color: var(--success)">${stats.highScore || 0}%</div>
        </div>
        <div class="glass-card metric-card">
          <p class="p-dim">Lowest Score</p>
          <div class="metric-value" style="color: var(--danger)">${stats.lowScore || 0}%</div>
        </div>
      </div>
    `;
  },

  renderResultsTable(results) {
    // Insert a table after the overview
    const overview = document.getElementById('analytics-overview');

    // Remove old table if exists
    const oldTable = document.getElementById('results-table-section');
    if (oldTable) oldTable.remove();

    if (!results || results.length === 0) {
      const section = document.createElement('div');
      section.id = 'results-table-section';
      section.innerHTML = `
        <div class="glass-card" style="margin-top: 24px; padding: 40px; text-align: center;">
          <p class="p-dim">No student submissions yet.</p>
        </div>
      `;
      overview.after(section);
      return;
    }

    const formatTime = (s) => {
      const m = Math.floor(s / 60);
      const sec = s % 60;
      return `${m}m ${sec}s`;
    };

    const section = document.createElement('div');
    section.id = 'results-table-section';
    section.innerHTML = `
      <div class="glass-card" style="margin-top: 24px;">
        <h3 class="h3" style="margin-bottom: 20px;">Student Results</h3>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Student</th>
                <th>Score</th>
                <th>Correct</th>
                <th>Time</th>
                <th>Violations</th>
                <th>Grade</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${results.map((r, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>
                    <div style="font-weight:600">${r.studentName}</div>
                    <div class="p-dim" style="font-size:11px">${r.studentEmail}</div>
                  </td>
                  <td style="font-weight:700; color:${r.isPassed ? 'var(--success)' : 'var(--danger)'}">${r.score}%</td>
                  <td>${r.correctCount}/${r.totalQuestions}</td>
                  <td>${formatTime(r.timeTaken)}</td>
                  <td>
                    ${r.violations > 0
        ? `<span class="status-pill status-warning" style="cursor:help" 
                              title="${r.violationHistory.map(v => `${v.type}: ${v.detail}`).join('\n')}">
                           ⚠️ ${r.violations}
                         </span>`
        : '<span class="p-dim">0</span>'}
                  </td>
                  <td><strong>${r.grade}</strong></td>
                  <td>
                    <span class="status-pill ${r.isPassed ? 'status-online' : 'status-offline'}">
                      ${r.isPassed ? 'PASSED' : 'FAILED'}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    overview.after(section);
  },

  renderCharts(stats) {
    if (typeof Charts !== 'undefined') {
      Charts.renderGrades('grade-distribution-chart', stats.gradeBreakdown);
    }
  }
};

window.Analytics = Analytics;
