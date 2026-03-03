import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';
import { getTenantPool } from '../db/tenantPg';

const TENANT_ID = 'ced91ced-fe46-45d1-8ead-b5d51bad5895'; // Admin's local dev tenant

async function main() {
    console.log(`[Migration 023] Starting lifecycle migration on tenant: ${TENANT_ID}`);
    const pool = await getTenantPool(TENANT_ID);
    
    try {
        const sqlPath = path.join(__dirname, '../migrations/pg/tenant/023_patient_diagnoses_lifecycle.sql');
        console.log(`[Migration 023] Reading SQL file at: ${sqlPath}`);
        const sql = fs.readFileSync(sqlPath, 'utf-8');

        console.log(`[Migration 023] Executing SQL...`);
        await pool.query(sql);
        console.log(`[Migration 023] Successfully added resolved_by_user_id, resolution_note, and voided_by_user_id columns.`);
    } catch (err) {
        console.error(`[Migration 023] FAILED:`, err);
    } finally {
        // Close the pool properly
        await pool.end();
        console.log(`[Migration 023] Finished.`);
        process.exit(0);
    }
}

main();
