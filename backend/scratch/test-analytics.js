const axios = require('axios');

const test = async () => {
  try {
    const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'student1@exam.com',
      password: 'password123'
    });
    
    const token = loginRes.data.accessToken;
    console.log('Successfully logged in! Token acquired.');

    const analyticsRes = await axios.get('http://localhost:5000/api/portal/student/global-analytics', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log('Analytics Response:', JSON.stringify(analyticsRes.data, null, 2));
  } catch (err) {
    console.error('Error during test:', err.response ? err.response.data : err.message);
  }
};

test();
