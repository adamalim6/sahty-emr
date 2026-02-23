import { Client } from 'pg';

const isDryRun = process.argv.includes('--dry-run');

async function main() {
    console.log(`Starting DCI Composition Unit Migration...`);
    if (isDryRun) {
        console.log(`\n\x1b[33m==== DRY RUN MODE: No changes will be written to the database ====\x1b[0m\n`);
    } else {
        console.log(`\n\x1b[31m==== EXECUTION MODE: Changes WILL be written to the database ====\x1b[0m\n`);
        // Add a small safety delay
        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // 1. Connect to sahty_global to fetch all valid units
    const globalClient = new Client({
        user: 'sahty',
        host: 'localhost',
        database: 'sahty_global',
        password: 'sahty_dev_2026',
        port: 5432,
    });
    
    await globalClient.connect();
    console.log('Connected to sahty_global database (for units catalogs)');
    
    let unitMap: Record<string, string> = {}; // lowercase code/display -> uuid
    let validUnitIds = new Set<string>();

    try {
        const unitsRes = await globalClient.query(`SELECT id, code, display FROM public.units`);
        for (const u of unitsRes.rows) {
            validUnitIds.add(u.id);
            if (u.code) unitMap[u.code.toLowerCase()] = u.id;
            if (u.display) unitMap[u.display.toLowerCase()] = u.id;
        }

        // Add some hardcoded aliases mapping to correct unit UUIDs based on common issues
        const aliasMap: Record<string, string> = {
            'µg': 'mcg',
            'ui': 'iu'
        };

        for (const [alias, target] of Object.entries(aliasMap)) {
            const targetId = unitMap[target];
            if (targetId) {
                unitMap[alias] = targetId;
            }
        }

        console.log(`Loaded ${unitsRes.rowCount} units from global catalog.`);
    } catch (e) {
        console.error('Failed to load units:', e);
        await globalClient.end();
        process.exit(1);
    }

    // Helper function to resolve unit to UUID
    function resolveUnitId(unitStr: string | null | undefined): string | null {
        if (!unitStr) return null;
        if (validUnitIds.has(unitStr)) return unitStr; // Already a UUID
        return unitMap[unitStr.toLowerCase().trim()] || null;
    }

    // List of databases to migrate (sahty_global + all tenants)
    const databases = ['sahty_global'];
    
    const pgClient = new Client({
        user: 'sahty',
        host: 'localhost',
        database: 'postgres',
        password: 'sahty_dev_2026',
        port: 5432,
    });
    await pgClient.connect();
    try {
        const dbRes = await pgClient.query(`SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'`);
        databases.push(...dbRes.rows.map(r => r.datname));
    } finally {
        await pgClient.end();
    }

    // Process each database
    let totalRowsMigrated = 0;
    
    for (const dbName of databases) {
        console.log(`\n--- Inspecting database: ${dbName} ---`);
        const schemaAndTable = dbName === 'sahty_global' ? 'public.global_products' : 'reference.global_products';

        const client = new Client({
             user: 'sahty',
             host: 'localhost',
             database: dbName,
             password: 'sahty_dev_2026',
             port: 5432,
        });

        try {
             await client.connect();
             
             // Check if table exists
             const parsedSchema = schemaAndTable.split('.')[0];
             const parsedTable = schemaAndTable.split('.')[1];
             const tableCheck = await client.query(`
                 SELECT EXISTS (
                     SELECT FROM information_schema.tables 
                     WHERE table_schema = $1 AND table_name = $2
                 );
             `, [parsedSchema, parsedTable]);
             
             if (!tableCheck.rows[0].exists) {
                 console.log(`Skipping: Table ${schemaAndTable} does not exist in ${dbName}`);
                 await client.end();
                 continue;
             }

             const res = await client.query(`SELECT id, name, dci_composition FROM ${schemaAndTable} WHERE dci_composition IS NOT NULL`);
             let migratedCount = 0;
             let printPreviewCounter = 0;

             for (const row of res.rows) {
                 let composition: any[];
                 if (typeof row.dci_composition === 'string') {
                     try { composition = JSON.parse(row.dci_composition); } catch (e) { continue; }
                 } else {
                     composition = row.dci_composition;
                 }
                 
                 if (!Array.isArray(composition)) continue;

                 let isModified = false;
                 let oldCompositionStr = JSON.stringify(composition);

                 const newComposition = composition.map((comp: any) => {
                     // If it's already in the new format (amount_value + amount_unit_id), keep it
                     if ('amount_value' in comp && 'amount_unit_id' in comp) {
                         return comp;
                     }

                     let newComp: any = {
                         dciId: comp.dciId,
                         name: comp.name,
                         atcCode: comp.atcCode
                     };

                     // Drop old properties
                     let amountValue = comp.dosage;
                     let amountUnitStr = comp.unit;

                     // Handle old complex presentation structure
                     if (comp.presentation) {
                         const pres = comp.presentation;
                         amountValue = pres.numerator;
                         amountUnitStr = pres.numeratorUnit;
                         
                         const diluentValue = pres.denominator;
                         const diluentUnitStr = pres.denominatorUnit;

                         if (diluentValue !== undefined && diluentUnitStr) {
                             newComp.diluent_volume_value = parseFloat(diluentValue);
                             newComp.diluent_volume_unit_id = resolveUnitId(diluentUnitStr) || null; // Map string to UUID
                         }
                     }

                     // Remove weird fake complex units string markers from simple fields if any
                     if (amountUnitStr && amountUnitStr.startsWith('COMPLEX_')) {
                          // e.g. COMPLEX_MG_ML -> mg
                          amountUnitStr = amountUnitStr.replace('COMPLEX_', '').split('_')[0].toLowerCase(); // e.g., 'mg'
                     }

                     // Check if unit is mg/_ml string pattern directly via dosage/unit mapping if missing presentation
                     if (typeof amountUnitStr === 'string' && amountUnitStr.includes('/')) {
                         // Some legacy data might just have "mg / _ ml" directly in unit
                         // This is a complex logic, we assume standard parsing if `presentation` is missing
                         if (amountUnitStr.includes('mcg')) amountUnitStr = 'mcg';
                         else if (amountUnitStr.includes('mg')) amountUnitStr = 'mg';
                         else if (amountUnitStr.includes('g')) amountUnitStr = 'g';
                         else amountUnitStr = 'mg'; // Safe fallback
                     }

                     // Now map amount 
                     newComp.amount_value = parseFloat(amountValue) || 0;
                     newComp.amount_unit_id = resolveUnitId(amountUnitStr);
                     
                     // Fallback if we couldn't resolve the unit UUID
                     if (!newComp.amount_unit_id) {
                         // Default to mg if entirely missing or unresolvable
                         newComp.amount_unit_id = unitMap['mg']; 
                         if (isDryRun && printPreviewCounter < 3) {
                              console.log(`\x1b[33mWarning\x1b[0m: Could not resolve unit '${amountUnitStr}' for product ${row.name}. Defaulting to 'mg' UUID.`);
                         }
                     }
                     
                     isModified = true;
                     return newComp;
                 });

                 if (isModified) {
                     migratedCount++;
                     totalRowsMigrated++;

                     if (isDryRun) {
                         if (printPreviewCounter < 5) {
                             console.log(`\nExample Transformation [${row.name}] (${dbName}):`);
                             console.log(`  BEFORE: ${oldCompositionStr}`);
                             console.log(`  AFTER:  ${JSON.stringify(newComposition)}`);
                             printPreviewCounter++;
                         }
                     } else {
                         // Actually update
                         await client.query(`UPDATE ${schemaAndTable} SET dci_composition = $1::jsonb WHERE id = $2`, [JSON.stringify(newComposition), row.id]);
                     }
                 }
             }

             console.log(`Migrated ${migratedCount} products in ${dbName}.`);

        } catch (e) {
             console.error(`Error processing database ${dbName}:`, e);
        } finally {
             await client.end();
        }
    }

    await globalClient.end();
    
    console.log(`\nCompleted! Total rows affected: ${totalRowsMigrated}`);
    if (isDryRun) {
         console.log(`\x1b[32mThis was a DRY RUN. Run without --dry-run to commit changes.\x1b[0m`);
    } else {
         console.log(`\x1b[32mMigration fully committed to database.\x1b[0m`);
    }
}

main().catch(console.error);
