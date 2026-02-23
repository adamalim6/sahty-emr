import * as fs from 'fs';
import * as path from 'path';
import { getTenantPool } from '../db/tenantPg';

async function findMissingTables() {
    const baselineSql = fs.readFileSync(path.join(__dirname, '../migrations/pg/tenant/baseline_tenant_schema.sql'), 'utf-8');
    
    // Normalize quotes away
    const cleanSql = baselineSql.replace(/"/g, '');
    
    // Regex to match CREATE TABLE [IF NOT EXISTS] [schema.]table
    const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:([a-zA-Z0-9_]+)\.)?([a-zA-Z0-9_]+)/gi;
    let match;
    const baselineTables = new Set<string>();
    
    while ((match = tableRegex.exec(cleanSql)) !== null) {
        let schemaName = match[1] ? match[1].toLowerCase() : 'public';
        let tableName = match[2].toLowerCase();
        baselineTables.add(`${schemaName}.${tableName}`);
    }

    console.log(`Found ${baselineTables.size} tables in baseline_tenant_schema.sql.`);

    const refTenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
    const pool = getTenantPool(refTenantId);
    
    let dbTables = new Set<string>();
    try {
        const res = await pool.query(`
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
            AND table_type = 'BASE TABLE'
        `);
        res.rows.forEach(r => {
            dbTables.add(`${r.table_schema.toLowerCase()}.${r.table_name.toLowerCase()}`);
        });
    } finally {
        await pool.end();
    }

    console.log(`Found ${dbTables.size} tables in tenant ${refTenantId}.`);

    const missingInBaseline = Array.from(dbTables).filter(t => !baselineTables.has(t));
    const missingInDb = Array.from(baselineTables).filter(t => !dbTables.has(t));

    console.log('\n--- Missing in baseline_tenant_schema.sql (Present in DB but not in file) ---');
    missingInBaseline.sort().forEach(t => console.log(`- ${t}`));

    console.log('\n--- Missing in Database (Present in file but not in DB) ---');
    missingInDb.sort().forEach(t => console.log(`- ${t}`));
}

findMissingTables().catch(console.error);
