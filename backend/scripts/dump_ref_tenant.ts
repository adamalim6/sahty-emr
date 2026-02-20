
import { getTenantPool } from '../db/tenantPg';

const REF_TENANT = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';

async function dumpSchema() {
    console.log(`Dumping full schema for reference tenant ${REF_TENANT}...`);
    const pool = getTenantPool(REF_TENANT);
    const client = await pool.connect();
    try {
        // 1. List all schemas
        const schemas = await client.query(`
            SELECT schema_name FROM information_schema.schemata 
            WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
            ORDER BY schema_name
        `);
        console.log('\n=== SCHEMAS ===');
        schemas.rows.forEach(r => console.log(` - ${r.schema_name}`));

        // 2. List ALL tables grouped by schema
        const tables = await client.query(`
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
            AND table_type = 'BASE TABLE'
            ORDER BY table_schema, table_name
        `);
        console.log('\n=== TABLES ===');
        let currentSchema = '';
        tables.rows.forEach(r => {
            if (r.table_schema !== currentSchema) {
                currentSchema = r.table_schema;
                console.log(`\n[${currentSchema}]`);
            }
            console.log(`  - ${r.table_name}`);
        });

        // 3. For each public table, dump its DDL (columns + types)
        console.log('\n=== PUBLIC TABLE DEFINITIONS ===');
        const publicTables = tables.rows.filter(r => r.table_schema === 'public');
        for (const t of publicTables) {
            const cols = await client.query(`
                SELECT column_name, data_type, column_default, is_nullable
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = $1
                ORDER BY ordinal_position
            `, [t.table_name]);
            console.log(`\nTABLE: ${t.table_name} (${cols.rows.length} columns)`);
            cols.rows.forEach(c => {
                console.log(`  ${c.column_name} ${c.data_type} ${c.is_nullable === 'NO' ? 'NOT NULL' : ''} ${c.column_default ? 'DEFAULT ' + c.column_default : ''}`);
            });
        }

    } finally {
        client.release();
    }
}

dumpSchema().catch(console.error);
