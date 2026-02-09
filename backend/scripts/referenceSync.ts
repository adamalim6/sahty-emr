
import { PoolClient } from 'pg';
import { globalQuery } from '../db/globalPg';
import { REFERENCE_TABLES_ORDER, REFERENCE_SCHEMA_DDL } from './referenceSchemaSpec';

export async function syncTenantReference(tenantClient: PoolClient, tenantId: string) {
    console.log(`[ReferenceSync] Starting sync for tenant ${tenantId}...`);

    // 1. Create Schema
    await tenantClient.query('CREATE SCHEMA IF NOT EXISTS reference');

    // 2. Create Tables (in order)
    for (const tableSpec of REFERENCE_SCHEMA_DDL) {
        // console.log(`[ReferenceSync] Ensuring table reference.${tableSpec.tableName}...`);
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
            const check = await globalQuery(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = $1
                );
            `, [tableName]);
            
            if (!check[0].exists) {
                console.warn(`[ReferenceSync] Source table public.${tableName} does not exist in Global DB. Skipping.`);
                continue;
            }

            // Fetch data from Global
            // console.log(`[ReferenceSync] Fetching ${tableName} from Global...`);
            const rows = await globalQuery(`SELECT * FROM public.${tableName}`);
            
            if (rows.length === 0) continue;

            // Insert into Tenant Reference
            // console.log(`[ReferenceSync] Inserting ${rows.length} rows into reference.${tableName}...`);
            
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

    console.log(`[ReferenceSync] Sync complete for tenant ${tenantId}.`);
}
