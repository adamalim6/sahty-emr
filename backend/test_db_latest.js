const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://sahty:sahty_pwd@localhost:5432/sahty_tenant_adamalim6' });

client.connect().then(() => {
  client.query("SELECT id, action_type, status, linked_event_id, volume_administered_ml, occurred_at FROM administration_events ORDER BY created_at DESC LIMIT 5")
    .then(res => {
      console.log(JSON.stringify(res.rows, null, 2));
      client.end();
    })
    .catch(err => {
      console.error(err);
      client.end();
    });
}).catch(err => console.error("CON ERR", err));
