const fs = require('fs');
const { Client } = require('pg');

const SPECIMENS_CSV = '/Users/adamalim/Desktop/specimens_full.csv';
const CONTAINERS_CSV = '/Users/adamalim/Desktop/containers_full.csv';
const MAPPING_CSV = '/Users/adamalim/Desktop/mapping_full.csv';
const GLOBAL_DB = 'postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global';

function parseCSV(filePath) {
    const data = fs.readFileSync(filePath, 'utf8');
    const lines = data.trim().split('\n');
    let rows = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        // Simple fast parsing assuming no complex internal commas
        const cols = line.split(',').map(c => c.trim());
        rows.push(cols);
    }
    return rows;
}

// Helper to convert CSV string cleanly for SQL parameters
function parseValue(val, type) {
    if (!val || val.toLowerCase() === 'null' || val === '') return null;
    if (type === 'bool') return val.toLowerCase() === 'true' || val === '1';
    if (type === 'int') return parseInt(val, 10);
    return val;
}

async function seedDatabase(client, dbName, specimens, containers, mappings) {
    console.log(`\n===========================================`);
    console.log(`Seeding database: ${dbName}`);
    
    const schema = dbName === 'sahty_global' ? 'public' : 'reference';

    try {
        await client.query('BEGIN');

        // 1. Create TEMP tables
        await client.query(`
            CREATE TEMP TABLE temp_specimens (
                code text, libelle text, description text, actif boolean, sort_order integer,
                base_specimen text, matrix_type text
            );
            CREATE TEMP TABLE temp_containers (
                code text, libelle text, description text, additive_type text, tube_color text,
                actif boolean, sort_order integer
            );
            CREATE TEMP TABLE temp_mapping (
                specimen_type_code text, container_type_code text, is_default boolean,
                actif boolean, sort_order integer
            );
        `);

        // 2. Load data into TEMP tables
        // Specimens: code, libelle, description, actif, sort_order, base_specimen, matrix_type
        for (const r of specimens) {
            await client.query(`
                INSERT INTO temp_specimens VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
                r[0], r[1], parseValue(r[2], 'text'), parseValue(r[3], 'bool'), 
                parseValue(r[4], 'int'), r[5], r[6]
            ]);
        }

        // Containers: code, libelle, description, additive_type, tube_color, actif, sort_order
        for (const r of containers) {
            await client.query(`
                INSERT INTO temp_containers VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
                r[0], r[1], parseValue(r[2], 'text'), parseValue(r[3], 'text'),
                parseValue(r[4], 'text'), parseValue(r[5], 'bool'), parseValue(r[6], 'int')
            ]);
        }

        // Mapping: specimen_type_code, container_type_code, is_default, actif, sort_order
        for (const r of mappings) {
            await client.query(`
                INSERT INTO temp_mapping VALUES ($1, $2, $3, $4, $5)
            `, [
                r[0], r[1], parseValue(r[2], 'bool'), parseValue(r[3], 'bool'), parseValue(r[4], 'int')
            ]);
        }

        // 3. UPSERT logic via CTE to capture insert/updated counts via xmax system column!
        const specUpsert = await client.query(`
            WITH ins AS (
                INSERT INTO ${schema}.lab_specimen_types (
                    id, code, libelle, description, actif, sort_order, base_specimen, matrix_type, created_at, updated_at
                )
                SELECT gen_random_uuid(), code, libelle, description, COALESCE(actif, true), COALESCE(sort_order, 0), base_specimen, matrix_type, now(), now()
                FROM temp_specimens
                ON CONFLICT (code) DO UPDATE SET
                    libelle = EXCLUDED.libelle,
                    description = EXCLUDED.description,
                    actif = EXCLUDED.actif,
                    sort_order = EXCLUDED.sort_order,
                    base_specimen = EXCLUDED.base_specimen,
                    matrix_type = EXCLUDED.matrix_type,
                    updated_at = now()
                RETURNING (xmax = 0) AS is_insert
            )
            SELECT 
                count(NULLIF(is_insert, false)) AS inserted,
                count(NULLIF(is_insert, true)) AS updated
            FROM ins;
        `);

        const contUpsert = await client.query(`
            WITH ins AS (
                INSERT INTO ${schema}.lab_container_types (
                    id, code, libelle, description, additive_type, tube_color, actif, sort_order, created_at, updated_at
                )
                SELECT gen_random_uuid(), code, libelle, description, additive_type, tube_color, COALESCE(actif, true), COALESCE(sort_order, 0), now(), now()
                FROM temp_containers
                ON CONFLICT (code) DO UPDATE SET
                    libelle = EXCLUDED.libelle,
                    description = EXCLUDED.description,
                    additive_type = EXCLUDED.additive_type,
                    tube_color = EXCLUDED.tube_color,
                    actif = EXCLUDED.actif,
                    sort_order = EXCLUDED.sort_order,
                    updated_at = now()
                RETURNING (xmax = 0) AS is_insert
            )
            SELECT 
                count(NULLIF(is_insert, false)) AS inserted,
                count(NULLIF(is_insert, true)) AS updated
            FROM ins;
        `);

        const mapUpsert = await client.query(`
            WITH ins AS (
                INSERT INTO ${schema}.lab_specimen_container_types (
                    id, specimen_type_id, container_type_id, is_default, actif, sort_order, created_at, updated_at
                )
                SELECT gen_random_uuid(), s.id, c.id, COALESCE(m.is_default, false), COALESCE(m.actif, true), COALESCE(m.sort_order, 0), now(), now()
                FROM temp_mapping m
                JOIN ${schema}.lab_specimen_types s ON s.code = m.specimen_type_code
                JOIN ${schema}.lab_container_types c ON c.code = m.container_type_code
                ON CONFLICT (specimen_type_id, container_type_id) DO UPDATE SET
                    is_default = EXCLUDED.is_default,
                    actif = EXCLUDED.actif,
                    sort_order = EXCLUDED.sort_order,
                    updated_at = now()
                RETURNING (xmax = 0) AS is_insert
            )
            SELECT 
                count(NULLIF(is_insert, false)) AS inserted,
                count(NULLIF(is_insert, true)) AS updated
            FROM ins;
        `);

        // Check if any mapping rows failed to join effectively due to invalid codes
        const unmapped = await client.query(`
            SELECT count(*) FROM temp_mapping m
            LEFT JOIN ${schema}.lab_specimen_types s ON s.code = m.specimen_type_code
            LEFT JOIN ${schema}.lab_container_types c ON c.code = m.container_type_code
            WHERE s.id IS NULL OR c.id IS NULL
        `);
        if (unmapped.rows[0].count > 0) {
            throw new Error(`Integrity Error: Found ${unmapped.rows[0].count} mappings in CSV whose specimen_type_code or container_type_code did not match any record in the DB!`);
        }

        // Print Transaction Logging
        console.log(`[LOG] Specimens -> Inserted: ${specUpsert.rows[0].inserted}, Updated: ${specUpsert.rows[0].updated}`);
        console.log(`[LOG] Containers -> Inserted: ${contUpsert.rows[0].inserted}, Updated: ${contUpsert.rows[0].updated}`);
        console.log(`[LOG] Mappings  -> Inserted: ${mapUpsert.rows[0].inserted}, Updated: ${mapUpsert.rows[0].updated}`);

        await client.query('COMMIT');
        
        // Validations natively tested outside transaction bounds to reflect real DB state immediately
        const countS = await client.query(`SELECT count(*) FROM ${schema}.lab_specimen_types`);
        const countC = await client.query(`SELECT count(*) FROM ${schema}.lab_container_types`);
        const countM = await client.query(`SELECT count(*) FROM ${schema}.lab_specimen_container_types`);
        
        console.log(`[VALIDATION] Total Specimens: ${countS.rows[0].count} (Expected > 50)`);
        console.log(`[VALIDATION] Total Containers: ${countC.rows[0].count} (Expected > 20)`);
        console.log(`[VALIDATION] Total Mappings: ${countM.rows[0].count} (Expected > 15)`);

        if (countS.rows[0].count <= 50) throw new Error("Validation FAILED: Specimens <= 50");
        if (countC.rows[0].count <= 20) throw new Error("Validation FAILED: Containers <= 20");
        if (countM.rows[0].count <= 15) throw new Error("Validation FAILED: Mappings <= 15");

        // 4. Integrity check to ensure perfectly resolving UUID bounds 
        const joinIntegrity = await client.query(`
            SELECT COUNT(*) 
            FROM ${schema}.lab_specimen_container_types t
            LEFT JOIN ${schema}.lab_specimen_types s ON s.id = t.specimen_type_id
            LEFT JOIN ${schema}.lab_container_types c ON c.id = t.container_type_id
            WHERE s.id IS NULL OR c.id IS NULL
        `);
        if (joinIntegrity.rows[0].count !== '0') {
            throw new Error(`Validation FAILED: Found ${joinIntegrity.rows[0].count} orphaned mappings in DB.`);
        }
        console.log(`[VALIDATION] Orphan Mapping Dependencies: 0 (Flawless relation verified). ✅`);

    } catch (e) {
        await client.query('ROLLBACK');
        console.error(`❌ Transaction failed on ${dbName}: ${e.message}`);
    }
}

async function main() {
    console.log("Parsing CSV Files...");
    const specimens = parseCSV(SPECIMENS_CSV);
    const containers = parseCSV(CONTAINERS_CSV);
    const mappings = parseCSV(MAPPING_CSV);
    console.log(`Loaded from disk: ${specimens.length} specimens, ${containers.length} containers, ${mappings.length} mappings.`);

    const globalClient = new Client({ connectionString: GLOBAL_DB });
    let tenantDBs = [];
    try {
        await globalClient.connect();
        const res = await globalClient.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
        tenantDBs = res.rows.map(r => r.datname);
    } finally {
        await globalClient.end();
    }

    const allDBs = ['sahty_global', ...tenantDBs];
    
    for (const dbName of allDBs) {
        const client = new Client({ connectionString: `postgresql://sahty:sahty_dev_2026@localhost:5432/${dbName}` });
        try {
            await client.connect();
            await seedDatabase(client, dbName, specimens, containers, mappings);
        } finally {
            await client.end();
        }
    }
}

main().catch(console.error);
