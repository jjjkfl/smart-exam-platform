const axios = require('axios');

async function test() {
    const API = 'http://localhost:5000/api';
    try {
        // Login
        const loginRes = await axios.post(`${API}/auth/login`, {
            email: 'student1@exam.com',
            password: 'password123'
        });
        const token = loginRes.data.accessToken;
        console.log('Logged in, token received');

        // Hit announcements
        const res = await axios.get(`${API}/portal/student/announcements`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Announcements Response:', res.data);
    } catch (err) {
        console.error('Error:', err.response?.data || err.message);
    }
}

test();
