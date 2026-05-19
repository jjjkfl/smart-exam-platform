/**
 * js/shared/utils.js
 * Common utility functions
 */

const utils = {
  /**
   * Format date to Apple-style readable string
   */
  formatDate(dateString) {
    if (!dateString) return 'N/A';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return 'N/A';
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return d.toLocaleDateString('en-US', options);
  },

  /**
   * Format start and end datetime range using duration
   */
  formatDateTimeRange(startTime, durationMinutes) {
    if (!startTime) return 'N/A';
    const start = new Date(startTime);
    if (isNaN(start.getTime())) return 'N/A';
    
    const end = new Date(start.getTime() + (durationMinutes || 60) * 60 * 1000);
    if (isNaN(end.getTime())) return 'N/A';
    
    const dateOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: true };
    
    const dateStr = start.toLocaleDateString('en-US', dateOptions);
    const startStr = start.toLocaleTimeString('en-US', timeOptions);
    const endStr = end.toLocaleTimeString('en-US', timeOptions);
    
    return `${dateStr}, ${startStr} - ${endStr} (${durationMinutes} Mins)`;
  },

  /**
   * Format time (seconds to MM:SS)
   */
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  },

  /**
   * Generate a random string
   */
  randomStr(len = 8) {
    return Math.random().toString(36).substring(2, 2 + len).toUpperCase();
  },

  /**
   * Safe DOM selector
   */
  $(selector) {
    return document.querySelector(selector);
  },

  $all(selector) {
    return document.querySelectorAll(selector);
  },

  /**
   * Debounce function for inputs
   */
  debounce(fn, delay) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  /**
   * Update URL parameter and reload
   */
  setUrlParam(key, value) {
    const url = new URL(window.location);
    url.searchParams.set(key, value);
    window.location.href = url.toString();
  }
};

window.utils = utils;
