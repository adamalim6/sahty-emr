/**
 * HIS-Grade SQLite → PostgreSQL Global Database Migration
 * 
 * Features:
 * - Data sanitization (trim, UUID validation, JSON validation, boolean/numeric normalization)
 * - UUID generation for non-UUID IDs with FK mapping
 * - FK integrity audit
 * - Business invariants verification
 * - PostgreSQL constraints enforcement
 * - Comprehensive migration report
 * 
 * Run from backend/: npx ts-node --transpile-only scripts/migrate/migrate_global_sqlite_to_pg.ts
 */

import { globalQuery, globalTransaction } from '../../db/globalPg';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const SQLITE_DB_PATH = path.join(__dirname, '../../data/global/global.db');

// ============================================================================
// ID MAPPINGS (old_id → new_uuid) for FK resolution
// ============================================================================
const clientIdMap = new Map<string, string>();
const orgIdMap = new Map<string, string>();
const roleIdMap = new Map<string, string>();
const supplierIdMap = new Map<string, string>();

function getOrCreateUUID(oldId: string, map: Map<string, string>): string {
    if (!oldId) return crypto.randomUUID();
    // If already a valid UUID, use as-is
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(oldId)) return oldId;
    // Otherwise generate and cache
    if (!map.has(oldId)) {
        map.set(oldId, crypto.randomUUID());
    }
    return map.get(oldId)!;
}

// ============================================================================
// SANITIZATION HELPERS
// ============================================================================

interface SanitizationLog {
    table: string;
    rowId: string;
    field: string;
    issue: string;
    action: 'SKIPPED' | 'FIXED';
}

const sanitizationLogs: SanitizationLog[] = [];
const skippedRows: { table: string; rowId: string; reason: string }[] = [];

function trimString(val: any): string | null {
    if (val === null || val === undefined) return null;
    return String(val).trim();
}

function isValidUUID(val: any): boolean {
    if (val === null || val === undefined) return true; // NULL is valid
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(String(val));
}

function normalizeBoolean(val: any): boolean {
    if (val === null || val === undefined) return false;
    if (typeof val === 'boolean') return val;
    if (val === 1 || val === '1' || val === 'true' || val === 'TRUE') return true;
    if (val === 0 || val === '0' || val === 'false' || val === 'FALSE') return false;
    return false;
}

function validateJSON(val: any): { valid: boolean; parsed: any } {
    if (val === null || val === undefined) return { valid: true, parsed: null };
    if (typeof val === 'object') return { valid: true, parsed: val };
    try {
        const parsed = JSON.parse(String(val));
        return { valid: true, parsed };
    } catch {
        return { valid: false, parsed: null };
    }
}

function normalizeNumeric(val: any): number | null {
    if (val === null || val === undefined) return null;
    const num = Number(val);
    if (isNaN(num) || !isFinite(num)) return null;
    return num;
}

function normalizeProductType(val: any): string {
    if (val === null || val === undefined) return 'MEDICAMENT';
    const v = String(val).toLowerCase().trim();
    // French → English normalization
    if (v === 'médicament' || v === 'medicament') return 'MEDICAMENT';
    if (v === 'consommable') return 'CONSOMMABLE';
    if (v === 'dispositif_medical' || v === 'dispositif médical' || v === 'dispositif medical') return 'DISPOSITIF_MEDICAL';
    // Default fallback
    return 'MEDICAMENT';
}

// ============================================================================
// SQLite HELPER
// ============================================================================

