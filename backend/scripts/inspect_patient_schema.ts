
import { Pool } from 'pg';

const TENANT_DB = 'tenant_ced91ced-fe46-45d1-8ead-b5d51bad5895';

async function run() {
    const pool = new Pool({ host:'localhost', port:5432, user:'sahty', password:'sahty_dev_2026', database: TENANT_DB });
    
    try {
        const tables = [
            'patients_tenant',
            'coverages',
            'patient_coverages',
            'patient_contacts',
            'patient_addresses',
            'patient_relationship_links'
        ];

        for (const tbl of tables) {
            console.log(`\n=== ${tbl} ===`);
            const res = await pool.query(`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name=$1 AND table_schema='public' ORDER BY ordinal_position`, [tbl]);
            if (res.rows.length === 0) {
                console.log('  (TABLE DOES NOT EXIST)');
            } else {
                res.rows.forEach((r: any) => console.log(`  ${r.column_name}: ${r.data_type} ${r.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${r.column_default ? 'DEFAULT ' + r.column_default : ''}`));
            }
        }

        // Also check constraints on patients_tenant
        console.log('\n=== patients_tenant CONSTRAINTS ===');
        const constraints = await pool.query(`
            SELECT conname, contype, pg_get_constraintdef(oid) as def 
            FROM pg_constraint 
            WHERE conrelid = 'public.patients_tenant'::regclass
        `);
        constraints.rows.forEach((r: any) => console.log(`  ${r.conname} (${r.contype}): ${r.def}`));

        // Check identity_ids constraints
        console.log('\n=== identity_ids CONSTRAINTS ===');
        const idConstraints = await pool.query(`
            SELECT conname, contype, pg_get_constraintdef(oid) as def 
            FROM pg_constraint 
            WHERE conrelid = 'public.identity_ids'::regclass
        `);
        idConstraints.rows.forEach((r: any) => console.log(`  ${r.conname} (${r.contype}): ${r.def}`));

    } finally {
        await pool.end();
        process.exit(0);
    }
}
run();
