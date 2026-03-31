import { Client } from 'pg';

const client = new Client({
  connectionString: 'postgresql://sahty:sahty_dev_2026@localhost:5432/tenant_ced91ced-fe46-45d1-8ead-b5d51bad5895'
});

async function run() {
  try {
      await client.connect();
      const res = await client.query('SELECT $1::int as num', [parseInt("--", 10)]);
      console.log(res.rows);
  } catch (e: any) {
      console.error(e.stack);
  } finally {
      await client.end();
  }
}
run();
