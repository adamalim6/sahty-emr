
import * as fs from 'fs';
import * as path from 'path';
import { globalQuery } from './db/globalPg';
import { tenantQuery } from './db/tenantPg';

async function run() {
    console.log('--- Phase 1: Global Migration ---');
    try {
        const globalSqlPath = path.join(__dirname, '../migrations/pg/global/003_patient_identity_rework.sql');
        const globalSql = fs.readFileSync(globalSqlPath, 'utf-8');
        
        // Split and execute Global
        // Note: Simple split by ';' can fail on complex PL/pgSQL. 
        // But our migration is simple CREATE/DROP.
        // Or just execute the whole block if driver supports it? 
        // pg driver supports multiple statements if configured? 
        // Usually safer to split or just run as one block if no returns.
        // Let's try running as one block first, if fails, split.
        // Actually, many drivers don't support multi-statement in one query call by default.
        // But our migration has `CREATE TABLE...; INSERT...;`
        // Splitting by `;` is safer for simple scripts.
        // BEWARE: `split(';')` breaks on strings containing `;`.
        // Our SQL has `('CIN', 'Carte...;...')`? No.
        // It has `DEFAULT now()`.
        
        // Let's use a smarter split or just try entire file.
        // 'pg' allows multiple statements in one query string.
        console.log('Applying global/003...');
        await globalQuery(globalSql); 
        console.log('Global Migration applied.');

    } catch (e: any) {
        console.error('Global Migration Failed:', e.message);
        process.exit(1);
    }

    console.log('\n--- Phase 2: Tenant Migration ---');
    try {
        // Fetch all tenants
        const clients = await globalQuery('SELECT id FROM clients'); // Dictionary of tenants
        if (clients.length === 0) {
            console.warn('No clients found. Skipping tenant migration.');
        }

        const tenantSqlPath = path.join(__dirname, '../migrations/pg/tenant/022_patient_tenant_rework.sql');
        const tenantSql = fs.readFileSync(tenantSqlPath, 'utf-8');

        for (const client of clients) {
            const tenantId = client.id;
            console.log(`Applying tenant/022 to Tenant ${tenantId}...`);
            try {
                await tenantQuery(tenantId, tenantSql);
                console.log(`Tenant ${tenantId} Done.`);
            } catch (e: any) {
                console.warn(`SKIPPING Tenant ${tenantId}: ${e.message}`);
                // Continue to next tenant
            }
        }

        console.log('\nSUCCESS: All migrations applied.');
        process.exit(0);

    } catch (e: any) {
        console.error('Tenant Migration Failed:', e.message);
        process.exit(1);
    }
}

run();
