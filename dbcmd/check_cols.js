const { Client } = require('pg');

async function run() {
  const c = new Client('postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global');
  await c.connect();
  const r1 = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'lab_sections'");
  console.log('lab_sections:', r1.rows.map(r=>r.column_name));
  const r2 = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'lab_sub_sections'");
  console.log('lab_sub_sections:', r2.rows.map(r=>r.column_name));
  await c.end();
}
run();
