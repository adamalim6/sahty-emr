const { Client } = require('pg');

const GLOBAL_DB = 'postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global';

// Codes from missing_units_extended.csv to check
const targetCodes = [
    'MM_H', 'ML_MIN_1_73M2', 'MFI', 'AU', 'MMOL_KG', 'CELLS_UL', 
    'COPIES_UL', 'LOG10_COPIES_UL', 'MMOL_MOL', 'NG_DU', 'UG_G_CREAT', 
    'MG_G_CREAT', 'MMOL_MOL_CREAT', 'PERCENT_ACTIVITY', 'SEC', 'RATIO_NORMALIZED'
];

async function verifyDB(dbName) {
    console.log(`\nVerifying database: ${dbName}`);
    const client = new Client({ connectionString: `postgresql://sahty:sahty_dev_2026@localhost:5432/${dbName}` });
    try {
        await client.connect();
        const tableName = dbName === 'sahty_global' ? 'public.units' : 'reference.units';

        // 1. Ensure no duplicate codes (the unique constraint ensures this, but let's double check)
        const dupes = await client.query(`
            SELECT code, count(*) 
            FROM ${tableName} 
            GROUP BY code 
            HAVING count(*) > 1
        `);
        if (dupes.rows.length > 0) {
            throw new Error(`Found duplicates codes in ${tableName}: ${JSON.stringify(dupes.rows)}`);
        }
        console.log('✅ No duplicate unit codes found');

        // 2. Count total rows and ensure target codes exist
        const checkCodesQuery = targetCodes.map((_, i) => `$${i + 1}`).join(',');
        const exists = await client.query(`
            SELECT code 
            FROM ${tableName} 
            WHERE code IN (${checkCodesQuery})
        `, targetCodes);

        const foundCodes = exists.rows.map(r => r.code);
        const missing = targetCodes.filter(c => !foundCodes.includes(c));
        
        if (missing.length > 0) {
            throw new Error(`Missing expected units: ${missing.join(', ')}`);
        }
        console.log(`✅ All ${targetCodes.length} target unit codes successfully verified as present`);

        const totalRes = await client.query(`SELECT count(*) FROM ${tableName}`);
        console.log(`✅ Total unit rows in ${tableName}: ${totalRes.rows[0].count}`);

    } catch (err) {
        console.error(`❌ Verification failed for ${dbName}:`, err.message);
        process.exitCode = 1;
    } finally {
        await client.end();
    }
}

async function run() {
    const globalClient = new Client({ connectionString: GLOBAL_DB });
    let tenantDBs = [];
    try {
        await globalClient.connect();
        const res = await globalClient.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
        tenantDBs = res.rows.map(r => r.datname);
    } catch (err) {
        console.error('Error finding tenant DBs', err.message);
        return;
    } finally {
        await globalClient.end();
    }

    await verifyDB('sahty_global');

    for (const dbName of tenantDBs) {
        await verifyDB(dbName);
    }
}

run();
