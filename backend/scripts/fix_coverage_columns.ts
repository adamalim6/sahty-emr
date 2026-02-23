import { Pool } from 'pg';

async function main() {
    const pool = new Pool({
        host: 'localhost', port: 5432, user: 'sahty',
        password: 'sahty_dev_2026',
        database: 'tenant_ced91ced-fe46-45d1-8ead-b5d51bad5895'
    });
    try {
        // Fix coverages table - add subscriber columns
        const coverageAlters = [
            'subscriber_first_name TEXT',
            'subscriber_last_name TEXT',
            'subscriber_identity_type TEXT',
            'subscriber_identity_value TEXT',
            'subscriber_issuing_country TEXT',
        ];
        for (const col of coverageAlters) {
            const colName = col.split(' ')[0];
            await pool.query(`ALTER TABLE coverages ADD COLUMN IF NOT EXISTS ${col}`);
            console.log(`[coverages] Added ${colName}`);
        }

        // Fix coverage_members table - add member columns
        const memberAlters = [
            'member_first_name TEXT',
            'member_last_name TEXT',
            'member_identity_type TEXT',
            'member_identity_value TEXT',
            'member_issuing_country TEXT',
        ];
        for (const col of memberAlters) {
            const colName = col.split(' ')[0];
            await pool.query(`ALTER TABLE coverage_members ADD COLUMN IF NOT EXISTS ${col}`);
            console.log(`[coverage_members] Added ${colName}`);
        }

        console.log('\nSUCCESS: All missing columns added to Hopital Test.');
    } catch(e: any) {
        console.error('FAILED:', e.message);
    } finally {
        await pool.end();
    }
}

main();
