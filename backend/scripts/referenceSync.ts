
import { PoolClient } from 'pg';
import { globalQuery } from '../db/globalPg';
import { REFERENCE_TABLES_ORDER, REFERENCE_SCHEMA_DDL } from './referenceSchemaSpec';

export async function syncTenantReference(tenantClient: PoolClient, tenantId: string) {
    console.log(`[ReferenceSync] Starting sync for tenant ${tenantId}...`);

    // 1. Create Schema
    await tenantClient.query('CREATE SCHEMA IF NOT EXISTS reference');

    // 2. Create Tables (in order)
    for (const tableSpec of REFERENCE_SCHEMA_DDL) {
        console.log(`[ReferenceSync] Ensuring table reference.${tableSpec.tableName}...`);
        await tenantClient.query(tableSpec.ddl);
    }

    // 3. Truncate Tables (Reverse Order or CASCADE)
    // Using CASCADE on the first table might not be enough if there are complex webs.
    // Safest is to truncate all with CASCADE.
    for (const tableName of [...REFERENCE_TABLES_ORDER].reverse()) {
        try {
            await tenantClient.query(`TRUNCATE TABLE reference.${tableName} CASCADE`);
        } catch (e: any) {
            // Table might not exist yet if DDL failed or init issue, but we just ensured DDL above.
            // console.warn(`[ReferenceSync] Truncate warning for ${tableName}:`, e.message);
        }
    }

    // 4. Copy Data (in Topological Order)
    for (const tableName of REFERENCE_TABLES_ORDER) {
        try {
            // Check if source table exists in global (some might be optional or missing)
            // Check if source table exists in global (some might be in public, some in reference)
            const check = await globalQuery(`
                SELECT table_schema 
                FROM information_schema.tables 
                WHERE table_name = $1
                AND table_schema IN ('public', 'reference')
                LIMIT 1;
            `, [tableName]);
            
            if (check.length === 0) {
                console.warn(`[ReferenceSync] Source table ${tableName} does not exist in Global DB. Skipping.`);
                continue;
            }

            const sourceSchema = check[0].table_schema;

            // Fetch data from Global
            console.log(`[ReferenceSync] Fetching ${tableName} from Global (${sourceSchema})...`);
            const rows = await globalQuery(`SELECT * FROM ${sourceSchema}.${tableName}`);
            
            if (rows.length === 0) {
                 console.log(`[ReferenceSync] 0 rows in global ${tableName}. Skipping.`);
                 continue;
            }

            // Insert into Tenant Reference
            console.log(`[ReferenceSync] Inserting ${rows.length} rows into reference.${tableName}...`);
            
            // Generate INSERT statement dynamically
            const columns = Object.keys(rows[0]);
            const colsList = columns.map(c => `"${c}"`).join(', ');
            
            // Batch insert to avoid massive queries
            const BATCH_SIZE = 1000;
            for (let i = 0; i < rows.length; i += BATCH_SIZE) {
                const batch = rows.slice(i, i + BATCH_SIZE);
                const values: any[] = [];
                const placeholders: string[] = [];
                
                let paramIndex = 1;
                for (const row of batch) {
                    const rowPlaceholders: string[] = [];
                    for (const col of columns) {
                        rowPlaceholders.push(`$${paramIndex++}`);
                        let val = row[col];
                        if (val && typeof val === 'object' && !(val instanceof Date)) {
                            val = JSON.stringify(val);
                        }
                        values.push(val);
                    }
                    placeholders.push(`(${rowPlaceholders.join(', ')})`);
                }
                
                const sql = `
                    INSERT INTO reference."${tableName}" (${colsList})
                    VALUES ${placeholders.join(', ')}
                `;
                
                await tenantClient.query(sql, values);
            }
        } catch (e: any) {
            console.error(`[ReferenceSync] Failed to sync table ${tableName}:`, e);
            throw e; // Fail hard on sync error
        }
    }

    console.log(`[ReferenceSync] Sync complete for standard reference tables.`);

    // 5. Specialized Sync: Smart Phrases
    // Bypass the generic TRUNCATE CASCADE to protect tenant/user overrides.
    try {
        console.log(`[ReferenceSync] Syncing System Smart Phrases...`);
        await tenantClient.query('BEGIN;');
        const globalPhrases = await globalQuery(`
            SELECT id, trigger, trigger_search, label, description, body_html, is_active 
            FROM smart_phrases 
            WHERE scope = 'system'
        `);
        
        let inserted = 0;
        let updated = 0;
        let skipped = 0;
        
        for (const row of globalPhrases) {
            // Match globally scoped phrases by ID
            const existingRes = await tenantClient.query(`
                SELECT id, scope FROM smart_phrases WHERE id = $1
            `, [row.id]);
            
            if (existingRes.rows.length > 0) {
                const existing = existingRes.rows[0];
                if (existing.scope === 'system') {
                    // Update only if still scoped as system. Catch potential unique trigger violations.
                    try {
                        await tenantClient.query('SAVEPOINT sp_sp_update');
                        await tenantClient.query(`
                            UPDATE smart_phrases 
                            SET trigger = $2, trigger_search = $3, label = $4, description = $5, body_html = $6, is_active = $7, updated_at = NOW()
                            WHERE id = $1
                        `, [row.id, row.trigger, row.trigger_search, row.label, row.description, row.body_html, row.is_active]);
                        updated++;
                    } catch (updateErr) {
                        await tenantClient.query('ROLLBACK TO SAVEPOINT sp_sp_update');
                        skipped++; // e.g. collision with another trigger
                    }
                } else {
                    // Skip 'tenant' or 'user' scoped overrides
                    skipped++;
                }
            } else {
                // Not found by ID. Try to insert (but gracefully skip if trigger name collides with tenant phrase)
                try {
                    await tenantClient.query('SAVEPOINT sp_sp_insert');
                    await tenantClient.query(`
                        INSERT INTO smart_phrases (id, trigger, trigger_search, label, description, body_html, scope, tenant_id, user_id, is_active, created_at, updated_at)
                        VALUES ($1, $2, $3, $4, $5, $6, 'system', $7, NULL, $8, NOW(), NOW())
                    `, [row.id, row.trigger, row.trigger_search, row.label, row.description, row.body_html, tenantId, row.is_active]);
                    inserted++;
                } catch (insertErr) {
                    await tenantClient.query('ROLLBACK TO SAVEPOINT sp_sp_insert');
                    skipped++;
                }
            }
        }
        await tenantClient.query('COMMIT;');
        console.log(`[ReferenceSync] Smart Phrases Sync: ${inserted} inserted, ${updated} updated, ${skipped} skipped.`);
    } catch (e: any) {
        await tenantClient.query('ROLLBACK;');
        console.error(`[ReferenceSync] Failed to sync smart phrases:`, e);
        throw e;
    }

    console.log(`[ReferenceSync] Sync fully complete for tenant ${tenantId}.`);
}
