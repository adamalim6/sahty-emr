import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    console.log('Connecting to sahty_global and wiping malformed system phrases...');
    const sysClean = await pool.query(`DELETE FROM sahty_global.public.smart_phrases WHERE body_html LIKE '%{{cursor}}%{{cursor}}%' OR body_text LIKE '%{{cursor}}%{{cursor}}%' RETURNING *`);
    console.log(`Deleted ${sysClean.rowCount} malformed system phrases.`);

    console.log('Fetching all tenants...');
    const tenants = await pool.query('SELECT id, db_name FROM sahty_global.public.tenants');
    
    for (const t of tenants.rows) {
       console.log(`Cleaning tenant ${t.db_name}...`);
       try {
           const tPool = new Pool({ connectionString: (process.env.DATABASE_URL as string).replace(/sahty_global/, t.db_name) });
           const clean = await tPool.query(`DELETE FROM public.smart_phrases WHERE body_html LIKE '%{{cursor}}%{{cursor}}%' OR body_text LIKE '%{{cursor}}%{{cursor}}%' RETURNING *`);
           console.log(`  -> Deleted ${clean.rowCount} malformed tenant/user phrases.`);
           await tPool.end();
       } catch (e) {
           console.log(`  -> Error parsing tenant ${t.db_name}`);
       }
    }
    
    console.log('Cleanup complete.');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    pool.end();
  }
}

run();
