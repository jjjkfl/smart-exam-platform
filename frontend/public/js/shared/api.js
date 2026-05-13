/**
 * js/shared/api.js
 * Centralized API handler for backend communication
 */

const API_BASE_URL = 'http://localhost:5000/api';
const SERVER_URL = 'http://localhost:5000';

const api = {
  /**
   * Core request wrapper
   */
  async request(endpoint, options = {}) {
    const token = localStorage.getItem('token');

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
    const token = localStorage.getItem('token');
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
