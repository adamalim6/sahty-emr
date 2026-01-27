/**
 * Global-Only Migration Script
 * 
 * Migrates ONLY global referentials from SQLite to PostgreSQL.
 * Tenant data is NOT migrated (per architecture rules).
 * 
 * Tables migrated:
 * - global_products
 * - global_product_price_history
 * - global_dci
 * - global_atc
 * - global_actes
 * - global_suppliers
 * - global_roles
 * - clients
 * - users (superadmin only)
 * - patients (GLOBAL)
 * - organismes
 * 
 * Usage: npx ts-node scripts/migrate/migrate_global_only.ts
 */

import sqlite3 from 'sqlite3';
import { Pool } from 'pg';
import path from 'path';
import fs from 'fs';

const GLOBAL_SQLITE_PATH = path.join(__dirname, '../../backend/data/global/global.db');

interface MigrationStats {
    table: string;
    inserted: number;
    skipped: number;
    errors: number;
}

async function connect(): Promise<{ sqlite: sqlite3.Database; pg: Pool }> {
    // SQLite
    if (!fs.existsSync(GLOBAL_SQLITE_PATH)) {
        throw new Error(`SQLite database not found: ${GLOBAL_SQLITE_PATH}`);
    }
    const sqlite = new sqlite3.Database(GLOBAL_SQLITE_PATH);

    // PostgreSQL
    const pg = new Pool({
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT || '5432'),
        user: process.env.PG_USER || 'sahty',
        password: process.env.PG_PASSWORD || 'sahty_dev_2026',
        database: 'sahty_global'
    });

    // Test connection
    await pg.query('SELECT 1');
    console.log('✅ Connected to PostgreSQL sahty_global');

    return { sqlite, pg };
}

