import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const globalPool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/sahty_global',
});

async function run() {
    try {
        const client = await globalPool.connect();
        const res = await client.query(`SELECT id, name, schema_name FROM hospitals`);
        console.log('Tenants:');
        console.log(res.rows);
        client.release();
    } catch (e) {
        console.error(e);
    } finally {
        globalPool.end();
        process.exit();
    }
}

run();
