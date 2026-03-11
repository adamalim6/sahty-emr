import { getTenantPool } from '../db/tenantPg';
async function run() {
    const pool = getTenantPool('ced91ced-fe46-45d1-8ead-b5d51bad5895');
    const paramsRes = await pool.query(`
        SELECT id, code, label FROM reference.observation_parameters 
        WHERE code ILIKE '%HYDRIC%' OR label ILIKE '%hydri%' OR label ILIKE '%apport%' OR label ILIKE '%perte%' OR label ILIKE '%bilan%'
    `);
    console.log("Found codes:", paramsRes.rows.map(r => ({ code: r.code, label: r.label })));
    process.exit(0);
}
run();
