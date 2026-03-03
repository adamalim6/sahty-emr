import { getGlobalPool } from '../db/globalPg';
import { getTenantPool } from '../db/tenantPg';

const TENANT_ID = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
const SYSTEM_ACTOR = '00000000-0000-0000-0000-000000000001';

async function verify() {
    console.log('--- Starting Final Validation ---');
    
    const globalPool = getGlobalPool();
    const globalClient = await globalPool.connect();
    
    const tenantPool = getTenantPool(TENANT_ID);
    const tenantClient = await tenantPool.connect();

    try {
        console.log("1. Checking Global DB counts...");
        const gActes = await globalClient.query(`SELECT COUNT(*) as c FROM public.global_actes`);
        console.log(`Global Actes: ${gActes.rows[0].c}`);

        const gBio = await globalClient.query(`SELECT COUNT(*) as c FROM public.global_actes WHERE famille_id IN (SELECT id FROM public.sih_familles WHERE code = 'BIOLOGIE')`);
        console.log(`Global Biology Actes: ${gBio.rows[0].c}`);

        console.log("\n2. Checking Tenant DB counts...");
        const tActes = await tenantClient.query(`SELECT COUNT(*) as c FROM reference.global_actes`);
        console.log(`Tenant Actes: ${tActes.rows[0].c}`);
        
        const tB = await tenantClient.query(`SELECT bio_nombre_b FROM reference.global_actes WHERE code_sih = 'C_125OH'`);
        console.log(`Tenant C_125OH bio_nombre_b: ${tB.rows[0]?.bio_nombre_b}`);

        if (gActes.rows[0].c !== tActes.rows[0].c) {
            console.error('❌ Mismatch in total acts between Global and Tenant reference!');
        } else {
            console.log('✅ Global and Tenant Act counts match exactly.');
        }

        console.log("\n3. Checking Audit Log in Global DB...");
        const auditInsertCount = await globalClient.query(`
            SELECT COUNT(*) as c FROM public.audit_log 
            WHERE table_name = 'global_actes' 
            AND action = 'INSERT' 
            AND changed_by = $1
        `, [SYSTEM_ACTOR]);
        
        console.log(`Audit Logs recorded by System Actor for 'global_actes' INSERTS: ${auditInsertCount.rows[0].c}`);

        if (parseInt(auditInsertCount.rows[0].c) > 0) {
            console.log('✅ Audit Log tracking using System Actor UUID functions correctly.');
        } else {
            console.error('❌ Missing Audit Logs for the Biology Import!');
        }

    } finally {
        globalClient.release();
        tenantClient.release();
        await globalPool.end();
        await tenantPool.end();
    }
}

verify().catch(console.error);
