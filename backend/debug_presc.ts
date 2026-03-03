import { getTenantPool } from './db/tenantPg';

async function main() {
    const tenantId = 'adamalim6'; // or is it 'adamalim6_sahty_emr' ? 
    const { globalQuery } = require('./db/globalPg');
    const tenantRes = await globalQuery('SELECT * FROM public.tenants');
    console.log("Tenants found:");
    for (const t of tenantRes) {
        console.log(JSON.stringify(t));
    }

    // Attempting to use the first tenant for now, or match
    const tId = tenantRes[0].id;
    console.log("Using Tenant ID:", tId);
    
    const pool = getTenantPool(tId);
    
    const { generateDoseSchedule } = require('./utils/prescriptionScheduler');
    
    const sampleSchedule = {
        schedule_type: 'one-time',
        startDateTime: '2026-03-02T10:00:00.000Z'
    };
    
    console.log("Testing one-time biology:");
    const res1 = generateDoseSchedule(sampleSchedule, 'biology', 'one-time');
    console.log(JSON.stringify(res1.scheduledDoses, null, 2));

    const sampleFreq = {
        schedule_type: 'frequency',
        mode: 'simple',
        simpleCount: '1',
        simplePeriod: 'day',
        intervalDuration: '0',
        dailySchedule: 'everyday',
        durationValue: '3',
        durationUnit: 'days',
        startDateTime: '2026-03-02T10:00:00.000Z'
    };

    console.log("Testing frequency biology:");
    const res2 = generateDoseSchedule(sampleFreq, 'biology', 'frequency');
    console.log("Needs Detail:", res2.needsDetail, "Message:", res2.message);
    console.log(JSON.stringify(res2.scheduledDoses, null, 2));

    //Also count total prescriptions
    const countRes = await pool.query(`SELECT count(*), prescription_type FROM prescriptions WHERE tenant_patient_id = '6f537c9a-e7e3-40d8-8659-9c785baa927d' GROUP BY prescription_type`);
    console.log("Prescription counts by type:");
    console.log(countRes.rows);

    process.exit(0);
}


main().catch(console.error);
