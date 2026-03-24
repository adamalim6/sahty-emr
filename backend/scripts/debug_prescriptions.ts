import { getTenantPool } from '../db/tenantPg';
import { surveillanceService } from '../services/surveillanceService';

async function run() {
    const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
    const patientId = 'a720c03a-f492-46e6-ae4d-14f639392087'; // From the URL in the screenshot
    
    // Test the exact params used by the frontend
    const survStart = new Date('2026-03-14T07:00:00Z'); // Roughly
    const survEnd = new Date('2026-03-16T07:00:00Z');
    
    try {
        const payload = await surveillanceService.getTimeline(
            tenantId, 
            patientId, 
            survStart.toISOString(), 
            survEnd.toISOString()
        );
        console.log('Timeline events prescription IDs:');
        console.log(payload.timelineEvents.map(t => t.prescriptionId));
        
        const pool = getTenantPool(tenantId);
        const pres = await pool.query('SELECT id, status, data FROM prescriptions WHERE tenant_patient_id = $1 AND status != \'STOPPED\'', [patientId]);
        
        console.log('\nActive Prescriptions:');
        pres.rows.forEach(p => {
             console.log(`ID: ${p.id}, Status: ${p.status}, Type: ${p.data.prescriptionType}`);
        });

    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

run();
