const { Pool } = require('pg');

const globalPool = new Pool({ connectionString: 'postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global' });

const getInsertSql = (schema) => `
    INSERT INTO ${schema}.units (
        id,
        code,
        display,
        is_ucum,
        is_active,
        sort_order,
        requires_fluid_info,
        created_at,
        updated_at
    )
    VALUES (
        gen_random_uuid(),
        'uL',          -- ASCII-safe code
        'µL',          -- display label
        true,          -- UCUM compliant
        true,
        10,
        false,
        now(),
        now()
    )
    ON CONFLICT (code) DO NOTHING;
`;

const getVerifySql = (schema) => `
    SELECT code, display
    FROM ${schema}.units
    WHERE code = 'uL';
`;

async function executeInsert(client, dbName, schema) {
    try {
        await client.query(getInsertSql(schema));
        const res = await client.query(getVerifySql(schema));
        console.log(`[${dbName}] Inserted/Verified: ${res.rows[0]?.display} (${res.rows[0]?.code})`);
    } catch (e) {
        console.error(`[${dbName}] Failed:`, e.message);
    }
}

async function run() {
    const globalClient = await globalPool.connect();
    
    try {
        console.log('--- Seeding sahty_global ---');
        await executeInsert(globalClient, 'sahty_global', 'public');
        
        const res = await globalClient.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
        const tenants = res.rows.map(r => r.datname);
        
        console.log(`\n--- Seeding ${tenants.length} tenants ---`);
        for (const t of tenants) {
            const tPool = new Pool({ connectionString: `postgresql://sahty:sahty_dev_2026@localhost:5432/${t}` });
            const tClient = await tPool.connect();
            try {
                await executeInsert(tClient, t, 'reference');
            } finally {
                tClient.release();
                await tPool.end();
            }
        }
        
    } catch (e) {
        console.error('[FATAL]', e);
    } finally {
        globalClient.release();
        await globalPool.end();
    }
}

run();
