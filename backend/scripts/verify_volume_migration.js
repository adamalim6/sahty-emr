const { Pool } = require('pg');

const globalPool = new Pool({ connectionString: 'postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global' });

async function verifyDB(client, dbName, schemaName) {
    console.log(`\n================================`);
    console.log(`[VERIFY] Database: ${dbName} | Schema: ${schemaName}`);

    // 1. Ensure columns exist
    const colExistsRes = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = $1 AND table_name = 'lab_act_specimen_types' 
        AND column_name IN ('volume_unit_id', 'volume_unit_label')
    `, [schemaName]);
    
    if (colExistsRes.rows.length === 2) {
        console.log('✅ NEW COLUMNS: Successfully verified (volume_unit_id, volume_unit_label present)');
    } else {
        console.error('❌ NEW COLUMNS: Failed! Found only:', colExistsRes.rows.map(r => r.column_name));
    }

    // 2. Ensure legacy column is gone
    const legacyExistsRes = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = $1 AND table_name = 'lab_act_specimen_types' 
        AND column_name = 'volume_unit'
    `, [schemaName]);
    
    if (legacyExistsRes.rows.length === 0) {
        console.log('✅ LEGACY COLUMN: Successfully verified (volume_unit explicitly dropped)');
    } else {
        console.error('❌ LEGACY COLUMN: Failed! volume_unit still exists in table.');
    }

    // 3. Ensure no data was modified
    const dataRes = await client.query(`
        SELECT COUNT(*) as count 
        FROM ${schemaName}.lab_act_specimen_types 
        WHERE volume_unit_id IS NOT NULL
    `);
    
    const count = parseInt(dataRes.rows[0].count, 10);
    if (count === 0) {
        console.log('✅ ROW ISOLATION: Successfully verified (0 constraints altered organically/0 explicit insertions)');
    } else {
        console.error(`❌ ROW ISOLATION: Failed! Found ${count} rows with modified volume_unit_id!`);
    }
}

async function run() {
    const globalClient = await globalPool.connect();
    try {
        await verifyDB(globalClient, 'sahty_global', 'public');

        const tRes = await globalClient.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
        const tenants = tRes.rows.map(r => r.datname);

        for (const t of tenants) {
            const tPool = new Pool({ connectionString: `postgresql://sahty:sahty_dev_2026@localhost:5432/${t}` });
            const tClient = await tPool.connect();
            try {
                await verifyDB(tClient, t, 'reference');
            } finally {
                tClient.release();
                await tPool.end();
            }
        }
        
    } catch(e) {
        console.error('[FATAL ERROR]', e);
    } finally {
        globalClient.release();
        await globalPool.end();
    }
}

run();
