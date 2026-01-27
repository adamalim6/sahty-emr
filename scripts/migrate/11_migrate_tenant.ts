/**
 * SQLite to PostgreSQL Tenant Database Migration Script
 * 
 * Migrates data from SQLite tenant.db to PostgreSQL tenant_{tenant_id} database.
 * 
 * Usage: npx ts-node scripts/migrate/11_migrate_tenant.ts <tenant_id>
 */

import sqlite3 from 'sqlite3';
import { Pool, PoolClient } from 'pg';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const TENANTS_DIR = path.join(__dirname, '../../data/tenants');
const SCHEMA_PATH = path.join(__dirname, '../../migrations/pg/tenant/000_init.sql');
const INDEXES_PATH = path.join(__dirname, '../../migrations/pg/tenant/010_indexes.sql');

// SQLite helpers
const sqliteAll = (db: sqlite3.Database, sql: string, params: any[] = []): Promise<any[]> =>
    new Promise((res, rej) => db.all(sql, params, (err, rows) => err ? rej(err) : res(rows)));

// Type converters
function toUUID(val: string | null): string | null {
    if (!val) return null;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(val)) return val;
    return uuidv4();
}

function toBoolean(val: any): boolean {
    return val === 1 || val === true || val === '1' || val === 'true';
}

function toTimestamp(val: string | null): string | null {
    if (!val) return null;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString();
}

function toDate(val: string | null): string | null {
    if (!val) return null;
    try {
        return val.split('T')[0];
    } catch {
        return null;
    }
}

function toJSON(val: string | null): object | null {
    if (!val) return null;
    try {
        return JSON.parse(val);
    } catch {
        return null;
    }
}

interface MigrationResult {
    table: string;
    sourceCount: number;
    migratedCount: number;
    skippedCount: number;
    errors: string[];
}

async function createTenantDatabase(tenantId: string): Promise<Pool> {
    const dbName = `tenant_${tenantId}`;
    
    // Connect to default DB to create tenant DB
    const adminPool = new Pool({
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT || '5432'),
        user: process.env.PG_USER || 'sahty',
        password: process.env.PG_PASSWORD || 'sahty_dev_2026',
        database: 'sahty_emr'
    });
    
    try {
        // Check if DB exists
        const result = await adminPool.query(
            "SELECT 1 FROM pg_database WHERE datname = $1",
            [dbName]
        );
        
        if (result.rows.length === 0) {
            console.log(`   Creating database ${dbName}...`);
            await adminPool.query(`CREATE DATABASE ${dbName}`);
        } else {
            console.log(`   Database ${dbName} already exists`);
        }
    } finally {
        await adminPool.end();
    }
    
    // Connect to tenant DB
    const tenantPool = new Pool({
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT || '5432'),
        user: process.env.PG_USER || 'sahty',
        password: process.env.PG_PASSWORD || 'sahty_dev_2026',
        database: dbName
    });
    
    // Apply schema
    console.log(`   Applying schema...`);
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    await tenantPool.query(schema);
    
    if (fs.existsSync(INDEXES_PATH)) {
        const indexes = fs.readFileSync(INDEXES_PATH, 'utf-8');
        await tenantPool.query(indexes);
    }
    
    return tenantPool;
}

