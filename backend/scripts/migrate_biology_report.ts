import { getTenantPool } from '../db/tenantPg';

async function migrate() {
    const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
    const pool = getTenantPool(tenantId);
    console.log("Starting Migration...");
    try {
        const result = await pool.query(`UPDATE patient_documents SET document_type = 'LAB_REPORT' WHERE document_type = 'BIOLOGY_REPORT';`);
        console.log(`Migration complete. Rows matched/updated: ${result.rowCount}`);
    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        pool.end();
    }
}
migrate();
