import { getTenantPool } from '../db/tenantPg';

async function migrateAndCheck() {
    const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
    const pool = getTenantPool(tenantId);
    console.log("Starting Migration...");
    try {
        const updateResult = await pool.query(`UPDATE patient_documents SET document_type = 'LAB_REPORT' WHERE document_type = 'BIOLOGY_REPORT';`);
        console.log(`Migration complete. Rows matched/updated: ${updateResult.rowCount}`);

        const result = await pool.query(`SELECT document_type, COUNT(*) FROM patient_documents GROUP BY document_type;`);
        console.log("Current document types:", result.rows);

        await pool.query(`ALTER TABLE patient_documents DROP CONSTRAINT IF EXISTS chk_document_type;`);
        await pool.query(`ALTER TABLE patient_documents ADD CONSTRAINT chk_document_type CHECK (document_type IN ('LAB_REPORT', 'RADIOLOGY', 'GENERAL', 'PRESCRIPTION', 'OTHER'));`);
        console.log("Constraint chk_document_type added successfully.");
    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        pool.end();
    }
}
migrateAndCheck();
