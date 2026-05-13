/**
 * js/shared/apiUtils.js
 * Helpers for API data processing
 */

const apiUtils = {
  formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  },
  
  getError(err) {
    return err.message || 'An unexpected error occurred';
  }
};

window.apiUtils = apiUtils;
