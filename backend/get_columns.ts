import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
    const pool = new Pool({
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT || '5432'),
        user: process.env.PG_USER || 'sahty',
        password: process.env.PG_PASSWORD || 'sahty_dev_2026',
        database: 'tenant_3f6d'
    });
    
    try {
        const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users';");
        console.log("Columns:", res.rows.map(r => r.column_name));
    } catch(e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
