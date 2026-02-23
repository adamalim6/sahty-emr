import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const baseConfig = {
    host: 'localhost',
    port: 5432,
    user: 'sahty',
    password: 'sahty_dev_2026'
};

async function applyToDatabase(dbName: string, filePath: string): Promise<void> {
    const pool = new Pool({ ...baseConfig, database: dbName });
    try {
        const sql = fs.readFileSync(filePath, 'utf-8');
        await pool.query(sql);
        console.log(`✅ ${dbName}: Migration applied successfully`);
    } catch (err: any) {
        console.error(`❌ ${dbName}: ${err.message}`);
    } finally {
        await pool.end();
    }
}

async function main() {
    console.log('Applying Units Migration...\n');

    const globalSql = path.join(__dirname, '../migrations/pg/global/013_units_catalog.sql');
    await applyToDatabase('sahty_global', globalSql);

    const tenantSql = path.join(__dirname, '../migrations/pg/tenant/057_units_catalog.sql');
    await applyToDatabase('tenant_ced91ced-fe46-45d1-8ead-b5d51bad5895', tenantSql);

    console.log('\n✅ Script complete.');
}

main().catch(console.error);
