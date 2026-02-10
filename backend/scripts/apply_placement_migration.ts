import { tenantQuery } from '../db/tenantPg';
import { globalQuery } from '../db/globalPg';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
    const tenants = await globalQuery('SELECT id, designation FROM tenants ORDER BY created_at');
    console.log('Tenants:', tenants.map((t: any) => `${t.designation} (${t.id})`));

    const sqlPath = path.join(__dirname, '../migrations/pg/tenant/009_admissions_placement_refactor.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    for (const t of tenants) {
        console.log(`\n--- Applying migration to ${t.designation} ---`);
        try {
            await tenantQuery(t.id, sql);
            console.log('✅ Migration applied');

            // Verify new tables
            const tables = await tenantQuery(t.id, `
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name IN ('room_types', 'beds', 'patient_stays')
                ORDER BY table_name
            `);
            console.log('  New tables:', tables.map((r: any) => r.table_name));

            // Verify admissions columns
            const admCols = await tenantQuery(t.id, `
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'admissions' AND table_schema = 'public'
                ORDER BY ordinal_position
            `);
            console.log('  Admissions columns:', admCols.map((r: any) => r.column_name));

            // Verify rooms columns
            const roomCols = await tenantQuery(t.id, `
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'rooms' AND table_schema = 'public'
                ORDER BY ordinal_position
            `);
            console.log('  Rooms columns:', roomCols.map((r: any) => r.column_name));

        } catch (err: any) {
            console.error('❌ Error:', err.message);
        }
    }
    process.exit(0);
}

main();
