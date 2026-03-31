const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'services', 'prescriptionService.ts');
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
    'async logAdministrationAction(', 
    'async logAdministrationActionTx(tenantId: string, client: any, '
).replace(
    'tenantId: string,\n        prescriptionEventId: string,',
    'prescriptionEventId: string,'
).replace(
    'const query = `\n            INSERT INTO administration_events',
    'const query = `\n            INSERT INTO administration_events'
);

console.log("We won't use sed, I will manually use replace file content");
