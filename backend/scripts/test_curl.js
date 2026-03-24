const http = require('http');

const options = {
  hostname: 'localhost',
  port: 8080, // or 5000? Let's check backend port
  path: '/api/prescriptions/a720c03a-f492-46e6-ae4d-14f639392087',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer ' + 'FAKE',
  }
};

// I need a valid token to curl the API. 
// Maybe I can just read the server logs to see if there are GET /api/prescriptions/ errors.
