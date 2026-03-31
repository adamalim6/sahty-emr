import { Pool } from 'pg';
import { PrescriptionService } from './services/prescriptionService';

const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
const patientId = 'cf64ecc6-0be4-4571-b9ea-f460114d0b27'; // an existing patient
const admissionId = 'f76ac5d2-f63b-47e2-aaee-6cc632b85eef'; // pseudo
const pool = new Pool({ connectionString: `postgresql://sahty:sahty_dev_2026@localhost:5432/tenant_${tenantId}` });

async function runTest() {
    console.log("Fetching a valid patient/admission...");
    const admRes = await pool.query(`SELECT tenant_patient_id, id FROM admissions LIMIT 1`);
    if (admRes.rows.length === 0) {
        console.error("No admissions found to attach to test.");
        await pool.end();
        return;
    }
    const patientId = admRes.rows[0].tenant_patient_id;
    const admissionId = admRes.rows[0].id;
    
    const service = new PrescriptionService();
    
    // 1. Create a dummy prescription to trigger dual-write
    console.log("== 1. Creating Mock Prescription ==");
    const mockData: any = {
        molecule: 'Paracetamol',
        moleculeId: 'db4c2a55-df1e-4530-81f1-0fc03bf4e8c1',
        commercialName: 'Doliprane 1000',
        productId: '6d027a69-65fc-4209-be8a-b153b3be5d08',
        qty: "2.5",
        unit: 'mg',
        route: 'ORAL', // Let's try ORAL
        adminMode: 'instant',
        adminDuration: '',
        schedule_type: 'frequency',
        dilutionRequired: true,
        substitutable: true,
        databaseMode: 'hospital',
        prescriptionType: 'medication',
        solvent: {
            molecule: 'Sodium Chloride',
            moleculeId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            commercialName: 'NaCl 0.9%',
            productId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
            qty: "250",
            unitId: '0029cb97-bd4a-4ca1-b5ef-b05420624928' // mL UUID
        },
        schedule: {
            mode: 'cycle',
            interval: '8',
            durationValue: '5',
            durationUnit: 'days',
            simpleCount: '3',
            isCustomInterval: false,
            startDateTime: new Date().toISOString()
        }
    };
    
    try {
        const presc = await service.createPrescription(tenantId, patientId, admissionId, mockData, 'a04e92f1-4705-47c8-b4df-fd37ef3cb6a0');
        console.log(`Created Prescription ID: ${presc.id}`);
    } catch(e) {
        console.error("Failed to create prescription:", e);
    }
    
    // 2. Run User's Queries
    console.log("\n== 1. VALIDATION: STRUCTURED COLUMNS ==");
    let r1 = await pool.query(`
        SELECT 
            id, product_id, route_id, route_label, 
            solvent_qty, solvent_unit_id, solvent_unit_label, 
            solvent_molecule_id, solvent_molecule_name, 
            solvent_product_id, solvent_product_name
        FROM prescriptions
        ORDER BY created_at DESC
        LIMIT 1;
    `);
    console.table(r1.rows);
    
    console.log("\n== 2. VALIDATION: JSON vs COLUMNS ==");
    let r2 = await pool.query(`
        SELECT 
          details->>'productId' AS json_product_id,
          product_id AS column_product_id,
          details->>'route' AS json_route,
          route_label AS column_route_label,
          details->'solvent'->>'qty' AS json_solvent_qty,
          solvent_qty AS column_solvent_qty,
          details->'solvent'->>'moleculeId' AS json_solvent_molecule_id,
          solvent_molecule_id AS column_solvent_molecule_id
        FROM prescriptions
        WHERE product_id IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 1;
    `);
    console.table(r2.rows);
    
    // 3. Null Handling Test
    console.log("\n== 3. VALIDATION: NULL HANDLING ==");
    const mockNullData = { ...mockData, qty: '--', schedule_type: 'one-time' };
    try {
        await service.createPrescription(tenantId, patientId, admissionId, mockNullData, 'a04e92f1-4705-47c8-b4df-fd37ef3cb6a0');
    } catch(e) {
        console.error(e);
    }
    
    let r3 = await pool.query(`
        SELECT 
          details->>'qty' as json_qty_val,
          qty as col_qty_val
        FROM prescriptions
        WHERE qty IS NULL
        AND details->>'qty' IN ('--', '')
        ORDER BY created_at DESC
        LIMIT 1;
    `);
    console.table(r3.rows);

    await pool.end();
}

runTest().catch(console.error);
