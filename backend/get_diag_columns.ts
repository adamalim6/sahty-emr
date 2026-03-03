import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
    const dbName = 'tenant_ced91ced-fe46-45d1-8ead-b5d51bad5895'; // Or whichever tenant
    const pool = new Pool({
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT || '5432'),
        user: process.env.PG_USER || 'sahty',
        password: process.env.PG_PASSWORD || 'sahty_dev_2026',
        database: 'tenant_3f6d'
    });
    
    try {
        const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'patient_diagnoses';");
        console.log("Columns:", res.rows);
    } catch(e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
