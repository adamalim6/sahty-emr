import { getGlobalPool } from '../db/globalPg';
import * as fs from 'fs';
import * as path from 'path';

async function runMigrations() {
    console.log('--- Running DCI Synonyms Migrations ---');
    
    // Global
    const globalPool = getGlobalPool();
    const globalClient = await globalPool.connect();
    
    try {
        const globalSqlPath = path.join(__dirname, '../migrations/pg/global/018_create_dci_synonyms.sql');
        const globalSql = fs.readFileSync(globalSqlPath, 'utf8');

        console.log(`Executing global: ${globalSqlPath}...`);
        await globalClient.query('BEGIN');
        await globalClient.query(globalSql);
        await globalClient.query('COMMIT');
        console.log('✅ Global DCI Synonyms Migration Successful.');

        // Fetch all databases that start with "tenant_"
        const res = await globalClient.query(`
            SELECT datname
            FROM pg_database
            WHERE datname LIKE 'tenant_%'
            AND datistemplate = false
        `);
        
        const dbs = res.rows.map(row => row.datname);
        console.log(`Found ${dbs.length} tenant databases:`, dbs);

        const tenantSqlPath = path.join(__dirname, '../migrations/pg/tenant/062_create_dci_synonyms.sql');
        const tenantSql = fs.readFileSync(tenantSqlPath, 'utf8');

        for (const db of dbs) {
            console.log(`\nApplying to database ${db}...`);
            
            const { Pool } = require('pg');
            const tenantPool = new Pool({
                host: process.env.PG_HOST || 'localhost',
                port: parseInt(process.env.PG_PORT || '5432'),
                database: db,
                user: process.env.PG_USER || 'sahty',
                password: process.env.PG_PASSWORD || 'sahty_dev_2026',
            });
            const tClient = await tenantPool.connect();
            
            try {
                await tClient.query('BEGIN');
                await tClient.query(tenantSql);
                await tClient.query('COMMIT');
                console.log(`✅ Success for database ${db}`);
            } catch(e) {
                await tClient.query('ROLLBACK');
                console.error(`❌ Failed for database ${db}:`, e);
            } finally {
                tClient.release();
                await tenantPool.end();
            }
        }

    } catch (e) {
        console.error('❌ Migration framework failed:', e);
        process.exit(1);
    } finally {
        globalClient.release();
        await globalPool.end();
    }
}

runMigrations().catch(console.error);
