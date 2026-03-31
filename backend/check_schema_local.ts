import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://sahty:sahty_dev_2026@localhost:5432/tenant_00000000_0000_4000_a000_000000000001'
});

async function run() {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'prescriptions';
    `);
    console.table(res.rows);
  } catch(e) { console.error(e); }
  await pool.end();
}
run();
