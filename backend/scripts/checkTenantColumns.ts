import { getTenantPool } from '../db/tenantPg';

async function check() {
    try {
        const pool = await getTenantPool('ced91ced-fe46-45d1-8ead-b5d51bad5895');
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'reference' 
            AND table_name = 'observation_parameters'
            ORDER BY ordinal_position;
        `);
        console.table(res.rows);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

check();
