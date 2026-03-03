const http = require('http');

const data = JSON.stringify({ email: 'medt@sahty.dev', password: 'password123' });

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (d) => { body += d; });
  res.on('end', () => { 
      try {
          const auth = JSON.parse(body);
          console.log("TOKEN:", auth.token);
          
          if(auth.token) {
              // Now test saving a diagnosis
              const diagData = JSON.stringify({
                  icd_linearization: 'mms',
                  icd_language: 'fr',
                  icd_code: '2D41',
                  icd_title: 'Carcinome non précisé de localisation non précisée',
                  icd_selected_text: 'Cancer inconnu',
                  icd_foundation_uri: 'http://id.who.int/icd/entity/1467715547'
              });
              
              const diagOptions = {
                  hostname: 'localhost',
                  port: 3001,
                  path: '/api/emr/patients/2a96aac3-9cdb-4912-bb55-2bb3fec17805/diagnoses',
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(diagData),
                    'Authorization': 'Bearer ' + auth.token
                  }
              };
              
              const diagReq = http.request(diagOptions, (diagRes) => {
                  let diagBody = '';
                  diagRes.on('data', (d) => { diagBody += d; });
                  diagRes.on('end', () => {
                      console.log("DIAGNOSIS SAVE STATUS:", diagRes.statusCode);
                      console.log("DIAGNOSIS SAVE BODY:", diagBody);
                  });
              });
              diagReq.write(diagData);
              diagReq.end();
          }
      } catch (e) {
          console.log("FAILED LOGIN:", body);
      }
  });
});

req.write(data);
req.end();
