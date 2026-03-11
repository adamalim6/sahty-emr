import { Pool } from 'pg';

async function run() {
    const adminPool = new Pool({ host:'localhost', port:5432, user:'sahty', password:'sahty_dev_2026', database:'sahty_global' });
    try {
        const dbs = await adminPool.query("SELECT id FROM tenants");
        const tenantId = dbs.rows[0].id;
        const pool = new Pool({ host:'localhost', port:5432, user:'sahty', password:'sahty_dev_2026', database: `tenant_${tenantId}` });
        
        try {
            const res = await pool.query(`
                SELECT code, label, is_hydric_input, is_hydric_output, source
                FROM reference.observation_parameters
                WHERE code IN ('APPORTS_HYD_CR_MAN', 'PERTES_HYD_CR_MAN', 'HYDRIC_INPUT', 'HYDRIC_OUTPUT', 'HYDRIC_BALANCE')
            `);
            console.log("Hydric Parameter Configs:");
            console.table(res.rows);
        } catch(e: any) {
            console.error(e.message);
        } finally {
            await pool.end();
        }
    } catch (e: any) {
        console.error(e.message);
    } finally {
        await adminPool.end();
        process.exit(0);
    }
}
run();