function sqliteAll(db: sqlite3.Database, sql: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
        db.all(sql, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

async function migrateTable(
    sqlite: sqlite3.Database,
    pg: Pool,
    tableName: string,
    columnMapping: (row: any) => any[],
    insertSql: string
): Promise<MigrationStats> {
    const stats: MigrationStats = { table: tableName, inserted: 0, skipped: 0, errors: 0 };

    try {
        const rows = await sqliteAll(sqlite, `SELECT * FROM ${tableName}`);
        console.log(`  📦 ${tableName}: ${rows.length} rows to migrate`);

        for (const row of rows) {
            try {
                const values = columnMapping(row);
                await pg.query(insertSql, values);
                stats.inserted++;
            } catch (err: any) {
                if (err.code === '23505') { // Unique violation
                    stats.skipped++;
                } else {
                    stats.errors++;
                    console.error(`    ❌ Error in ${tableName}:`, err.message);
                }
            }
        }
    } catch (err: any) {
        if (err.message.includes('no such table')) {
            console.log(`  ⚠️ ${tableName}: Table not found in SQLite (skipping)`);
        } else {
            throw err;
        }
    }

    return stats;
}

async function main() {
    console.log('='.repeat(60));
    console.log('GLOBAL-ONLY MIGRATION: SQLite → PostgreSQL');
    console.log('='.repeat(60));
    console.log('⚠️ This migrates ONLY global referentials');
    console.log('⚠️ Tenant data is NOT migrated\n');

    const { sqlite, pg } = await connect();
    const allStats: MigrationStats[] = [];

    try {
        // 1. clients
        allStats.push(await migrateTable(sqlite, pg, 'clients',
            (r) => [r.id, r.type, r.designation, r.siege_social, r.representant_legal, r.country || 'MAROC'],
            `INSERT INTO clients (id, type, designation, siege_social, representant_legal, country, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW()) ON CONFLICT (id) DO NOTHING`
        ));

        // 2. global_roles
        allStats.push(await migrateTable(sqlite, pg, 'global_roles',
            (r) => [r.id, r.code, r.name, r.description, r.permissions],
            `INSERT INTO global_roles (id, code, name, description, permissions, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW()) ON CONFLICT (id) DO NOTHING`
        ));

        // 3. users (superadmin only)
        allStats.push(await migrateTable(sqlite, pg, 'users',
            (r) => [r.id, r.username, r.password_hash, r.nom, r.prenom, r.user_type, r.role_code, r.role_id, r.client_id, r.active !== 0],
            `INSERT INTO users (id, username, password_hash, nom, prenom, user_type, role_code, role_id, client_id, active, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()) ON CONFLICT (id) DO NOTHING`
        ));

        // 4. patients (GLOBAL)
        allStats.push(await migrateTable(sqlite, pg, 'patients',
            (r) => [r.id, r.nom, r.prenom, r.date_naissance, r.sexe, r.cni, r.telephone, r.adresse],
            `INSERT INTO patients (id, nom, prenom, date_naissance, sexe, cni, telephone, adresse, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) ON CONFLICT (id) DO NOTHING`
        ));

        // 5. global_dci
        allStats.push(await migrateTable(sqlite, pg, 'global_dci',
            (r) => [r.id, r.name, r.atc_code, r.description],
            `INSERT INTO global_dci (id, name, atc_code, description, created_at)
             VALUES ($1, $2, $3, $4, NOW()) ON CONFLICT (id) DO NOTHING`
        ));

        // 6. global_atc
        allStats.push(await migrateTable(sqlite, pg, 'global_atc',
            (r) => [r.code, r.name, r.level],
            `INSERT INTO global_atc (code, name, level, created_at)
             VALUES ($1, $2, $3, NOW()) ON CONFLICT (code) DO NOTHING`
        ));

        // 7. global_actes
        allStats.push(await migrateTable(sqlite, pg, 'global_actes',
            (r) => [r.id, r.code, r.description, r.category, r.price],
            `INSERT INTO global_actes (id, code, description, category, price, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW()) ON CONFLICT (id) DO NOTHING`
        ));

        // 8. global_suppliers
        allStats.push(await migrateTable(sqlite, pg, 'global_suppliers',
            (r) => [r.id, r.code, r.name, r.email, r.phone, r.address, r.city, r.country || 'MAROC', r.is_active !== 0],
            `INSERT INTO global_suppliers (id, code, name, email, phone, address, city, country, is_active, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()) ON CONFLICT (id) DO NOTHING`
        ));

        // 9. global_products
        allStats.push(await migrateTable(sqlite, pg, 'global_products',
            (r) => [
                r.id, r.code, r.type, r.name, r.dci, r.form, r.dosage, r.dosage_unit,
                r.dci_composition, r.presentation, r.manufacturer, r.ppv, r.ph, r.pfht,
                r.class_therapeutique, r.atc_code, r.sahty_code, r.units_per_pack, r.is_active !== 0
            ],
            `INSERT INTO global_products (
                id, code, type, name, dci, form, dosage, dosage_unit, dci_composition, presentation,
                manufacturer, ppv, ph, pfht, class_therapeutique, atc_code, sahty_code, units_per_pack, is_active, created_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW())
             ON CONFLICT (id) DO NOTHING`
        ));

        // 10. global_product_price_history
        allStats.push(await migrateTable(sqlite, pg, 'global_product_price_history',
            (r) => [r.id, r.product_id, r.ppv, r.ph, r.pfht, r.valid_from, r.valid_to],
            `INSERT INTO global_product_price_history (id, product_id, ppv, ph, pfht, valid_from, valid_to, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) ON CONFLICT (id) DO NOTHING`
        ));

        // 11. organismes
        allStats.push(await migrateTable(sqlite, pg, 'organismes',
            (r) => [r.id, r.name, r.type, r.code],
            `INSERT INTO organismes (id, name, type, code, created_at)
             VALUES ($1, $2, $3, $4, NOW()) ON CONFLICT (id) DO NOTHING`
        ));

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('MIGRATION SUMMARY');
        console.log('='.repeat(60));

        let totalInserted = 0, totalSkipped = 0, totalErrors = 0;
        for (const stat of allStats) {
            console.log(`  ${stat.table.padEnd(35)} ✅ ${stat.inserted} inserted, ⏭️ ${stat.skipped} skipped, ❌ ${stat.errors} errors`);
            totalInserted += stat.inserted;
            totalSkipped += stat.skipped;
            totalErrors += stat.errors;
        }

        console.log('─'.repeat(60));
        console.log(`  TOTAL: ${totalInserted} inserted, ${totalSkipped} skipped, ${totalErrors} errors`);

        if (totalErrors === 0) {
            console.log('\n✅ Global migration completed successfully!');
        } else {
            console.log('\n⚠️ Migration completed with errors. Review above.');
        }

    } finally {
        sqlite.close();
        await pg.end();
    }
}

main().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