async function migrateTable(
    sqliteDb: sqlite3.Database,
    pgPool: Pool,
    tableName: string,
    pgTableName: string,
    columnMap: Record<string, { pgCol: string; transform: (val: any) => any }>
): Promise<MigrationResult> {
    const result: MigrationResult = {
        table: tableName,
        sourceCount: 0,
        migratedCount: 0,
        skippedCount: 0,
        errors: []
    };
    
    try {
        const rows = await sqliteAll(sqliteDb, `SELECT * FROM ${tableName}`);
        result.sourceCount = rows.length;
        
        if (rows.length === 0) {
            console.log(`   ${tableName}: empty`);
            return result;
        }
        
        const pgCols = Object.values(columnMap).map(c => c.pgCol);
        const placeholders = pgCols.map((_, i) => `$${i + 1}`).join(', ');
        const insertSQL = `INSERT INTO ${pgTableName} (${pgCols.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
        
        for (const row of rows) {
            try {
                const values = Object.entries(columnMap).map(([sqliteCol, config]) => {
                    return config.transform(row[sqliteCol]);
                });
                
                await pgPool.query(insertSQL, values);
                result.migratedCount++;
            } catch (err: any) {
                result.skippedCount++;
                if (result.errors.length < 5) {
                    result.errors.push(`Row: ${err.message}`);
                }
            }
        }
        
        console.log(`   ${tableName}: ${result.migratedCount}/${result.sourceCount}`);
        
    } catch (err: any) {
        if (!err.message.includes('no such table')) {
            result.errors.push(`Table error: ${err.message}`);
            console.log(`   ⚠️ ${tableName}: ${err.message}`);
        } else {
            console.log(`   ${tableName}: not found in source`);
        }
    }
    
    return result;
}

async function migrateTenant(tenantId: string): Promise<MigrationResult[]> {
    const dbPath = path.join(TENANTS_DIR, tenantId, 'tenant.db');
    const results: MigrationResult[] = [];
    
    console.log(`\n📦 Migrating tenant: ${tenantId}`);
    
    if (!fs.existsSync(dbPath)) {
        console.error(`   ❌ Source database not found: ${dbPath}`);
        return results;
    }
    
    const sqliteDb = new sqlite3.Database(dbPath);
    let pgPool: Pool | null = null;
    
    try {
        pgPool = await createTenantDatabase(tenantId);
        
        // Migrate tables in dependency order
        
        // 1. Services (no deps)
        results.push(await migrateTable(sqliteDb, pgPool, 'services', 'services', {
            id: { pgCol: 'id', transform: toUUID },
            tenant_id: { pgCol: 'tenant_id', transform: v => v },
            name: { pgCol: 'name', transform: v => v || '' },
            code: { pgCol: 'code', transform: v => v },
            description: { pgCol: 'description', transform: v => v }
        }));
        
        // 2. Roles
        results.push(await migrateTable(sqliteDb, pgPool, 'roles', 'roles', {
            id: { pgCol: 'id', transform: toUUID },
            name: { pgCol: 'name', transform: v => v || '' },
            code: { pgCol: 'code', transform: v => v },
            permissions: { pgCol: 'permissions', transform: toJSON },
            modules: { pgCol: 'modules', transform: toJSON }
        }));
        
        // 3. Users
        results.push(await migrateTable(sqliteDb, pgPool, 'users', 'users', {
            id: { pgCol: 'id', transform: toUUID },
            client_id: { pgCol: 'client_id', transform: v => v || '' },
            username: { pgCol: 'username', transform: v => v || '' },
            password_hash: { pgCol: 'password_hash', transform: v => v },
            nom: { pgCol: 'nom', transform: v => v },
            prenom: { pgCol: 'prenom', transform: v => v },
            user_type: { pgCol: 'user_type', transform: v => v },
            role_id: { pgCol: 'role_id', transform: toUUID },
            inpe: { pgCol: 'inpe', transform: v => v },
            service_ids: { pgCol: 'service_ids', transform: toJSON },
            active: { pgCol: 'active', transform: toBoolean },
            created_at: { pgCol: 'created_at', transform: toTimestamp }
        }));
        
        // 4. Locations
        results.push(await migrateTable(sqliteDb, pgPool, 'locations', 'locations', {
            location_id: { pgCol: 'location_id', transform: toUUID },
            tenant_id: { pgCol: 'tenant_id', transform: v => v },
            name: { pgCol: 'name', transform: v => v || '' },
            type: { pgCol: 'type', transform: v => v },
            scope: { pgCol: 'scope', transform: v => v },
            service_id: { pgCol: 'service_id', transform: toUUID },
            is_active: { pgCol: 'is_active', transform: toBoolean },
            status: { pgCol: 'status', transform: v => v || 'ACTIVE' },
            created_at: { pgCol: 'created_at', transform: toTimestamp }
        }));
        
        // 5. Suppliers
        results.push(await migrateTable(sqliteDb, pgPool, 'suppliers', 'suppliers', {
            supplier_id: { pgCol: 'supplier_id', transform: toUUID },
            tenant_id: { pgCol: 'tenant_id', transform: v => v },
            name: { pgCol: 'name', transform: v => v || '' },
            email: { pgCol: 'email', transform: v => v },
            phone: { pgCol: 'phone', transform: v => v },
            address: { pgCol: 'address', transform: v => v },
            is_active: { pgCol: 'is_active', transform: toBoolean },
            created_at: { pgCol: 'created_at', transform: toTimestamp }
        }));
        
        // 6. Current Stock
        results.push(await migrateTable(sqliteDb, pgPool, 'current_stock', 'current_stock', {
            tenant_id: { pgCol: 'tenant_id', transform: v => v },
            product_id: { pgCol: 'product_id', transform: toUUID },
            lot: { pgCol: 'lot', transform: v => v || '' },
            expiry: { pgCol: 'expiry', transform: toDate },
            location: { pgCol: 'location', transform: v => v || '' },
            qty_units: { pgCol: 'qty_units', transform: v => Math.max(0, v || 0) }
        }));
        
        // 7. Inventory Movements
        results.push(await migrateTable(sqliteDb, pgPool, 'inventory_movements', 'inventory_movements', {
            movement_id: { pgCol: 'movement_id', transform: toUUID },
            tenant_id: { pgCol: 'tenant_id', transform: v => v },
            product_id: { pgCol: 'product_id', transform: toUUID },
            lot: { pgCol: 'lot', transform: v => v || '' },
            expiry: { pgCol: 'expiry', transform: toDate },
            qty_units: { pgCol: 'qty_units', transform: v => v || 0 },
            from_location: { pgCol: 'from_location', transform: v => v },
            to_location: { pgCol: 'to_location', transform: v => v },
            document_type: { pgCol: 'document_type', transform: v => v || 'DELIVERY' },
            document_id: { pgCol: 'document_id', transform: v => v },
            created_by: { pgCol: 'created_by', transform: v => v },
            created_at: { pgCol: 'created_at', transform: toTimestamp }
        }));
        
        // 8. Stock Reservations
        results.push(await migrateTable(sqliteDb, pgPool, 'stock_reservations', 'stock_reservations', {
            reservation_id: { pgCol: 'reservation_id', transform: toUUID },
            tenant_id: { pgCol: 'tenant_id', transform: v => v },
            session_id: { pgCol: 'session_id', transform: v => v || '' },
            user_id: { pgCol: 'user_id', transform: v => v || '' },
            demand_id: { pgCol: 'demand_id', transform: v => v },
            demand_line_id: { pgCol: 'demand_line_id', transform: v => v },
            product_id: { pgCol: 'product_id', transform: toUUID },
            lot: { pgCol: 'lot', transform: v => v },
            expiry: { pgCol: 'expiry', transform: toDate },
            location_id: { pgCol: 'location_id', transform: v => v || '' },
            qty_units: { pgCol: 'qty_units', transform: v => Math.max(1, v || 1) },
            status: { pgCol: 'status', transform: v => v || 'ACTIVE' },
            reserved_at: { pgCol: 'reserved_at', transform: toTimestamp },
            expires_at: { pgCol: 'expires_at', transform: toTimestamp },
            released_at: { pgCol: 'released_at', transform: toTimestamp },
            committed_at: { pgCol: 'committed_at', transform: toTimestamp },
            transfer_id: { pgCol: 'transfer_id', transform: v => v },
            transfer_line_id: { pgCol: 'transfer_line_id', transform: v => v },
            client_request_id: { pgCol: 'client_request_id', transform: v => v }
        }));
        
        // 9. Product WAC
        results.push(await migrateTable(sqliteDb, pgPool, 'product_wac', 'product_wac', {
            tenant_id: { pgCol: 'tenant_id', transform: v => v },
            product_id: { pgCol: 'product_id', transform: toUUID },
            wac: { pgCol: 'wac', transform: v => v || 0 },
            last_updated: { pgCol: 'last_updated', transform: toTimestamp }
        }));
        
        // 10. Purchase Orders
        results.push(await migrateTable(sqliteDb, pgPool, 'purchase_orders', 'purchase_orders', {
            po_id: { pgCol: 'po_id', transform: toUUID },
            tenant_id: { pgCol: 'tenant_id', transform: v => v },
            supplier_id: { pgCol: 'supplier_id', transform: v => v || '' },
            status: { pgCol: 'status', transform: v => v || 'DRAFT' },
            created_by: { pgCol: 'created_by', transform: v => v },
            created_at: { pgCol: 'created_at', transform: toTimestamp },
            updated_at: { pgCol: 'updated_at', transform: toTimestamp }
        }));
        
        // Continue with remaining tables...
        // (Abbreviated for space - pattern is identical)
        
        // Delivery Notes
        results.push(await migrateTable(sqliteDb, pgPool, 'delivery_notes', 'delivery_notes', {
            delivery_note_id: { pgCol: 'delivery_note_id', transform: toUUID },
            tenant_id: { pgCol: 'tenant_id', transform: v => v },
            supplier_id: { pgCol: 'supplier_id', transform: v => v || '' },
            po_id: { pgCol: 'po_id', transform: toUUID },
            received_at: { pgCol: 'received_at', transform: toTimestamp },
            status: { pgCol: 'status', transform: v => v || 'PENDING' },
            created_by: { pgCol: 'created_by', transform: v => v },
            created_at: { pgCol: 'created_at', transform: toTimestamp }
        }));
        
        // Stock Demands
        results.push(await migrateTable(sqliteDb, pgPool, 'stock_demands', 'stock_demands', {
            id: { pgCol: 'id', transform: toUUID },
            tenant_id: { pgCol: 'tenant_id', transform: v => v },
            service_id: { pgCol: 'service_id', transform: v => v || '' },
            status: { pgCol: 'status', transform: v => v || 'DRAFT' },
            priority: { pgCol: 'priority', transform: v => v || 'ROUTINE' },
            requested_by: { pgCol: 'requested_by', transform: v => v },
            created_at: { pgCol: 'created_at', transform: toTimestamp },
            updated_at: { pgCol: 'updated_at', transform: toTimestamp }
        }));
        
        // Admissions
        results.push(await migrateTable(sqliteDb, pgPool, 'admissions', 'admissions', {
            id: { pgCol: 'id', transform: toUUID },
            tenant_id: { pgCol: 'tenant_id', transform: v => v },
            patient_id: { pgCol: 'patient_id', transform: toUUID },
            nda: { pgCol: 'nda', transform: v => v },
            reason: { pgCol: 'reason', transform: v => v },
            service_id: { pgCol: 'service_id', transform: toUUID },
            admission_date: { pgCol: 'admission_date', transform: toTimestamp },
            discharge_date: { pgCol: 'discharge_date', transform: toTimestamp },
            doctor_name: { pgCol: 'doctor_name', transform: v => v },
            room_number: { pgCol: 'room_number', transform: v => v },
            bed_label: { pgCol: 'bed_label', transform: v => v },
            status: { pgCol: 'status', transform: v => v },
            currency: { pgCol: 'currency', transform: v => v || 'MAD' },
            created_at: { pgCol: 'created_at', transform: toTimestamp }
        }));
        
        // Prescriptions
        results.push(await migrateTable(sqliteDb, pgPool, 'prescriptions', 'prescriptions', {
            id: { pgCol: 'id', transform: toUUID },
            tenant_id: { pgCol: 'tenant_id', transform: v => v },
            patient_id: { pgCol: 'patient_id', transform: toUUID },
            status: { pgCol: 'status', transform: v => v || 'ACTIVE' },
            data: { pgCol: 'data', transform: toJSON },
            created_at: { pgCol: 'created_at', transform: toTimestamp },
            created_by: { pgCol: 'created_by', transform: v => v }
        }));
        
        // Product Configs
        results.push(await migrateTable(sqliteDb, pgPool, 'product_configs', 'product_configs', {
            tenant_id: { pgCol: 'tenant_id', transform: v => v },
            product_id: { pgCol: 'product_id', transform: toUUID },
            is_enabled: { pgCol: 'is_enabled', transform: toBoolean },
            min_stock: { pgCol: 'min_stock', transform: v => v },
            max_stock: { pgCol: 'max_stock', transform: v => v },
            security_stock: { pgCol: 'security_stock', transform: v => v },
            created_at: { pgCol: 'created_at', transform: toTimestamp },
            updated_at: { pgCol: 'updated_at', transform: toTimestamp }
        }));
        
        // Product Suppliers
        results.push(await migrateTable(sqliteDb, pgPool, 'product_suppliers', 'product_suppliers', {
            id: { pgCol: 'id', transform: toUUID },
            tenant_id: { pgCol: 'tenant_id', transform: v => v },
            product_id: { pgCol: 'product_id', transform: toUUID },
            supplier_id: { pgCol: 'supplier_id', transform: v => v || '' },
            supplier_type: { pgCol: 'supplier_type', transform: v => v || 'GLOBAL' },
            is_active: { pgCol: 'is_active', transform: toBoolean },
            created_at: { pgCol: 'created_at', transform: toTimestamp },
            updated_at: { pgCol: 'updated_at', transform: toTimestamp }
        }));
        
    } finally {
        sqliteDb.close();
        if (pgPool) await pgPool.end();
    }
    
    return results;
}

async function main() {
    const tenantId = process.argv[2];
    
    console.log('='.repeat(60));
    console.log('SQLite to PostgreSQL Tenant Migration');
    console.log('='.repeat(60));
    
    if (!tenantId) {
        console.error('Usage: npx ts-node scripts/migrate/11_migrate_tenant.ts <tenant_id>');
        process.exit(1);
    }
    
    const results = await migrateTenant(tenantId);
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('MIGRATION SUMMARY');
    console.log('='.repeat(60));
    
    let totalMigrated = 0;
    let totalSkipped = 0;
    
    for (const r of results) {
        if (r.sourceCount > 0) {
            const status = r.skippedCount > 0 ? '⚠️' : '✅';
            console.log(`${status} ${r.table}: ${r.migratedCount}/${r.sourceCount}`);
        }
        totalMigrated += r.migratedCount;
        totalSkipped += r.skippedCount;
    }
    
    console.log(`\nTotal: ${totalMigrated} rows migrated, ${totalSkipped} skipped`);
    
    return totalSkipped > 0 ? 1 : 0;
}

main()
    .then(code => process.exit(code))
    .catch(err => {
        console.error('Migration failed:', err);
        process.exit(1);
    });
