/**
 * js/shared/socket.js
 * Base socket initialization
 */

const socket = io(window.SERVER_URL || window.location.origin, {
  autoConnect: false,
  auth: (cb) => {
    cb({ token: sessionStorage.getItem('token') });
  }
});

window.baseSocket = socket;
