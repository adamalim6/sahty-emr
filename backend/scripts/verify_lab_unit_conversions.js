const { Client } = require('pg');

const GLOBAL_DB = 'postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global';

async function verifyDB(dbName, tableName) {
    console.log(`\nVerifying database: ${dbName}`);
    const client = new Client({ connectionString: `postgresql://sahty:sahty_dev_2026@localhost:5432/${dbName}` });
    try {
        await client.connect();

        // 1. Verify columns exist
        const colRes = await client.query(`
            SELECT column_name, is_nullable 
            FROM information_schema.columns 
            WHERE table_schema || '.' || table_name = $1
        `, [tableName]);
        
        const cols = colRes.rows.map(r => r.column_name);

        if (!cols.includes('conversion_factor') || !cols.includes('conversion_offset')) {
            throw new Error(`Missing new columns in ${tableName}`);
        }
        console.log('✅ New columns conversion_factor and conversion_offset exist');

        // 2. Verify legacy column removed
        if (cols.includes('conversion_to_canonical_formula')) {
            throw new Error(`Legacy column conversion_to_canonical_formula still exists in ${tableName}`);
        }
        console.log('✅ Legacy column conversion_to_canonical_formula removed');

        // 3. Verify NOT NULL constraint on new columns
        const cfNull = colRes.rows.find(r => r.column_name === 'conversion_factor').is_nullable;
        const coNull = colRes.rows.find(r => r.column_name === 'conversion_offset').is_nullable;
        
        if (cfNull !== 'NO' || coNull !== 'NO') {
            throw new Error(`Constraints missing: conversion_factor is_nullable=${cfNull}, conversion_offset is_nullable=${coNull}`);
        }

        // 3b. Verify no existing rows violate NOT NULL rules logically (if there were any rows)
        const nullCheck = await client.query(`
            SELECT count(*) 
            FROM ${tableName} 
            WHERE conversion_factor IS NULL OR conversion_offset IS NULL
        `);
        if (parseInt(nullCheck.rows[0].count) > 0) {
            throw new Error(`Found ${nullCheck.rows[0].count} rows with NULL conversion factors/offsets`);
        }
        console.log('✅ All existing rows have valid conversion values');

        // 4. Test insert
        // Find existing analyte and unit to use, otherwise skip test insert to avoid FK errors
        const analyteTable = dbName === 'sahty_global' ? 'public.lab_analytes' : 'reference.lab_analytes';
        const unitTable = dbName === 'sahty_global' ? 'public.units' : 'reference.units';
        
        const fkCheck = await client.query(`SELECT id FROM ${analyteTable} LIMIT 1`);
        const unitCheck = await client.query(`SELECT id FROM ${unitTable} LIMIT 1`);
        
        let analyte_id, unit_id;
        
        if (fkCheck.rows.length > 0 && unitCheck.rows.length > 0) {
            analyte_id = fkCheck.rows[0].id;
            unit_id = unitCheck.rows[0].id;
        }

        if (analyte_id && unit_id) {
            const tempId = '00000000-0000-0000-0000-000000000001';
            await client.query(`
                INSERT INTO ${tableName} (id, analyte_id, unit_id, is_canonical, conversion_factor, conversion_offset) 
                VALUES ($1, $2, $3, false, 2.5, 10.0)
                ON CONFLICT DO NOTHING
            `, [tempId, analyte_id, unit_id]);

            // Clean up
            await client.query(`DELETE FROM ${tableName} WHERE id = $1`, [tempId]);
            console.log('✅ Insert test with custom factor/offset successful');
        } else {
            console.log('⚠️ Skipped insert test due to missing foreign keys (analytes/units empty)');
        }

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

    await verifyDB('sahty_global', 'public.lab_analyte_units');

    for (const dbName of tenantDBs) {
        await verifyDB(dbName, 'reference.lab_analyte_units');
    }
}

run();
