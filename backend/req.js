const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/emr/patients/2a96aac3-9cdb-4912-bb55-2bb3fec17805/diagnoses',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer ' + 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjA3YWJhNjI3LTY4OWItNDI5Mi04ZGUzLTI3MGZlOTdkMTUzYyIsInRlbmFudElkIjoiY2VkOTFjZWQtZmU0Ni00NWQxLThlYWQtYjVkNTFiYWQ1ODk1Iiwicm9sZUlkIjoiMDdhYmE2MjctNjg5Yi00MjkyLThkZTMtMjcwZmU5N2QxNTNjIiwiZW1haWwiOiJhZG1pbkBzYWh0eS5kZXYgKGludGVybmFsKSIsImlhdCI6MTc0MDkzNDcxNn0.VvU-zQv9y_81U79Pz4yV1x_9x1v1y_3x1v1y_3x1v1y'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => { console.log("STATUS:", res.statusCode); console.log("BODY:", data); });
});

req.on('error', (e) => { console.error(`Problem with request: ${e.message}`); });
req.end();
