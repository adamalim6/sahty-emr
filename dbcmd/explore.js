const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: 'postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global' });
  try {
    await client.connect();
    const res = await client.query("SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema IN ('public', 'reference')");
    console.log("sahty_global tables:", res.rows);
  } catch(e) { console.error(e.message); } finally { await client.end(); }

  const dbs = new Client({ connectionString: 'postgresql://sahty:sahty_dev_2026@localhost:5432/postgres' });
  try {
    await dbs.connect();
    const res2 = await dbs.query("SELECT datname FROM pg_database WHERE datistemplate = false");
    console.log("Databases on server:", res2.rows);
  } catch(e) { console.error(e.message); } finally { await dbs.end(); }
}
run();
