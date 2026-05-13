/**
 * js/shared/utils.js
 * Common utility functions
 */

const utils = {
  /**
   * Format date to Apple-style readable string
   */
  formatDate(dateString) {
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
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
