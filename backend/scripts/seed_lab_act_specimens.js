const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({ connectionString: 'postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global' });

function parseCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim() !== '');
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
        // split by comma avoiding commas inside quotes
        let inQuote = false;
        let currentVal = '';
        const values = [];
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuote = !inQuote;
            } else if (char === ',' && !inQuote) {
                values.push(currentVal);
                currentVal = '';
            } else {
                currentVal += char;
            }
        }
        values.push(currentVal);
        
        const obj = {};
        headers.forEach((h, i) => {
            let val = values[i] !== undefined ? values[i].trim() : '';
            // normalize "True"/"False" to booleans if applicable, else strings
            if (val === 'True') val = true;
            else if (val === 'False') val = false;
            else if (val === '') val = null;
            // unescape quotes
            if (typeof val === 'string' && val.startsWith('"') && val.endsWith('"')) {
                val = val.substring(1, val.length - 1).replace(/""/g, '"');
            }
            obj[h] = val;
        });
        return obj;
    });
}

// Global script entry
async function run() {
    const client = await pool.connect();
    
    // Parse CSV
    const csvPath = '/Users/adamalim/Desktop/lab_act_specimen_types_mapping_seed_v3.csv';
    console.log(`[LOG] Parsing CSV: ${csvPath}`);
    const rows = parseCSV(csvPath);
    console.log(`[LOG] Extracted ${rows.length} valid mapping rows!`);

    if (rows.length === 0) return console.log('Empty CSV.');

    try {
        // 1. Map Global Specimen IDs to Codes
        const globalSpecRes = await client.query('SELECT id, code FROM public.lab_specimen_types');
        const globalIdToCode = {};
        for(const r of globalSpecRes.rows) globalIdToCode[r.id] = r.code;

        // 2. Get tenants from pg_database
        const tRes = await client.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
        const tenants = tRes.rows.map(r => r.datname);
        console.log(`[LOG] Discovered Tenant Databases: ${tenants.length}`);

        const targets = [
            { db: 'sahty_global', schema: 'public' },
            ...tenants.map(t => ({ db: t, schema: 'reference' }))
        ];

        for (const target of targets) {
            console.log(`\n================================`);
            console.log(`[LOG] Connecting and processing -> DB: ${target.db} (Schema: ${target.schema})`);
            const localizedPool = new Pool({ connectionString: `postgresql://sahty:sahty_dev_2026@localhost:5432/${target.db}` });
            const dbClient = await localizedPool.connect();

            try {
                // Fetch local mapping for resolving drift
                const localSpecRes = await dbClient.query(`SELECT id, code FROM ${target.schema}.lab_specimen_types`);
                const codeToLocalId = {};
                for(const r of localSpecRes.rows) codeToLocalId[r.code] = r.id;

                await dbClient.query('BEGIN');
                
                // create TEMP table
                await dbClient.query(`
                    CREATE TEMP TABLE temp_act_spec_map (
                        global_act_id UUID,
                        specimen_type_id UUID,
                        is_default BOOLEAN,
                        is_required BOOLEAN,
                        collection_instructions TEXT,
                        min_volume NUMERIC,
                        volume_unit TEXT,
                        transport_conditions TEXT,
                        stability_notes TEXT,
                        actif BOOLEAN,
                        sort_order INTEGER,
                        created_at TIMESTAMP WITH TIME ZONE,
                        updated_at TIMESTAMP WITH TIME ZONE
                    ) ON COMMIT DROP;
                `);

                const batchSize = 100;
                for(let b=0; b<rows.length; b+=batchSize) {
                     const sliceValues = [];
                     let sIdx = 1;
                     const sValueSets = [];
                     const sliceRows = rows.slice(b, b+batchSize);
                     for(const r of sliceRows) {
                         const code = globalIdToCode[r.specimen_type_id];
                         const localId = code ? codeToLocalId[code] : r.specimen_type_id; // Default fallback to CSV
                         
                         sValueSets.push(`($${sIdx++}, $${sIdx++}, $${sIdx++}, $${sIdx++}, $${sIdx++}, $${sIdx++}, $${sIdx++}, $${sIdx++}, $${sIdx++}, $${sIdx++}, $${sIdx++}, COALESCE($${sIdx++}, NOW()), COALESCE($${sIdx++}, NOW()))`);
                         sliceValues.push(
                            r.global_act_id, localId, r.is_default, r.is_required,
                            r.collection_instructions, r.min_volume, r.volume_unit, r.transport_conditions,
                            r.stability_notes, r.actif, r.sort_order, r.created_at, r.updated_at
                         );
                     }
                     const qry = `INSERT INTO temp_act_spec_map VALUES ${sValueSets.join(', ')}`;
                     await dbClient.query(qry, sliceValues);
                }
                
                // Do the ON CONFLICT UPSERT using the partial unique composite
                // Oh wait! There might be a constraint like unique(global_act_id, specimen_type_id)
                // Let's do an UPSERT
                const mergeQuery = `
                    INSERT INTO ${target.schema}.lab_act_specimen_types (
                        id, global_act_id, specimen_type_id, is_default, is_required, 
                        collection_instructions, min_volume, volume_unit, transport_conditions, 
                        stability_notes, actif, sort_order, created_at, updated_at
                    )
                    SELECT 
                        gen_random_uuid(), t.global_act_id, t.specimen_type_id, t.is_default, t.is_required, 
                        t.collection_instructions, t.min_volume, t.volume_unit, t.transport_conditions, 
                        t.stability_notes, t.actif, t.sort_order, t.created_at, t.updated_at
                    FROM temp_act_spec_map t
                    ON CONFLICT (global_act_id, specimen_type_id) DO UPDATE SET
                        is_default = EXCLUDED.is_default,
                        is_required = EXCLUDED.is_required,
                        collection_instructions = EXCLUDED.collection_instructions,
                        min_volume = EXCLUDED.min_volume,
                        volume_unit = EXCLUDED.volume_unit,
                        transport_conditions = EXCLUDED.transport_conditions,
                        stability_notes = EXCLUDED.stability_notes,
                        actif = EXCLUDED.actif,
                        sort_order = EXCLUDED.sort_order,
                        updated_at = NOW();
                `;
                
                const mergeRes = await dbClient.query(mergeQuery);
                console.log(`[SUCCESS] Database ${target.db} mappings executed: Upserted mapping items.`);
                
                const verify = await dbClient.query(`SELECT count(*) as total FROM ${target.schema}.lab_act_specimen_types`);
                console.log(`[VALIDATION] Total rows in ${target.schema}.lab_act_specimen_types : ${verify.rows[0].total}`);

                await dbClient.query('COMMIT');
            } catch(e) {
                await dbClient.query('ROLLBACK');
                console.error(`[FATAL] Error updating database ${target.db}:`, e);
            } finally {
                dbClient.release();
                await localizedPool.end();
            }
        }
        
    } catch (err) {
        console.error('[FATAL] Failed gathering global instances:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
