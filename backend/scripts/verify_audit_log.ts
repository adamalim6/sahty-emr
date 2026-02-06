
import { globalQuery, globalTransaction } from '../db/globalPg';
import { tenantQuery, tenantTransaction } from '../db/tenantPg';
import { patientNetworkService } from '../services/patientNetworkService';

const MOCK_USER_ID = '00000000-0000-0000-0000-000000000001';

async function verify() {
    console.log('--- Verifying Universal Audit Log ---');

    try {
        // 1. Verify Global Audit
        console.log('Test 1: Global DB Audit');
        
        await globalTransaction(async (client) => {
             // Create Global Patient
            const res = await client.query(`
                INSERT INTO patients_global (first_name, last_name, date_of_birth, gender)
                VALUES ('Audit', 'Test', '2020-01-01', 'F')
                RETURNING global_patient_id
            `);
            const pid = res.rows[0].global_patient_id;
            console.log(`Created Global Patient: ${pid}`);

            // Verify Audit Log
            const auditRes = await client.query(`
                SELECT * FROM audit_log 
                WHERE table_name = 'patients_global' 
                AND record_id = $1 
                AND action = 'INSERT'
            `, [pid]);
            
            if (auditRes.rows.length === 0) throw new Error('Global Audit Log entry missing');
            const log = auditRes.rows[0];
            
            // Validate context capture
            if (log.changed_by !== MOCK_USER_ID) {
               throw new Error(`Global Audit: Expected changed_by=${MOCK_USER_ID}, got ${log.changed_by}`);
            }
            if (!log.operation_txid) {
                throw new Error('Global Audit: operation_txid missing');
            }
            console.log('Global Audit OK.');

        }, { userId: MOCK_USER_ID, clientInfo: 'VerifyScript' });


        // 2. Verify Tenant Audit
        console.log('Test 2: Tenant DB Audit');
        const clients = await globalQuery('SELECT id FROM clients LIMIT 1');
        if (clients.length === 0) return;
        const tenantId = clients[0].id;
        console.log(`Using Tenant: ${tenantId}`);

        await tenantTransaction(tenantId, async (client) => {
             // Create Person
             const res = await client.query(`
                INSERT INTO persons (tenant_id, first_name, last_name)
                VALUES ($1, 'Audit', 'Person')
                RETURNING person_id
            `, [tenantId]);
            const pid = res.rows[0].person_id;
            
            // NOTE: Persons table is NOT audited in our migration list (Network tables are: relationships, etc.)
            // Let's create a relationship to check audit.
            // Need a patient first.
            const pRes = await client.query('SELECT tenant_patient_id FROM patients_tenant LIMIT 1');
            if (pRes.rows.length === 0) {
                console.log('Skipping Tenant Audit (no patients)');
                return;
            }
            const tenantPatientId = pRes.rows[0].tenant_patient_id;

            const relRes = await client.query(`
                INSERT INTO patient_relationships (tenant_id, subject_patient_id, related_person_id, relationship_type, valid_from)
                VALUES ($1, $2, $3, 'SIBLING', '2026-01-01')
                RETURNING relationship_id
            `, [tenantId, tenantPatientId, pid]);
            const relId = relRes.rows[0].relationship_id;

            // Check Audit
            const auditRes = await client.query(`
                SELECT * FROM audit_log 
                WHERE table_name = 'patient_relationships' 
                AND record_id = $1
            `, [relId]);

             if (auditRes.rows.length === 0) throw new Error('Tenant Audit Log entry missing');
             const log = auditRes.rows[0];

             if (log.changed_by !== MOCK_USER_ID) {
                throw new Error(`Tenant Audit: Expected changed_by=${MOCK_USER_ID}, got ${log.changed_by}`);
             }
             console.log('Tenant Audit OK.');

        }, { userId: MOCK_USER_ID });


        // 3. Security Test (Append Only)
        console.log('Test 3: Security (Update Block)');
        let updateBlocked = false;
        try {
            await globalTransaction(async (client) => {
                await client.query("UPDATE audit_log SET action = 'HACKED'");
            });
        } catch (e: any) {
            if (e.message.includes('audit_log is append-only')) {
                updateBlocked = true;
            }
        }
        
        if (!updateBlocked) throw new Error('Security Alert: audit_log UPDATE was NOT blocked!');
        console.log('Security OK: UPDATE blocked.');


        console.log('\n--- VERIFICATION SUCCESS ---');
        process.exit(0);

    } catch (e: any) {
        console.error('Verification Failed:', e.message);
        process.exit(1);
    }
}

verify();
