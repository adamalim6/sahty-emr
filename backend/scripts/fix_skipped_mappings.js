const fs = require('fs');
const { Client } = require('pg');

const CSV_FILE = '/Users/adamalim/Desktop/lab_analyte_units_mapping_final.csv';
const GLOBAL_DB = 'postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global';

// Map the hardcoded CSV IDs to their respective unit codes
const hardcodedToCode = {
    '311f23f0-d95d-42c9-9975-b1120a01375b': 'MM_H',
    '76d79a73-be91-47ff-9dff-5a29a182f3fd': 'ML_MIN_1_73M2',
    'e15ffd52-575d-42f5-acd1-108d7d0997e1': 'MFI'
};

async function main() {
    console.log(`Parsing missing mappings from CSV...`);
    const csvData = fs.readFileSync(CSV_FILE, 'utf8');
    const lines = csvData.trim().split('\n');
    let skippedRows = [];

    // Filter down to only the 3 skipped mappings using their hardcoded keys
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const splits = line.split(',');
        const rowUnitId = splits[1].trim();

        if (hardcodedToCode[rowUnitId]) {
            skippedRows.push({
                analyte_id: splits[0].trim(),
                unit_code: hardcodedToCode[rowUnitId], // Convert hardcoded ID to dynamic Code
                is_default: splits[2].trim().toLowerCase() === 'true',
                is_canonical: splits[3].trim().toLowerCase() === 'true',
                actif: splits[4].trim().toLowerCase() === 'true',
                created_at: splits[5].trim(),
                updated_at: splits[6].trim(),
                conversion_factor: parseFloat(splits[7].trim()),
                conversion_offset: parseFloat(splits[8].trim())
            });
        }
    }

    console.log(`Found ${skippedRows.length} mappings to dynamically fix in tenant databases.\n`);

    const globalClient = new Client({ connectionString: GLOBAL_DB });
    let tenantDBs = [];
    try {
        await globalClient.connect();
        const res = await globalClient.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
        tenantDBs = res.rows.map(r => r.datname);
    } finally {
        await globalClient.end();
    }

    for (const dbName of tenantDBs) {
        console.log(`Fixing tenant: ${dbName}...`);
        const client = new Client({ connectionString: `postgresql://sahty:sahty_dev_2026@localhost:5432/${dbName}` });
        try {
            await client.connect();

            // Resolve the live tenant unit IDs from the codes dynamically
            const unitRes = await client.query(`
                SELECT id, code FROM reference.units 
                WHERE code IN ('MM_H', 'ML_MIN_1_73M2', 'MFI')
            `);
            const codeToLiveId = {};
            unitRes.rows.forEach(r => codeToLiveId[r.code] = r.id);

            let insertedCount = 0;
            for (const row of skippedRows) {
                const liveUnitId = codeToLiveId[row.unit_code];
                if (!liveUnitId) {
                    console.error(`⚠️ Could not find live unit ID for code ${row.unit_code}`);
                    continue;
                }

                // Insert into reference.lab_analyte_units using the valid live ID
                const insertRes = await client.query(`
                    INSERT INTO reference.lab_analyte_units 
                    (id, analyte_id, unit_id, is_default, is_canonical, actif, created_at, updated_at, conversion_factor, conversion_offset)
                    VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9)
                    ON CONFLICT (analyte_id, unit_id) DO NOTHING
                    RETURNING id
                `, [
                    row.analyte_id, liveUnitId, row.is_default, row.is_canonical, row.actif, 
                    row.created_at, row.updated_at, row.conversion_factor, row.conversion_offset
                ]);

                if (insertRes.rowCount > 0) insertedCount++;
            }
            console.log(`✅ Successfully mapped and inserted ${insertedCount} rows.\n`);
        } catch (err) {
            console.error(`❌ Error in ${dbName}: ${err.message}`);
        } finally {
            await client.end();
        }
    }
}

main().catch(console.error);
