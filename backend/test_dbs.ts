import 'dotenv/config';
import { Pool } from 'pg';

async function run() {
    const pool = new Pool({
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT || '5432'),
        user: process.env.PG_USER || 'sahty',
        password: process.env.PG_PASSWORD || 'sahty_dev_2026',
        database: 'postgres'
    });
    try {
        const res = await pool.query(`SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'`);
        console.log("Databases:", res.rows.map((r: any) => r.datname).join(', '));
    } catch(e: any) {
        console.error("FAILURE:", e.message);
    }
    process.exit(0);
}
run();
