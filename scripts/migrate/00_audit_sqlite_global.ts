/**
 * SQLite Global Database Audit Script
 * 
 * Pre-migration audit to detect data quality issues before migrating to PostgreSQL.
 * Checks: orphans, boolean values, date formats, UUID validity, JSON validity.
 * 
 * Usage: npx ts-node scripts/migrate/00_audit_sqlite_global.ts
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const GLOBAL_DB_PATH = path.join(__dirname, '../../data/global/global.db');

interface AuditIssue {
    table: string;
    column?: string;
    rowId?: string;
    issueType: string;
    description: string;
    value?: any;
}

const issues: AuditIssue[] = [];

// Helper to run queries
const all = (db: sqlite3.Database, sql: string, params: any[] = []): Promise<any[]> => 
    new Promise((res, rej) => db.all(sql, params, (err, rows) => err ? rej(err) : res(rows)));

const get = (db: sqlite3.Database, sql: string, params: any[] = []): Promise<any> => 
    new Promise((res, rej) => db.get(sql, params, (err, row) => err ? rej(err) : res(row)));

// Validators
function isValidUUID(str: string): boolean {
    if (!str) return true; // null/undefined OK
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
}

function isValidDate(str: string): boolean {
    if (!str) return true;
    const d = new Date(str);
    return !isNaN(d.getTime());
}

function isValidJSON(str: string): boolean {
    if (!str) return true;
    try {
        JSON.parse(str);
        return true;
    } catch {
        return false;
    }
}

function isValidBoolean(val: any): boolean {
    return val === 0 || val === 1 || val === true || val === false || val === null;
}

async function auditTable(db: sqlite3.Database, tableName: string, config: {
    idColumn: string;
    uuidColumns?: string[];
    dateColumns?: string[];
    jsonColumns?: string[];
    booleanColumns?: string[];
    fkChecks?: { column: string; refTable: string; refColumn: string }[];
}) {
    console.log(`\n📋 Auditing ${tableName}...`);
    
    const rows = await all(db, `SELECT * FROM ${tableName}`);
    console.log(`   Found ${rows.length} rows`);
    
    for (const row of rows) {
        const rowId = row[config.idColumn] || 'unknown';
        
        // UUID validation
        for (const col of config.uuidColumns || []) {
            if (row[col] && !isValidUUID(row[col])) {
                issues.push({
                    table: tableName,
                    column: col,
                    rowId,
                    issueType: 'INVALID_UUID',
                    description: `Invalid UUID format`,
                    value: row[col]
                });
            }
        }
        
        // Date validation
        for (const col of config.dateColumns || []) {
            if (row[col] && !isValidDate(row[col])) {
                issues.push({
                    table: tableName,
                    column: col,
                    rowId,
                    issueType: 'INVALID_DATE',
                    description: `Invalid date format`,
                    value: row[col]
                });
            }
        }
        
        // JSON validation
        for (const col of config.jsonColumns || []) {
            if (row[col] && !isValidJSON(row[col])) {
                issues.push({
                    table: tableName,
                    column: col,
                    rowId,
                    issueType: 'INVALID_JSON',
                    description: `Invalid JSON`,
                    value: row[col]?.substring(0, 100)
                });
            }
        }
        
        // Boolean validation
        for (const col of config.booleanColumns || []) {
            if (!isValidBoolean(row[col])) {
                issues.push({
                    table: tableName,
                    column: col,
                    rowId,
                    issueType: 'INVALID_BOOLEAN',
                    description: `Unexpected boolean value (not 0/1)`,
                    value: row[col]
                });
            }
        }
    }
    
    // FK checks (orphan detection)
    for (const fk of config.fkChecks || []) {
        const orphans = await all(db, `
            SELECT t.${config.idColumn} as id, t.${fk.column} as fk_value
            FROM ${tableName} t
            LEFT JOIN ${fk.refTable} r ON t.${fk.column} = r.${fk.refColumn}
            WHERE t.${fk.column} IS NOT NULL AND r.${fk.refColumn} IS NULL
        `);
        
        if (orphans.length > 0) {
            console.log(`   ⚠️  Found ${orphans.length} orphan(s) in ${fk.column} -> ${fk.refTable}`);
            for (const o of orphans) {
                issues.push({
                    table: tableName,
                    column: fk.column,
                    rowId: o.id,
                    issueType: 'ORPHAN_FK',
                    description: `References non-existent ${fk.refTable}.${fk.refColumn}`,
                    value: o.fk_value
                });
            }
        }
    }
}

async function main() {
    console.log('='.repeat(60));
    console.log('SQLite Global Database Audit');
    console.log('='.repeat(60));
    console.log(`Database: ${GLOBAL_DB_PATH}`);
    
    if (!fs.existsSync(GLOBAL_DB_PATH)) {
        console.error('❌ Global database not found!');
        process.exit(1);
    }
    
    const db = new sqlite3.Database(GLOBAL_DB_PATH);
    
    try {
        // Get table list
        const tables = await all(db, "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
        console.log(`\nFound ${tables.length} tables: ${tables.map(t => t.name).join(', ')}`);
        
        // Audit each table
        await auditTable(db, 'clients', {
            idColumn: 'id',
            uuidColumns: ['id'],
            dateColumns: ['created_at', 'updated_at']
        });
        
        await auditTable(db, 'organismes', {
            idColumn: 'id',
            uuidColumns: ['id'],
            booleanColumns: ['active'],
            dateColumns: ['created_at', 'updated_at']
        });
        
        await auditTable(db, 'users', {
            idColumn: 'id',
            uuidColumns: ['id', 'role_id', 'client_id'],
            booleanColumns: ['active'],
            dateColumns: ['created_at'],
            fkChecks: [
                { column: 'client_id', refTable: 'clients', refColumn: 'id' }
            ]
        });
        
        await auditTable(db, 'patients', {
            idColumn: 'id',
            uuidColumns: ['id'],
            booleanColumns: ['isPayant'],
            dateColumns: ['dateOfBirth', 'created_at', 'updated_at'],
            jsonColumns: ['insurance_data', 'emergency_contacts', 'guardian_data']
        });
        
        await auditTable(db, 'global_products', {
            idColumn: 'id',
            uuidColumns: ['id'],
            booleanColumns: ['is_active'],
            dateColumns: ['created_at', 'updated_at'],
            jsonColumns: ['dci_composition']
        });
        
        await auditTable(db, 'global_suppliers', {
            idColumn: 'id',
            uuidColumns: ['id'],
            booleanColumns: ['is_active'],
            dateColumns: ['created_at'],
            jsonColumns: ['contact_info']
        });
        
        await auditTable(db, 'global_dci', {
            idColumn: 'id',
            uuidColumns: ['id'],
            dateColumns: ['created_at'],
            jsonColumns: ['synonyms']
        });
        
        await auditTable(db, 'global_roles', {
            idColumn: 'id',
            uuidColumns: ['id'],
            dateColumns: ['created_at'],
            jsonColumns: ['permissions']
        });
        
        await auditTable(db, 'global_actes', {
            idColumn: 'code_sih',
            booleanColumns: ['actif']
        });
        
        await auditTable(db, 'global_atc', {
            idColumn: 'code',
            fkChecks: [
                { column: 'parent', refTable: 'global_atc', refColumn: 'code' }
            ]
        });
        
        await auditTable(db, 'global_emdn', {
            idColumn: 'code',
            fkChecks: [
                { column: 'parent', refTable: 'global_emdn', refColumn: 'code' }
            ]
        });
        
        await auditTable(db, 'global_product_price_history', {
            idColumn: 'id',
            uuidColumns: ['id', 'product_id'],
            dateColumns: ['valid_from', 'valid_to', 'created_at'],
            fkChecks: [
                { column: 'product_id', refTable: 'global_products', refColumn: 'id' }
            ]
        });
        
    } finally {
        db.close();
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('AUDIT SUMMARY');
    console.log('='.repeat(60));
    
    if (issues.length === 0) {
        console.log('✅ No issues found! Database is ready for migration.');
    } else {
        console.log(`⚠️  Found ${issues.length} issue(s):\n`);
        
        // Group by type
        const byType: Record<string, AuditIssue[]> = {};
        for (const issue of issues) {
            byType[issue.issueType] = byType[issue.issueType] || [];
            byType[issue.issueType].push(issue);
        }
        
        for (const [type, typeIssues] of Object.entries(byType)) {
            console.log(`${type}: ${typeIssues.length}`);
            for (const issue of typeIssues.slice(0, 5)) {
                console.log(`  - ${issue.table}.${issue.column} [${issue.rowId}]: ${issue.description}`);
                if (issue.value) console.log(`    Value: ${issue.value}`);
            }
            if (typeIssues.length > 5) {
                console.log(`  ... and ${typeIssues.length - 5} more`);
            }
        }
        
        // Save full report
        const reportPath = path.join(__dirname, '../../data/audit_global_report.json');
        fs.writeFileSync(reportPath, JSON.stringify(issues, null, 2));
        console.log(`\nFull report saved to: ${reportPath}`);
    }
    
    return issues.length === 0 ? 0 : 1;
}

main()
    .then(code => process.exit(code))
    .catch(err => {
        console.error('Audit failed:', err);
        process.exit(1);
    });
