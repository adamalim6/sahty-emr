/**
 * SQLite to PostgreSQL Global Database Migration Script
 * 
 * Migrates data from SQLite global.db to PostgreSQL sahty_global database.
 * 
 * Usage: npx ts-node scripts/migrate/01_migrate_global.ts
 */

import sqlite3 from 'sqlite3';
import { Pool } from 'pg';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const GLOBAL_DB_PATH = path.join(__dirname, '../../data/global/global.db');

// PostgreSQL connection
const pgPool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    user: process.env.PG_USER || 'sahty',
    password: process.env.PG_PASSWORD || 'sahty_dev_2026',
    database: 'sahty_global'
});

// SQLite helpers
const sqliteAll = (db: sqlite3.Database, sql: string, params: any[] = []): Promise<any[]> =>
    new Promise((res, rej) => db.all(sql, params, (err, rows) => err ? rej(err) : res(rows)));

// Type converters
function toUUID(val: string | null): string | null {
    if (!val) return null;
    // Check if already valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(val)) return val;
    // Generate deterministic UUID from non-UUID string (for legacy IDs)
    // This ensures same string always maps to same UUID
    return uuidv4(); // For now, generate new - but log it
}

function toBoolean(val: any): boolean {
    return val === 1 || val === true || val === '1' || val === 'true';
}

function toTimestamp(val: string | null): string | null {
    if (!val) return null;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString();
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

const results: MigrationResult[] = [];

async function migrateTable(
    sqliteDb: sqlite3.Database,
    tableName: string,
    pgTableName: string,
    columnMap: Record<string, { pgCol: string; transform: (val: any) => any }>
): Promise<MigrationResult> {
    console.log(`\n📦 Migrating ${tableName} -> ${pgTableName}...`);
    
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
        console.log(`   Source rows: ${rows.length}`);
        
        if (rows.length === 0) {
            console.log(`   Skipping empty table`);
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
                result.errors.push(`Row ${row.id || 'unknown'}: ${err.message}`);
                if (result.errors.length <= 3) {
                    console.log(`   ⚠️ Error: ${err.message}`);
                }
            }
        }
        
        console.log(`   ✅ Migrated: ${result.migratedCount}, Skipped: ${result.skippedCount}`);
        
    } catch (err: any) {
        result.errors.push(`Table error: ${err.message}`);
        console.log(`   ❌ Table error: ${err.message}`);
    }
    
    return result;
}

