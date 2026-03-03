const http = require('http');

const run = async () => {
    const res = await fetch('http://localhost:3001/api/dev/auth-sync-status');
    const json = await res.json();
    console.log(json);
};
run();
