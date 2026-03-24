const { Client } = require('pg');
async function r() {
  const c = new Client('postgresql://sahty:sahty_dev_2026@localhost:5432/tenant_00000000-0000-4000-a000-000000000001');
  await c.connect();
  const cRes = await c.query('SELECT COUNT(*) FROM reference.global_products');
  console.log('global_products count:', cRes.rows[0].count);
  await c.end();
}
r();
