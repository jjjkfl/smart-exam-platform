const axios = require('axios');

async function reproduce() {
    try {
        // 1. Login as Student 1
        const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
            email: 'student1@exam.com',
            password: 'password123'
        });

        const token = loginRes.data.accessToken;
        console.log('Logged in. Token:', token.substring(0, 10) + '...');

        // 2. Fetch Announcements
        const annRes = await axios.get('http://localhost:5000/api/portal/student/announcements', {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log('Response Status:', annRes.status);
        console.log('Response Data:', JSON.stringify(annRes.data, null, 2));

    } catch (err) {
        if (err.response) {
            console.error('Error Response:', err.response.status, err.response.data);
        } else {
            console.error('Error:', err.message);
        }
    }
}

reproduce();
