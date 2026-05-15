/**
 * js/components/chart.js
 * Premium Charting Component — Vertical Bar Charts with Animations
 */

const Charts = {

  /**
   * Render a premium vertical Grade Distribution bar chart
   * Works with or without Chart.js — falls back to CSS-rendered bars
   */
  renderGrades(canvasId, data, horizontal = true) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    // --- Preferred: Chart.js with premium config ---
    if (window.Chart) {
      const existingChart = Chart.getChart(ctx);
      if (existingChart) existingChart.destroy();

      const grades = ['A', 'B', 'C', 'D', 'F'];
      const values = grades.map(g => (data && data[g] != null ? data[g] : 0));
      const total = values.reduce((s, v) => s + v, 0) || 1;

      const colors = {
        A: { bg: 'rgba(16,185,129,0.85)',  border: '#059669' },
        B: { bg: 'rgba(59,130,246,0.85)',  border: '#2563eb' },
        C: { bg: 'rgba(245,158,11,0.85)',  border: '#d97706' },
        D: { bg: 'rgba(249,115,22,0.85)',  border: '#ea580c' },
        F: { bg: 'rgba(239,68,68,0.85)',   border: '#dc2626' },
      };

      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: grades.map(g => {
            const pct = Math.round((values[grades.indexOf(g)] / total) * 100);
            return horizontal ? `${g} (${pct}%)` : g;
          }),
          datasets: [{
            label: 'Students',
            data: values,
            backgroundColor: grades.map(g => colors[g].bg),
            borderColor: grades.map(g => colors[g].border),
            borderWidth: 2,
            borderRadius: horizontal ? 6 : { topLeft: 8, topRight: 8 },
            borderSkipped: false,
            maxBarThickness: horizontal ? 16 : 20, // Even thinner "needle" bars
            barPercentage: 0.5,
          }]
        },
        options: {
          indexAxis: horizontal ? 'y' : 'x',
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            duration: 900,
            easing: 'easeOutQuart'
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#1e293b',
              titleColor: '#f8fafc',
              bodyColor: '#94a3b8',
              padding: 12,
              cornerRadius: 10,
              callbacks: {
                label: (context) => ` ${context.raw} Students (${Math.round((context.raw / total) * 100)}%)`
              }
            }
          },
          scales: {
            x: {
              beginAtZero: true,
              grid: { color: 'rgba(148,163,184,0.08)', drawBorder: false },
              ticks: {
                color: '#94a3b8',
                font: { size: horizontal ? 11 : 12, weight: horizontal ? '400' : '700' },
                padding: 8
              },
              border: { display: false }
            },
            y: {
              beginAtZero: true,
              grid: { color: horizontal ? 'transparent' : 'rgba(148,163,184,0.08)', drawBorder: false },
              ticks: {
                color: horizontal ? '#1e293b' : '#94a3b8',
                font: { size: horizontal ? 13 : 12, weight: horizontal ? '800' : '500' },
                padding: 10,
                precision: 0 // Whole numbers only for student counts
              },
              border: { display: false }
            }
          }
        }
      });
      return;
    }

    // --- Fallback: CSS-rendered vertical bars (no Chart.js needed) ---
    const grades = ['A', 'B', 'C', 'D', 'F'];
    const values = grades.map(g => (data && data[g] != null ? data[g] : 0));
    const max = Math.max(...values, 1);

    const colors = {
      A: { bar: '#10b981', bg: '#ecfdf5', label: '#065f46' },
      B: { bar: '#3b82f6', bg: '#eff6ff', label: '#1d4ed8' },
      C: { bar: '#f59e0b', bg: '#fffbeb', label: '#b45309' },
      D: { bar: '#f97316', bg: '#fff7ed', label: '#c2410c' },
      F: { bar: '#ef4444', bg: '#fef2f2', label: '#b91c1c' },
    };

    const container = ctx.parentElement;
    container.style.cssText = 'display:flex; flex-direction:column; gap:8px; height:auto; padding: 10px 0;';
    ctx.style.display = 'none';

    grades.forEach((g, i) => {
      const widthPct = Math.round((values[i] / max) * 100);
      const row = document.createElement('div');
      row.style.cssText = `display:flex; align-items:center; gap:12px; width:100%;`;

      row.innerHTML = `
        <div style="font-size:13px; font-weight:800; color:${colors[g].label}; width:40px; 
             background:${colors[g].bg}; padding:3px 0; text-align:center; border-radius:20px;">${g}</div>
        <div style="flex:1; height:12px; background:#f1f5f9; border-radius:10px; overflow:hidden;">
          <div style="width:${Math.max(widthPct, 2)}%; height:100%; background:${colors[g].bar}; border-radius:10px; transition:width 1s ease;"></div>
        </div>
        <div style="font-weight:700; font-size:12px; color:#64748b; width:20px; text-align:right;">${values[i]}</div>
      `;
      container.appendChild(row);
    });
  },

  /**
   * Create a premium line chart for performance trends
   */
  renderTrend(canvasId, labels, data) {
    const ctx = document.getElementById(canvasId);
    if (!ctx || !window.Chart) return;

    const existingChart = Chart.getChart(ctx);
    if (existingChart) existingChart.destroy();

    new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data,
          borderColor: '#6366f1',
          backgroundColor: (context) => {
            const chart = context.chart;
            const { ctx: c, chartArea } = chart;
            if (!chartArea) return 'transparent';
            const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, 'rgba(99,102,241,0.3)');
            gradient.addColorStop(1, 'rgba(99,102,241,0)');
            return gradient;
          },
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointBackgroundColor: '#6366f1',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 900, easing: 'easeOutQuart' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1e293b',
            titleColor: '#f8fafc',
            bodyColor: '#94a3b8',
            padding: 12,
            cornerRadius: 10
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(148,163,184,0.1)', drawBorder: false },
            ticks: { color: '#94a3b8', font: { size: 12 }, padding: 8 },
            border: { display: false }
          },
          x: {
            grid: { display: false },
            ticks: { color: '#64748b', font: { size: 12 }, padding: 8 },
            border: { display: false }
          }
        }
      }
    });
  }
};

window.Charts = Charts;
