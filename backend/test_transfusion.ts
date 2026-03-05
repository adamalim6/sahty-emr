import { Pool } from 'pg';
import { prescriptionService } from './services/prescriptionService';

async function test() {
    const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895'; 
    const client = new Pool({ host:'localhost', port:5432, user:'sahty', password:'sahty_dev_2026', database: 'tenant_' + tenantId });
    
    try {
        console.log("Looking for transfusion event...");
        const res = await client.query(`
            SELECT pe.id
            FROM prescription_events pe
            JOIN prescriptions p ON p.id = pe.prescription_id
            WHERE p.prescription_type = 'transfusion' AND pe.status = 'scheduled'
            LIMIT 1
        `);
        
        if (res.rows.length === 0) {
            console.log("No transfusion event found");
            return;
        }
        const pe = res.rows[0];

        const bagRes = await client.query(`
            SELECT id, volume_ml FROM transfusion_blood_bags 
            WHERE status IN ('RECEIVED', 'IN_USE') AND tenant_id = $1
            LIMIT 1
        `, [tenantId]);

        if (bagRes.rows.length === 0) {
            console.log("No available bag found");
            return;
        }
        const bagId = bagRes.rows[0].id;
        const bagVol = bagRes.rows[0].volume_ml || 200;

        const userRes = await client.query(`
            SELECT user_id FROM auth.users LIMIT 1
        `);
        
        const userId = userRes.rows[0].user_id;

        console.log("Attempting to log administration action with volume:", bagVol);
        
        const result = await prescriptionService.logAdministrationAction(tenantId, pe.id, 'started', {
            occurredAt: new Date(),
            actualStartAt: new Date(),
            performedByUserId: userId,
            transfusion: {
                bloodBagIds: [bagId],
                checks: {
                    identity_check_done: true,
                    compatibility_check_done: true,
                    bedside_double_check_done: true,
                    vitals_baseline_done: true
                }
            },
            administered_bags: [{ id: bagId, volume_ml: bagVol }]
        });

        console.log("Success! Result:", result);
    } catch (e: any) {
        console.error("FAILED WITH ERROR:", e.message);
        console.error("STACK:", e.stack);
    } finally {
        await client.end();
        process.exit();
    }
}
test();
