import { Pool } from 'pg';

const pool = new Pool({
    connectionString: 'postgresql://sahty:sahty_dev_2026@localhost:5432/tenant_00000000-0000-4000-a000-000000000001'
});

async function main() {
    const res = await pool.query(`
        SELECT p.*,
            (SELECT count(*) FROM prescription_events pe WHERE pe.prescription_id = p.id) as event_count
        FROM prescriptions p
        ORDER BY p.created_at DESC LIMIT 5
    `);
    
    for (const row of res.rows) {
        console.log(`\nPrescription (${row.id}) | Created: ${row.created_at} | Events: ${row.event_count}`);
        console.log(`prescription_type: ${row.prescription_type}`);
        console.log(`schedule data: ${JSON.stringify(row.details || row.data || row.schedule, null, 2)}`);
    }
    
    await pool.end();
}

main().catch(console.error);
