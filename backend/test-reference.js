const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/reference/products?page=1&limit=50',
  method: 'GET',
  headers: {
    // Generate a quick fake token or just bypass for auth testing
    // To make it easy, we'll hit an endpoint to login
  }
};

const run = async () => {
    // 1. Login to get a valid token
    const loginRes = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'dr.baba', password: 'password123' })
    });
    const loginData = await loginRes.json();
    console.log("Login User:", loginData.user?.username, "Tenant:", loginData.user?.tenantId || loginData.user?.client_id);
    const token = loginData.token;

    // 2. Fetch reference products
    const refRes = await fetch('http://localhost:3001/api/reference/products?page=1&limit=5', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    console.log("Status:", refRes.status);
    const text = await refRes.text();
    console.log("Response:", text.substring(0, 500));
}
run();
