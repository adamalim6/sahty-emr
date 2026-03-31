import { pool } from './db/postgres';

async function check() {
  const res = await pool.query(`
    SELECT column_name, is_nullable, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'lab_requests';
  `);
  console.log(res.rows);
  process.exit(0);
}
check().catch(console.error);