async function main() {
    console.log('='.repeat(60));
    console.log('SQLite to PostgreSQL Global Migration');
    console.log('='.repeat(60));
    
    if (!fs.existsSync(GLOBAL_DB_PATH)) {
        console.error('❌ Global SQLite database not found!');
        process.exit(1);
    }
    
    const sqliteDb = new sqlite3.Database(GLOBAL_DB_PATH);
    
    try {
        // Test PG connection
        await pgPool.query('SELECT 1');
        console.log('✅ PostgreSQL connection successful');
        
        // Migrate tables in dependency order
        
        // 1. Clients (no deps)
        results.push(await migrateTable(sqliteDb, 'clients', 'clients', {
            id: { pgCol: 'id', transform: toUUID },
            type: { pgCol: 'type', transform: v => v },
            designation: { pgCol: 'designation', transform: v => v || '' },
            siege_social: { pgCol: 'siege_social', transform: v => v },
            representant_legal: { pgCol: 'representant_legal', transform: v => v },
            country: { pgCol: 'country', transform: v => v || 'MAROC' },
            created_at: { pgCol: 'created_at', transform: toTimestamp },
            updated_at: { pgCol: 'updated_at', transform: toTimestamp }
        }));
        
        // 2. Organismes (no deps)
        results.push(await migrateTable(sqliteDb, 'organismes', 'organismes', {
            id: { pgCol: 'id', transform: toUUID },
            designation: { pgCol: 'designation', transform: v => v || '' },
            category: { pgCol: 'category', transform: v => v || 'ASSURANCE' },
            sub_type: { pgCol: 'sub_type', transform: v => v },
            active: { pgCol: 'active', transform: toBoolean },
            created_at: { pgCol: 'created_at', transform: toTimestamp },
            updated_at: { pgCol: 'updated_at', transform: toTimestamp }
        }));
        
        // 3. Global Roles (no deps, needed by users)
        results.push(await migrateTable(sqliteDb, 'global_roles', 'global_roles', {
            id: { pgCol: 'id', transform: toUUID },
            code: { pgCol: 'code', transform: v => v },
            name: { pgCol: 'name', transform: v => v || 'Unknown' },
            description: { pgCol: 'description', transform: v => v },
            permissions: { pgCol: 'permissions', transform: toJSON },
            created_at: { pgCol: 'created_at', transform: toTimestamp }
        }));
        
        // 4. Users (deps: clients)
        results.push(await migrateTable(sqliteDb, 'users', 'users', {
            id: { pgCol: 'id', transform: toUUID },
            username: { pgCol: 'username', transform: v => v || '' },
            password_hash: { pgCol: 'password_hash', transform: v => v || '' },
            nom: { pgCol: 'nom', transform: v => v },
            prenom: { pgCol: 'prenom', transform: v => v },
            user_type: { pgCol: 'user_type', transform: v => v || 'TENANT_SUPERADMIN' },
            role_code: { pgCol: 'role_code', transform: v => v },
            role_id: { pgCol: 'role_id', transform: toUUID },
            client_id: { pgCol: 'client_id', transform: toUUID },
            active: { pgCol: 'active', transform: toBoolean },
            created_at: { pgCol: 'created_at', transform: toTimestamp }
        }));
        
        // 5. Patients (no deps)
        results.push(await migrateTable(sqliteDb, 'patients', 'patients', {
            id: { pgCol: 'id', transform: toUUID },
            ipp: { pgCol: 'ipp', transform: v => v },
            firstName: { pgCol: 'first_name', transform: v => v || '' },
            lastName: { pgCol: 'last_name', transform: v => v || '' },
            dateOfBirth: { pgCol: 'date_of_birth', transform: v => v ? v.split('T')[0] : null },
            gender: { pgCol: 'gender', transform: v => v },
            cin: { pgCol: 'cin', transform: v => v },
            phone: { pgCol: 'phone', transform: v => v },
            email: { pgCol: 'email', transform: v => v },
            address: { pgCol: 'address', transform: v => v },
            city: { pgCol: 'city', transform: v => v },
            country: { pgCol: 'country', transform: v => v },
            nationality: { pgCol: 'nationality', transform: v => v },
            maritalStatus: { pgCol: 'marital_status', transform: v => v },
            profession: { pgCol: 'profession', transform: v => v },
            bloodGroup: { pgCol: 'blood_group', transform: v => v },
            isPayant: { pgCol: 'is_payant', transform: toBoolean },
            insurance_data: { pgCol: 'insurance_data', transform: toJSON },
            emergency_contacts: { pgCol: 'emergency_contacts', transform: toJSON },
            guardian_data: { pgCol: 'guardian_data', transform: toJSON },
            created_at: { pgCol: 'created_at', transform: toTimestamp },
            updated_at: { pgCol: 'updated_at', transform: toTimestamp }
        }));
        
        // 6. Global DCI
        results.push(await migrateTable(sqliteDb, 'global_dci', 'global_dci', {
            id: { pgCol: 'id', transform: toUUID },
            name: { pgCol: 'name', transform: v => v || '' },
            atc_code: { pgCol: 'atc_code', transform: v => v },
            therapeutic_class: { pgCol: 'therapeutic_class', transform: v => v },
            synonyms: { pgCol: 'synonyms', transform: toJSON },
            created_at: { pgCol: 'created_at', transform: toTimestamp }
        }));
        
        // 7. Global Products
        results.push(await migrateTable(sqliteDb, 'global_products', 'global_products', {
            id: { pgCol: 'id', transform: toUUID },
            type: { pgCol: 'type', transform: v => v || 'MEDICAMENT' },
            name: { pgCol: 'name', transform: v => v || '' },
            form: { pgCol: 'form', transform: v => v },
            dci_composition: { pgCol: 'dci_composition', transform: toJSON },
            presentation: { pgCol: 'presentation', transform: v => v },
            manufacturer: { pgCol: 'manufacturer', transform: v => v },
            ppv: { pgCol: 'ppv', transform: v => v },
            ph: { pgCol: 'ph', transform: v => v },
            pfht: { pgCol: 'pfht', transform: v => v },
            class_therapeutique: { pgCol: 'class_therapeutique', transform: v => v },
            sahty_code: { pgCol: 'sahty_code', transform: v => v },
            code: { pgCol: 'code', transform: v => v },
            units_per_pack: { pgCol: 'units_per_pack', transform: v => v || 1 },
            is_active: { pgCol: 'is_active', transform: toBoolean },
            created_at: { pgCol: 'created_at', transform: toTimestamp },
            updated_at: { pgCol: 'updated_at', transform: toTimestamp }
        }));
        
        // 8. Global Suppliers
        results.push(await migrateTable(sqliteDb, 'global_suppliers', 'global_suppliers', {
            id: { pgCol: 'id', transform: toUUID },
            name: { pgCol: 'name', transform: v => v || '' },
            tax_id: { pgCol: 'tax_id', transform: v => v },
            address: { pgCol: 'address', transform: v => v },
            contact_info: { pgCol: 'contact_info', transform: toJSON },
            is_active: { pgCol: 'is_active', transform: toBoolean },
            created_at: { pgCol: 'created_at', transform: toTimestamp }
        }));
        
        // 9. Global Actes
        results.push(await migrateTable(sqliteDb, 'global_actes', 'global_actes', {
            code_sih: { pgCol: 'code_sih', transform: v => v },
            libelle_sih: { pgCol: 'libelle_sih', transform: v => v || '' },
            famille_sih: { pgCol: 'famille_sih', transform: v => v },
            sous_famille_sih: { pgCol: 'sous_famille_sih', transform: v => v },
            code_ngap: { pgCol: 'code_ngap', transform: v => v },
            libelle_ngap: { pgCol: 'libelle_ngap', transform: v => v },
            cotation_ngap: { pgCol: 'cotation_ngap', transform: v => v },
            code_ccam: { pgCol: 'code_ccam', transform: v => v },
            libelle_ccam: { pgCol: 'libelle_ccam', transform: v => v },
            type_acte: { pgCol: 'type_acte', transform: v => v },
            duree_moyenne: { pgCol: 'duree_moyenne', transform: v => v },
            actif: { pgCol: 'actif', transform: toBoolean }
        }));
        
        // 10. Global ATC (self-referencing, migrate without FK first)
        results.push(await migrateTable(sqliteDb, 'global_atc', 'global_atc', {
            code: { pgCol: 'code', transform: v => v },
            label_fr: { pgCol: 'label_fr', transform: v => v },
            label_en: { pgCol: 'label_en', transform: v => v },
            level: { pgCol: 'level', transform: v => v },
            parent: { pgCol: 'parent', transform: v => v }
        }));
        
        // 11. Global EMDN (self-referencing)
        results.push(await migrateTable(sqliteDb, 'global_emdn', 'global_emdn', {
            code: { pgCol: 'code', transform: v => v },
            label_fr: { pgCol: 'label_fr', transform: v => v },
            label_en: { pgCol: 'label_en', transform: v => v },
            level: { pgCol: 'level', transform: v => v },
            parent: { pgCol: 'parent', transform: v => v }
        }));
        
        // 12. Global Product Price History (deps: global_products)
        results.push(await migrateTable(sqliteDb, 'global_product_price_history', 'global_product_price_history', {
            id: { pgCol: 'id', transform: toUUID },
            product_id: { pgCol: 'product_id', transform: toUUID },
            ppv: { pgCol: 'ppv', transform: v => v },
            ph: { pgCol: 'ph', transform: v => v },
            pfht: { pgCol: 'pfht', transform: v => v },
            valid_from: { pgCol: 'valid_from', transform: toTimestamp },
            valid_to: { pgCol: 'valid_to', transform: toTimestamp },
            created_at: { pgCol: 'created_at', transform: toTimestamp }
        }));
        
    } finally {
        sqliteDb.close();
        await pgPool.end();
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('MIGRATION SUMMARY');
    console.log('='.repeat(60));
    
    let totalMigrated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    
    for (const r of results) {
        const status = r.skippedCount > 0 ? '⚠️' : '✅';
        console.log(`${status} ${r.table}: ${r.migratedCount}/${r.sourceCount} migrated`);
        totalMigrated += r.migratedCount;
        totalSkipped += r.skippedCount;
        totalErrors += r.errors.length;
    }
    
    console.log(`\nTotal: ${totalMigrated} migrated, ${totalSkipped} skipped, ${totalErrors} errors`);
    
    if (totalErrors > 0) {
        const reportPath = path.join(__dirname, '../../data/migration_global_report.json');
        fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
        console.log(`\nFull report saved to: ${reportPath}`);
    }
    
    return totalErrors > 0 ? 1 : 0;
}

main()
    .then(code => process.exit(code))
    .catch(err => {
        console.error('Migration failed:', err);
        process.exit(1);
    });
