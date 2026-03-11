import { getTenantPool } from '../db/tenantPg';

async function run() {
    console.log("Starting script");
    try {
        const pool = getTenantPool('ced91ced-fe46-45d1-8ead-b5d51bad5895');
        const res = await pool.query(`
            SELECT conname, pg_get_constraintdef(c.oid)
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            WHERE t.relname = 'surveillance_values_events';
        `);
        console.log("CONSTRAINTS:", res.rows);

        const paramsRes = await pool.query(`SELECT id, code, label FROM reference.observation_parameters WHERE code LIKE '%HYDRIC%' OR code LIKE '%hydric%'`);
        console.log("PARAMS:", paramsRes.rows);
    } catch(e) {
        console.error("ERROR:", e);
    } finally {
        process.exit(0);
    }
}
run();
