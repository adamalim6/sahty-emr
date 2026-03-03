const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const user = JSON.parse(data);
    const token = user.token;
    
    if(!token) {
        console.log("No token", data);
        process.exit(1);
    }
    
    const getOptions = {
        hostname: 'localhost',
        port: 3001,
        path: '/api/emr/patients/6f537c9a-e7e3-40d8-8659-9c785baa927d/surveillance/timeline?from=2026-02-27T08:00:00.000Z&to=2026-03-02T08:00:00.000Z',
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    };
    
    http.get(getOptions, (gRes) => {
        let gData = '';
        gRes.on('data', (c) => gData += c);
        gRes.on('end', () => {
            console.log("Timeline Status:", gRes.statusCode);
            console.log("Timeline Response:", gData.substring(0, 500));
        });
    });
    
    const prescOptions = {
        hostname: 'localhost',
        port: 3001,
        path: '/api/prescriptions/6f537c9a-e7e3-40d8-8659-9c785baa927d',
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    };
    
    http.get(prescOptions, (pRes) => {
        let pData = '';
        pRes.on('data', (c) => pData += c);
        pRes.on('end', () => {
            console.log("Prescriptions Status:", pRes.statusCode);
            console.log("Prescriptions Response:", pData.substring(0, 500));
        });
    });
  });
});

req.write(JSON.stringify({ username: 'dr.baba', password: 'password123' }));
req.end();
