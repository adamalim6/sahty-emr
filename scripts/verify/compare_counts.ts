/**
 * Migration Verification: Row Count Comparison
 * 
 * Compares row counts between SQLite source and PostgreSQL target
 * for both global and tenant databases.
 * 
 * Usage: npx ts-node scripts/verify/compare_counts.ts [tenant_id]
 */

import sqlite3 from 'sqlite3';
import { Pool } from 'pg';
import path from 'path';
import fs from 'fs';

const GLOBAL_SQLITE_PATH = path.join(__dirname, '../../backend/data/global/global.db');
const TENANTS_DIR = path.join(__dirname, '../../backend/data/tenants');

interface CountResult {
    table: string;
    sqliteCount: number;
    pgCount: number;
    match: boolean;
    diff: number;
}

async function sqliteCount(db: sqlite3.Database, table: string): Promise<number> {
    return new Promise((resolve, reject) => {
        db.get(`SELECT COUNT(*) as count FROM ${table}`, (err, row: any) => {
            if (err) {
                if (err.message.includes('no such table')) {
                    resolve(0);
                } else {
                    reject(err);
                }
            } else {
                resolve(row?.count || 0);
            }
        });
    });
}

async function pgCount(pool: Pool, table: string): Promise<number> {
    try {
        const result = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
        return parseInt(result.rows[0]?.count || '0');
    } catch (err: any) {
        if (err.message.includes('does not exist')) {
            return 0;
        }
        throw err;
    }
}

async function compareGlobal(): Promise<CountResult[]> {
    console.log('\n📊 Comparing Global Database');
    console.log('─'.repeat(50));
    
    const results: CountResult[] = [];
    
    if (!fs.existsSync(GLOBAL_SQLITE_PATH)) {
        console.log('⚠️ SQLite global.db not found, skipping');
        return results;
    }
    
    const sqliteDb = new sqlite3.Database(GLOBAL_SQLITE_PATH);
    const pgPool = new Pool({
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT || '5432'),
        user: process.env.PG_USER || 'sahty',
        password: process.env.PG_PASSWORD || 'sahty_dev_2026',
        database: 'sahty_global'
    });
    
    const tables = [
        'clients', 'organismes', 'users', 'patients',
        'global_products', 'global_suppliers', 'global_dci',
        'global_roles', 'global_actes', 'global_atc', 'global_emdn',
        'global_product_price_history'
    ];
    
    try {
        for (const table of tables) {
            const sqliteC = await sqliteCount(sqliteDb, table);
            const pgC = await pgCount(pgPool, table);
            const match = sqliteC === pgC;
            
            results.push({
                table,
                sqliteCount: sqliteC,
                pgCount: pgC,
                match,
                diff: pgC - sqliteC
            });
            
            const status = match ? '✅' : '❌';
            console.log(`${status} ${table.padEnd(30)} SQLite: ${sqliteC.toString().padStart(6)} | PG: ${pgC.toString().padStart(6)}`);
        }
    } finally {
        sqliteDb.close();
        await pgPool.end();
    }
    
    return results;
}

async function compareTenant(tenantId: string): Promise<CountResult[]> {
    console.log(`\n📊 Comparing Tenant: ${tenantId}`);
    console.log('─'.repeat(50));
    
    const results: CountResult[] = [];
    const sqlitePath = path.join(TENANTS_DIR, `client_${tenantId}`, 'tenant.db');
    
    if (!fs.existsSync(sqlitePath)) {
        console.log(`⚠️ SQLite tenant.db not found for ${tenantId}`);
        return results;
    }
    
    const sqliteDb = new sqlite3.Database(sqlitePath);
    const pgPool = new Pool({
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT || '5432'),
        user: process.env.PG_USER || 'sahty',
        password: process.env.PG_PASSWORD || 'sahty_dev_2026',
        database: `tenant_${tenantId}`
    });
    
    const tables = [
        'current_stock', 'inventory_movements', 'stock_reservations', 'product_wac',
        'delivery_notes', 'delivery_note_items', 'delivery_note_layers',
        'purchase_orders', 'po_items',
        'stock_demands', 'stock_demand_lines', 'stock_transfers', 'stock_transfer_lines',
        'users', 'roles', 'services', 'locations',
        'admissions', 'prescriptions', 'appointments',
        'product_configs', 'product_suppliers', 'product_price_versions'
    ];
    
    try {
        for (const table of tables) {
            const sqliteC = await sqliteCount(sqliteDb, table);
            const pgC = await pgCount(pgPool, table);
            const match = sqliteC === pgC;
            
            if (sqliteC > 0 || pgC > 0) { // Only show tables with data
                results.push({
                    table,
                    sqliteCount: sqliteC,
                    pgCount: pgC,
                    match,
                    diff: pgC - sqliteC
                });
                
                const status = match ? '✅' : '❌';
                console.log(`${status} ${table.padEnd(30)} SQLite: ${sqliteC.toString().padStart(6)} | PG: ${pgC.toString().padStart(6)}`);
            }
        }
    } finally {
        sqliteDb.close();
        await pgPool.end();
    }
    
    return results;
}

async function main() {
    console.log('='.repeat(60));
    console.log('MIGRATION VERIFICATION: ROW COUNT COMPARISON');
    console.log('='.repeat(60));
    
    const tenantId = process.argv[2];
    const allResults: Record<string, CountResult[]> = {};
    
    // Global comparison
    allResults['global'] = await compareGlobal();
    
    // Tenant comparison
    if (tenantId) {
        allResults[tenantId] = await compareTenant(tenantId);
    } else {
        // Compare all tenants
        const dirs = fs.readdirSync(TENANTS_DIR).filter(d => 
            d.startsWith('client_') && 
            fs.existsSync(path.join(TENANTS_DIR, d, 'tenant.db'))
        );
        
        for (const dir of dirs) {
            const tid = dir.replace('client_', '');
            allResults[tid] = await compareTenant(tid);
        }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    
    let totalMismatches = 0;
    for (const [db, results] of Object.entries(allResults)) {
        const mismatches = results.filter(r => !r.match);
        if (mismatches.length > 0) {
            console.log(`\n❌ ${db}: ${mismatches.length} mismatch(es)`);
            for (const m of mismatches) {
                console.log(`   ${m.table}: diff = ${m.diff}`);
            }
            totalMismatches += mismatches.length;
        } else if (results.length > 0) {
            console.log(`✅ ${db}: All ${results.length} tables match`);
        }
    }
    
    if (totalMismatches === 0) {
        console.log('\n✅ All row counts match! Migration verified.');
        return 0;
    } else {
        console.log(`\n❌ ${totalMismatches} mismatch(es) found. Review migration.`);
        return 1;
    }
}

main()
    .then(code => process.exit(code))
    .catch(err => {
        console.error('Verification failed:', err);
        process.exit(1);
    });
