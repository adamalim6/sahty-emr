const { Client } = require('pg');

async function run() {
  const c = new Client('postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global');
  await c.connect();
  const r = await c.query("SELECT conname, pg_get_constraintdef(c.oid) FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public' AND conname LIKE '%key'");
  console.log(r.rows);
  await c.end();
}
run();
