const { api, API_BASE_URL } = require('../services/api');

async function check() {
  try {
     const res = await fetch('http://localhost:3001/api/reference/lab-search?q=plaqu', {
         headers: {
             'Authorization': 'Bearer ' + 'test'
         }
     });
     console.log('Status:', res.status);
     const text = await res.text();
     console.log('Body:', text);
  } catch(e) {
     console.error(e);
  }
}
check();