function allAsync(db: sqlite3.Database, sql: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
        db.all(sql, [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

// ============================================================================
// MIGRATION TABLES
// ============================================================================

interface MigrationResult {
    table: string;
    sqliteCount: number;
    pgCount: number;
    match: boolean;
}

const results: MigrationResult[] = [];

async function run() {
    console.log('='.repeat(70));
    console.log('HIS-GRADE GLOBAL DATABASE MIGRATION');
    console.log('SQLite → PostgreSQL');
    console.log('='.repeat(70));
    console.log(`Source: ${SQLITE_DB_PATH}`);
    console.log(`Started: ${new Date().toISOString()}\n`);
    
    if (!fs.existsSync(SQLITE_DB_PATH)) {
        console.error(`❌ SQLite database not found: ${SQLITE_DB_PATH}`);
        process.exit(1);
    }
    
    const sqlite = new sqlite3.Database(SQLITE_DB_PATH, sqlite3.OPEN_READONLY);
    
    // =========================================================================
    // 1. CLIENTS (generate new UUIDs, maintain mapping)
    // =========================================================================
    await migrateTable(sqlite, 'clients', async (rows) => {
        await globalTransaction(async (client) => {
            for (const r of rows) {
                const newId = getOrCreateUUID(r.id, clientIdMap);
                await client.query(`
                    INSERT INTO clients (id, type, designation, siege_social, representant_legal, country, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT (id) DO UPDATE SET
                        type = EXCLUDED.type, designation = EXCLUDED.designation,
                        siege_social = EXCLUDED.siege_social, representant_legal = EXCLUDED.representant_legal,
                        country = EXCLUDED.country, updated_at = EXCLUDED.updated_at
                `, [
                    newId,
                    trimString(r.type),
                    trimString(r.designation),
                    trimString(r.siege_social),
                    trimString(r.representant_legal),
                    trimString(r.country) || 'MAROC',
                    r.created_at || new Date().toISOString(),
                    r.updated_at || new Date().toISOString()
                ]);
            }
        });
    });

    // =========================================================================
    // 2. ORGANISMES (generate new UUIDs, maintain mapping)
    // =========================================================================
    await migrateTable(sqlite, 'organismes', async (rows) => {
        await globalTransaction(async (client) => {
            for (const r of rows) {
                const newId = getOrCreateUUID(r.id, orgIdMap);
                await client.query(`
                    INSERT INTO organismes (id, designation, category, sub_type, active, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT (id) DO UPDATE SET
                        designation = EXCLUDED.designation, category = EXCLUDED.category,
                        sub_type = EXCLUDED.sub_type, active = EXCLUDED.active, updated_at = EXCLUDED.updated_at
                `, [
                    newId,
                    trimString(r.designation),
                    trimString(r.category),
                    trimString(r.sub_type),
                    normalizeBoolean(r.active),
                    r.created_at || new Date().toISOString(),
                    r.updated_at || new Date().toISOString()
                ]);
            }
        });
    });

    // =========================================================================
    // 3. GLOBAL_ROLES (generate new UUIDs, maintain mapping)
    // =========================================================================
    await migrateTable(sqlite, 'global_roles', async (rows) => {
        await globalTransaction(async (client) => {
            for (const r of rows) {
                const newId = getOrCreateUUID(r.id, roleIdMap);
                const permJson = validateJSON(r.permissions);
                await client.query(`
                    INSERT INTO global_roles (id, code, name, description, permissions, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (id) DO UPDATE SET
                        code = EXCLUDED.code, name = EXCLUDED.name, 
                        description = EXCLUDED.description, permissions = EXCLUDED.permissions
                `, [
                    newId,
                    trimString(r.code),
                    trimString(r.name),
                    trimString(r.description),
                    permJson.valid ? JSON.stringify(permJson.parsed) : '[]',
                    r.created_at || new Date().toISOString()
                ]);
            }
        });
    });

    // =========================================================================
    // 4. GLOBAL_SUPPLIERS (generate new UUIDs, maintain mapping)
    // =========================================================================
    await migrateTable(sqlite, 'global_suppliers', async (rows) => {
        await globalTransaction(async (client) => {
            for (const r of rows) {
                const newId = getOrCreateUUID(r.id, supplierIdMap);
                await client.query(`
                    INSERT INTO global_suppliers (id, name, tax_id, address, contact_info, is_active, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name, tax_id = EXCLUDED.tax_id, address = EXCLUDED.address,
                        contact_info = EXCLUDED.contact_info, is_active = EXCLUDED.is_active
                `, [
                    newId,
                    trimString(r.name),
                    trimString(r.tax_id),
                    trimString(r.address),
                    r.contact_info || null,
                    normalizeBoolean(r.is_active),
                    r.created_at || new Date().toISOString()
                ]);
            }
        });
    });

    // =========================================================================
    // 5. GLOBAL_ATC
    // =========================================================================
    await migrateTable(sqlite, 'global_atc', async (rows) => {
        await globalTransaction(async (client) => {
            for (const r of rows) {
                await client.query(`
                    INSERT INTO global_atc (code, label_fr, label_en, level, parent)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (code) DO UPDATE SET
                        label_fr = EXCLUDED.label_fr, label_en = EXCLUDED.label_en,
                        level = EXCLUDED.level, parent = EXCLUDED.parent
                `, [
                    trimString(r.code),
                    trimString(r.label_fr),
                    trimString(r.label_en),
                    r.level,
                    trimString(r.parent_code)
                ]);
            }
        });
    });

    // =========================================================================
    // 6. GLOBAL_EMDN
    // =========================================================================
    await migrateTable(sqlite, 'global_emdn', async (rows) => {
        await globalTransaction(async (client) => {
            for (const r of rows) {
                await client.query(`
                    INSERT INTO global_emdn (code, label_fr, label_en, level, parent)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (code) DO UPDATE SET
                        label_fr = EXCLUDED.label_fr, label_en = EXCLUDED.label_en,
                        level = EXCLUDED.level, parent = EXCLUDED.parent
                `, [
                    trimString(r.code),
                    trimString(r.label_fr),
                    trimString(r.label_en),
                    r.level,
                    trimString(r.parent_code)
                ]);
            }
        });
    });

    // =========================================================================
    // 7. GLOBAL_DCI
    // =========================================================================
    await migrateTable(sqlite, 'global_dci', async (rows) => {
        await globalTransaction(async (client) => {
            for (const r of rows) {
                if (!isValidUUID(r.id)) {
                    skippedRows.push({ table: 'global_dci', rowId: r.id, reason: 'Invalid UUID' });
                    continue;
                }
                const synJson = validateJSON(r.synonyms);
                await client.query(`
                    INSERT INTO global_dci (id, name, atc_code, therapeutic_class, synonyms, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name, atc_code = EXCLUDED.atc_code,
                        therapeutic_class = EXCLUDED.therapeutic_class, synonyms = EXCLUDED.synonyms
                `, [
                    r.id,
                    trimString(r.name),
                    trimString(r.atc_code),
                    trimString(r.therapeutic_class),
                    synJson.valid ? JSON.stringify(synJson.parsed) : '[]',
                    r.created_at || new Date().toISOString()
                ]);
            }
        });
    });

    // =========================================================================
    // 8. GLOBAL_ACTES
    // =========================================================================
    await migrateTable(sqlite, 'global_actes', async (rows) => {
        await globalTransaction(async (client) => {
            for (const r of rows) {
                // Skip if primary key is NULL
                if (!r.code_sih) {
                    skippedRows.push({ table: 'global_actes', rowId: 'NULL', reason: 'NULL code_sih (primary key)' });
                    continue;
                }
                await client.query(`
                    INSERT INTO global_actes (code_sih, libelle_sih, famille_sih, sous_famille_sih, code_ngap, libelle_ngap, cotation_ngap, code_ccam, libelle_ccam, type_acte, duree_moyenne, actif)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                    ON CONFLICT (code_sih) DO UPDATE SET
                        libelle_sih = EXCLUDED.libelle_sih, famille_sih = EXCLUDED.famille_sih,
                        sous_famille_sih = EXCLUDED.sous_famille_sih, code_ngap = EXCLUDED.code_ngap
                `, [
                    trimString(r.code_sih),
                    trimString(r.libelle_sih),
                    trimString(r.famille_sih),
                    trimString(r.sous_famille_sih),
                    trimString(r.code_ngap),
                    trimString(r.libelle_ngap),
                    trimString(r.cotation_ngap),
                    trimString(r.code_ccam),
                    trimString(r.libelle_ccam),
                    trimString(r.type_acte),
                    r.duree_moyenne,
                    normalizeBoolean(r.actif)
                ]);
            }
        });
    });

    // =========================================================================
    // 9. GLOBAL_PRODUCTS
    // =========================================================================
    await migrateTable(sqlite, 'global_products', async (rows) => {
        await globalTransaction(async (client) => {
            for (const r of rows) {
                if (!isValidUUID(r.id)) {
                    skippedRows.push({ table: 'global_products', rowId: r.id, reason: 'Invalid UUID' });
                    continue;
                }
                const dciJson = validateJSON(r.dci_composition);
                await client.query(`
                    INSERT INTO global_products (
                        id, type, name, form, dci_composition, presentation, manufacturer,
                        ppv, ph, pfht, class_therapeutique, code, units_per_pack, is_active, created_at, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                    ON CONFLICT (id) DO UPDATE SET
                        type = EXCLUDED.type, name = EXCLUDED.name, form = EXCLUDED.form,
                        dci_composition = EXCLUDED.dci_composition, presentation = EXCLUDED.presentation,
                        manufacturer = EXCLUDED.manufacturer, ppv = EXCLUDED.ppv, ph = EXCLUDED.ph,
                        pfht = EXCLUDED.pfht, class_therapeutique = EXCLUDED.class_therapeutique,
                        code = EXCLUDED.code, units_per_pack = EXCLUDED.units_per_pack,
                        is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at
                `, [
                    r.id,
                    normalizeProductType(r.type),
                    trimString(r.name),
                    trimString(r.form),
                    dciJson.valid ? JSON.stringify(dciJson.parsed) : '[]',
                    trimString(r.presentation),
                    trimString(r.manufacturer),
                    normalizeNumeric(r.ppv),
                    normalizeNumeric(r.ph),
                    normalizeNumeric(r.pfht),
                    trimString(r.class_therapeutique),
                    trimString(r.code || r.sahty_code),
                    r.units_per_pack || 1,
                    normalizeBoolean(r.is_active),
                    r.created_at || new Date().toISOString(),
                    r.updated_at || new Date().toISOString()
                ]);
            }
        });
    });

    // =========================================================================
    // 10. GLOBAL_PRODUCT_PRICE_HISTORY
    // =========================================================================
    await migrateTable(sqlite, 'global_product_price_history', async (rows) => {
        await globalTransaction(async (client) => {
            for (const r of rows) {
                if (!isValidUUID(r.id) || !isValidUUID(r.product_id)) {
                    skippedRows.push({ table: 'global_product_price_history', rowId: r.id, reason: 'Invalid UUID' });
                    continue;
                }
                // Check if product exists (FK validation)
                const prodCheck = await client.query(`SELECT 1 FROM global_products WHERE id = $1`, [r.product_id]);
                if (prodCheck.rows.length === 0) {
                    skippedRows.push({ table: 'global_product_price_history', rowId: r.id, reason: `FK orphan: product_id ${r.product_id} not found` });
                    continue;
                }
                await client.query(`
                    INSERT INTO global_product_price_history (id, product_id, ppv, ph, pfht, valid_from, valid_to, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT (id) DO UPDATE SET
                        ppv = EXCLUDED.ppv, ph = EXCLUDED.ph, pfht = EXCLUDED.pfht,
                        valid_from = EXCLUDED.valid_from, valid_to = EXCLUDED.valid_to
                `, [
                    r.id,
                    r.product_id,
                    normalizeNumeric(r.ppv),
                    normalizeNumeric(r.ph),
                    normalizeNumeric(r.pfht),
                    r.valid_from,
                    r.valid_to,
                    r.created_at || new Date().toISOString()
                ]);
            }
        });
    });

    // =========================================================================
    // 11. USERS (generate new UUIDs, map FK references)
    // =========================================================================
    await migrateTable(sqlite, 'users', async (rows) => {
        await globalTransaction(async (client) => {
            for (const r of rows) {
                // Generate new UUID for user
                const newId = crypto.randomUUID();
                // Map FKs to new UUIDs (if they were migrated)
                const newClientId = r.client_id ? (clientIdMap.get(r.client_id) || null) : null;
                const newRoleId = r.role_id ? (roleIdMap.get(r.role_id) || null) : null;
                
                await client.query(`
                    INSERT INTO users (id, username, password_hash, nom, prenom, user_type, role_code, active, client_id, role_id, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    ON CONFLICT (id) DO UPDATE SET
                        username = EXCLUDED.username, password_hash = EXCLUDED.password_hash,
                        nom = EXCLUDED.nom, prenom = EXCLUDED.prenom, user_type = EXCLUDED.user_type,
                        role_code = EXCLUDED.role_code, active = EXCLUDED.active,
                        client_id = EXCLUDED.client_id, role_id = EXCLUDED.role_id
                `, [
                    newId,
                    trimString(r.username),
                    r.password_hash,
                    trimString(r.nom),
                    trimString(r.prenom),
                    trimString(r.user_type),
                    trimString(r.role_code),
                    normalizeBoolean(r.active),
                    newClientId,
                    newRoleId,
                    r.created_at || new Date().toISOString()
                ]);
            }
        });
    });

    // =========================================================================
    // 12. PATIENTS (0 rows expected)
    // =========================================================================
    await migrateTable(sqlite, 'patients', async (rows) => {
        // Skip if no rows
        if (rows.length === 0) return;
        await globalTransaction(async (client) => {
            for (const r of rows) {
                if (!isValidUUID(r.id)) {
                    skippedRows.push({ table: 'patients', rowId: r.id, reason: 'Invalid UUID' });
                    continue;
                }
                await client.query(`
                    INSERT INTO patients (id, ipp, firstName, lastName, dateOfBirth, gender, cin, phone, email, address, city, country, nationality, maritalStatus, profession, bloodGroup, isPayant)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                    ON CONFLICT (id) DO NOTHING
                `, [
                    r.id, r.ipp, trimString(r.firstName), trimString(r.lastName),
                    r.dateOfBirth, r.gender, r.cin, r.phone, r.email,
                    r.address, r.city, r.country, r.nationality, r.maritalStatus,
                    r.profession, r.bloodGroup, normalizeBoolean(r.isPayant)
                ]);
            }
        });
    });

    sqlite.close();

    // =========================================================================
    // FK INTEGRITY AUDIT
    // =========================================================================
    console.log('\n' + '─'.repeat(70));
    console.log('FK INTEGRITY AUDIT');
    console.log('─'.repeat(70));
    
    const fkChecks = [
        { name: 'users→global_roles', query: `SELECT COUNT(*) as cnt FROM users u WHERE u.role_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM global_roles r WHERE r.id = u.role_id)` },
        { name: 'users→clients', query: `SELECT COUNT(*) as cnt FROM users u WHERE u.client_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM clients c WHERE c.id = u.client_id)` },
        { name: 'price_history→products', query: `SELECT COUNT(*) as cnt FROM global_product_price_history h WHERE NOT EXISTS (SELECT 1 FROM global_products p WHERE p.id = h.product_id)` },
    ];
    
    for (const check of fkChecks) {
        const result = await globalQuery(check.query, []);
        const orphans = parseInt(result[0].cnt);
        console.log(`   ${check.name}: ${orphans === 0 ? '✅' : '❌'} ${orphans} orphans`);
    }

    // =========================================================================
    // BUSINESS INVARIANTS
    // =========================================================================
    console.log('\n' + '─'.repeat(70));
    console.log('BUSINESS INVARIANTS');
    console.log('─'.repeat(70));
    
    const invariants = [
        { name: 'Duplicate active prices', query: `SELECT COUNT(*) as cnt FROM (SELECT product_id FROM global_product_price_history WHERE valid_to IS NULL GROUP BY product_id HAVING COUNT(*) > 1) x` },
        { name: 'MEDICAMENT without PH', query: `SELECT COUNT(*) as cnt FROM global_products WHERE type = 'MEDICAMENT' AND ph IS NULL` },
        { name: 'Negative pricing', query: `SELECT COUNT(*) as cnt FROM global_products WHERE ppv < 0 OR ph < 0` },
    ];
    
    for (const inv of invariants) {
        const result = await globalQuery(inv.query, []);
        const violations = parseInt(result[0].cnt);
        console.log(`   ${inv.name}: ${violations === 0 ? '✅' : '⚠️'} ${violations} violations`);
    }

    // =========================================================================
    // POSTGRESQL CONSTRAINTS
    // =========================================================================
    console.log('\n' + '─'.repeat(70));
    console.log('POSTGRESQL CONSTRAINTS');
    console.log('─'.repeat(70));
    
    try {
        await globalQuery(`ALTER TABLE global_products DROP CONSTRAINT IF EXISTS chk_ppv_positive`, []);
        await globalQuery(`ALTER TABLE global_products ADD CONSTRAINT chk_ppv_positive CHECK (ppv IS NULL OR ppv >= 0)`, []);
        console.log('   ✅ chk_ppv_positive');
    } catch (e: any) { console.log(`   ⚠️ chk_ppv_positive: ${e.message.slice(0,50)}`); }
    
    try {
        await globalQuery(`ALTER TABLE global_products DROP CONSTRAINT IF EXISTS chk_ph_positive`, []);
        await globalQuery(`ALTER TABLE global_products ADD CONSTRAINT chk_ph_positive CHECK (ph IS NULL OR ph >= 0)`, []);
        console.log('   ✅ chk_ph_positive');
    } catch (e: any) { console.log(`   ⚠️ chk_ph_positive: ${e.message.slice(0,50)}`); }
    
    try {
        await globalQuery(`CREATE UNIQUE INDEX IF NOT EXISTS idx_active_price ON global_product_price_history (product_id) WHERE valid_to IS NULL`, []);
        console.log('   ✅ idx_active_price (partial unique)');
    } catch (e: any) { console.log(`   ⚠️ idx_active_price: ${e.message.slice(0,50)}`); }

    // =========================================================================
    // MIGRATION REPORT
    // =========================================================================
    console.log('\n' + '='.repeat(70));
    console.log('MIGRATION REPORT');
    console.log('='.repeat(70));
    
    console.log('\nROW COUNTS:');
    console.log('Table                          | SQLite | PostgreSQL | Match');
    console.log('-------------------------------|--------|------------|------');
    let allMatch = true;
    for (const r of results) {
        const match = r.sqliteCount === r.pgCount ? '✅' : '❌';
        if (r.sqliteCount !== r.pgCount) allMatch = false;
        console.log(`${r.table.padEnd(30)} | ${String(r.sqliteCount).padStart(6)} | ${String(r.pgCount).padStart(10)} | ${match}`);
    }
    
    console.log(`\nSANITIZATION:`);
    console.log(`   Skipped rows: ${skippedRows.length}`);
    if (skippedRows.length > 0) {
        for (const s of skippedRows.slice(0, 10)) {
            console.log(`     - ${s.table}.${s.rowId}: ${s.reason}`);
        }
        if (skippedRows.length > 10) console.log(`     ... and ${skippedRows.length - 10} more`);
    }
    
    console.log('\n' + '='.repeat(70));
    if (allMatch && skippedRows.length === 0) {
        console.log('✅ MIGRATION COMPLETE - ALL DATA MIGRATED SUCCESSFULLY');
    } else {
        console.log('⚠️ MIGRATION COMPLETE WITH WARNINGS');
    }
    console.log('='.repeat(70));
}

async function migrateTable(sqlite: sqlite3.Database, table: string, migrator: (rows: any[]) => Promise<void>) {
    console.log(`Migrating ${table}...`);
    const rows = await allAsync(sqlite, `SELECT * FROM ${table}`);
    console.log(`   SQLite: ${rows.length} rows`);
    
    await migrator(rows);
    
    const pgResult = await globalQuery(`SELECT COUNT(*) as cnt FROM ${table}`, []);
    const pgCount = parseInt(pgResult[0].cnt);
    console.log(`   PostgreSQL: ${pgCount} rows`);
    
    results.push({ table, sqliteCount: rows.length, pgCount, match: rows.length === pgCount });
}

run().catch(e => {
    console.error('\n❌ MIGRATION FAILED:', e.message);
    console.error(e.stack);
    process.exit(1);
});
