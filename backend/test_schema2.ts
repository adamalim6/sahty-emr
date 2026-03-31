import { Pool } from 'pg';

async function run() {
    const pool = new Pool({
        host: 'localhost',
        port: 5432,
        user: 'sahty',
        password: 'sahty_dev_2026',
        database: 'tenant_ced91ced-fe46-45d1-8ead-b5d51bad5895'
    });
    try {
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'prescriptions';
        `);
        console.log("COLUMNS IN tenant_ced91ced-fe46-45d1-8ead-b5d51bad5895:");
        res.rows.forEach(r => console.log(`- ${r.column_name}: ${r.data_type}`));

        const res2 = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'prescriptions';
        `);
        
        // Also check if details exists
        const res3 = await pool.query(`SELECT 1 FROM prescriptions LIMIT 1;`);
        console.log("TABLE EXISTS");
    } catch(e: any) {
        console.error("FAILURE:", e.message);
    }
    process.exit(0);
}
run();
