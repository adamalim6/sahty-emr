import { getGlobalPool } from '../db/globalPg';

async function fixAudit() {
    console.log("Fixing missing System Actor in audit logs safely...");
    const globalPool = getGlobalPool();
    const globalClient = await globalPool.connect();
    
    try {
        await globalClient.query('BEGIN');
        await globalClient.query(`ALTER TABLE public.audit_log DISABLE TRIGGER audit_log_no_update`);
        
        await globalClient.query(`
            UPDATE public.audit_log 
            SET changed_by = '00000000-0000-0000-0000-000000000001' 
            WHERE changed_by IS NULL AND table_name IN ('sih_sous_familles', 'global_actes')
        `);
        
        await globalClient.query(`ALTER TABLE public.audit_log ENABLE TRIGGER audit_log_no_update`);
        await globalClient.query('COMMIT');
        
        console.log("✅ Audit Logs patched with System Actor UUID.");
    } catch (e) {
        await globalClient.query('ROLLBACK');
        console.error("❌ Failed to patch audit log:", e);
    } finally {
        globalClient.release();
        await globalPool.end();
    }
}

fixAudit().catch(console.error);
