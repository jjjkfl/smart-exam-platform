/**
 * js/components/chart.js
 * Charting component wrapper (requires Chart.js)
 */

const Charts = {
  /**
   * Create a bar chart for grade distribution
   */
  renderGrades(canvasId, data) {
    const ctx = document.getElementById(canvasId);
    if (!ctx || !window.Chart) return;

    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: Object.keys(data),
        datasets: [{
          label: 'Students',
          data: Object.values(data),
          backgroundColor: 'rgba(0, 113, 227, 0.5)',
          borderColor: '#0071e3',
          borderWidth: 1,
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#86868b' }
          },
          x: {
            grid: { display: false },
            ticks: { color: '#86868b' }
          }
        }
      }
    });
  },

  /**
   * Create a line chart for performance trends
   */
  renderTrend(canvasId, labels, data) {
    const ctx = document.getElementById(canvasId);
    if (!ctx || !window.Chart) return;

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          borderColor: '#2997ff',
          backgroundColor: 'rgba(41, 151, 255, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: '#2997ff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#86868b' } },
          x: { grid: { display: false }, ticks: { color: '#86868b' } }
        }
      }
    });
  }
};

window.Charts = Charts;
