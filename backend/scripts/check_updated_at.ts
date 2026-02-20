
import { Pool } from 'pg';

async function run() {
    const pool = new Pool({ host:'localhost', port:5432, user:'sahty', password:'sahty_dev_2026', database: 'tenant_ced91ced-fe46-45d1-8ead-b5d51bad5895' });
    try {
        const res = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='patients_tenant' AND column_name='updated_at'`);
        console.log(res.rows.length > 0 ? 'updated_at EXISTS' : 'updated_at MISSING');
    } finally {
        await pool.end();
        process.exit(0);
    }
}
run();
