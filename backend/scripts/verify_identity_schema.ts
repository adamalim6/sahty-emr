
import { getTenantPool } from '../db/tenantPg';
import { globalQuery } from '../db/globalPg';

async function verifySchemas() {
    console.log('--- Verifying Identity Schemas ---');
    
    // 1. Check Global
    console.log('[Global] Checking identity schema...');
    const globalCheck = await globalQuery("SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = 'identity')");
    console.log(`Global Identity Schema Exists: ${globalCheck[0].exists}`);
    
    const globalTables = await globalQuery("SELECT table_name FROM information_schema.tables WHERE table_schema = 'identity'");
    console.log('Global Identity Tables:', globalTables.map(t => t.table_name).join(', '));
    
    // 2. Check Valid Tenant
    const clients = await globalQuery('SELECT id FROM clients LIMIT 1');
    const tenantId = clients[0].id; // Should be e262...
    console.log(`\n[Tenant ${tenantId}] Checking identity schema...`);
    
    const pool = getTenantPool(tenantId);
    const tenantCheck = await pool.query("SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = 'identity')");
    console.log(`Tenant Identity Schema Exists: ${tenantCheck.rows[0].exists}`);
    
    const tenantTables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'identity'");
    console.log('Tenant Identity Tables:', tenantTables.rows.map((t: any) => t.table_name).join(', '));
    
    // 3. Check patients_tenant columns
    console.log('\n[Tenant] Checking patients_tenant columns...');
    const ptCols = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'patients_tenant' 
        AND column_name IN ('master_patient_id', 'mpi_link_status', 'first_name', 'last_name', 'dob', 'sex')
    `);
    console.log('Found Columns:', ptCols.rows.map((c: any) => c.column_name).join(', '));

    // 4. Check patient_documents
    const pdCheck = await pool.query("SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'patient_documents')");
    console.log(`patient_documents Table Exists: ${pdCheck.rows[0].exists}`);

    process.exit(0);
}

verifySchemas().catch(console.error);
