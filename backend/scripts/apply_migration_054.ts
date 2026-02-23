import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
    const pool = new Pool({
        host: 'localhost', port: 5432, user: 'sahty',
        password: 'sahty_dev_2026',
        database: 'tenant_ced91ced-fe46-45d1-8ead-b5d51bad5895'
    });
    try {
        const mig054 = fs.readFileSync(
            path.join(__dirname, '../migrations/pg/tenant/054_fix_jsonb_payloads.sql'), 'utf-8'
        );
        await pool.query(mig054);
        console.log('[+] Migration 054 applied successfully');

        // Verify: check a couple of prescriptions
        const check = await pool.query(`
            SELECT id, prescription_type, 
                   details ? 'type' as has_old_type,
                   details ? 'schedule_type' as has_new_type,
                   details->'schedule' ? 'skippedDoses' as has_old_skipped,
                   details->'schedule' ? 'skippedEvents' as has_new_skipped
            FROM prescriptions
            LIMIT 5
        `);
        console.log('\nSample prescriptions after migration:');
        check.rows.forEach((r: any) => {
            console.log(`  ${r.id} (${r.prescription_type}): has_old_type=${r.has_old_type}, has_new_type=${r.has_new_type}`);
        });
        if (check.rows.length === 0) {
            console.log('  (no prescriptions exist yet - migration is ready for future data)');
        }
    } catch(e: any) {
        console.error('FAILED:', e.message);
    } finally {
        await pool.end();
    }
}

main();
