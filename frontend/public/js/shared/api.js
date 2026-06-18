/**
 * js/shared/api.js
 * Centralized API handler for backend communication
 */

const origin = window.location.origin;
// Determine server URL dynamically: use origin unless we are running frontend on a local dev port (not 5000)
const isLocalDev = (origin.includes('localhost') || origin.includes('127.0.0.1')) && !origin.includes(':5000');
const SERVER_URL = isLocalDev ? 'http://localhost:5000' : origin;
const API_BASE_URL = `${SERVER_URL}/api`;
console.log('API configuring SERVER_URL to:', SERVER_URL);

const api = {
  /**
   * Core request wrapper
   */
  async request(endpoint, options = {}) {
    const token = sessionStorage.getItem('token');

    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers
    };

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
      const result = await response.json();

      if (!response.ok) {
        // Handle token expiration
        if (response.status === 401) {
          auth.logout();
        }
        throw new Error(result.message || 'Something went wrong');
      }

      return result;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  },

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  },

  post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  patch(endpoint, body) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body)
    });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  },

  /**
   * Specialized for file uploads (FormData)
   */
  async upload(endpoint, formData) {
    const token = sessionStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: formData
      });
      const result = await response.json();
      if (!response.ok && response.status === 401) {
        auth.logout();
      }
      return result;
    } catch (error) {
      console.error('Upload Error:', error);
      if (error.message?.includes('401')) auth.logout();
      throw error;
    }
  }
};

window.api = api;
window.SERVER_URL = SERVER_URL;
