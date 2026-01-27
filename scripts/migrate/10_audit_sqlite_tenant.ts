/**
 * SQLite Tenant Database Audit Script
 * 
 * Pre-migration audit to detect data quality issues before migrating tenant to PostgreSQL.
 * 
 * Usage: npx ts-node scripts/migrate/10_audit_sqlite_tenant.ts <tenant_id>
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const TENANTS_DIR = path.join(__dirname, '../../data/tenants');

interface AuditIssue {
    table: string;
    column?: string;
    rowId?: string;
    issueType: string;
    description: string;
    value?: any;
}

// Helper to run queries
const all = (db: sqlite3.Database, sql: string, params: any[] = []): Promise<any[]> =>
    new Promise((res, rej) => db.all(sql, params, (err, rows) => err ? rej(err) : res(rows)));

// Validators
function isValidUUID(str: string): boolean {
    if (!str) return true;
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

async function auditTable(
    db: sqlite3.Database,
    tableName: string,
    issues: AuditIssue[],
    config: {
        idColumn: string;
        uuidColumns?: string[];
        dateColumns?: string[];
        jsonColumns?: string[];
        booleanColumns?: string[];
        positiveIntColumns?: string[];
        fkChecks?: { column: string; refTable: string; refColumn: string }[];
    }
) {
    try {
        const rows = await all(db, `SELECT * FROM ${tableName}`);
        console.log(`   ${tableName}: ${rows.length} rows`);

        for (const row of rows) {
            const rowId = row[config.idColumn] || 'unknown';

            // UUID validation
            for (const col of config.uuidColumns || []) {
                if (row[col] && !isValidUUID(row[col])) {
                    issues.push({ table: tableName, column: col, rowId, issueType: 'INVALID_UUID', description: 'Invalid UUID format', value: row[col] });
                }
            }

            // Date validation
            for (const col of config.dateColumns || []) {
                if (row[col] && !isValidDate(row[col])) {
                    issues.push({ table: tableName, column: col, rowId, issueType: 'INVALID_DATE', description: 'Invalid date format', value: row[col] });
                }
            }

            // JSON validation
            for (const col of config.jsonColumns || []) {
                if (row[col] && !isValidJSON(row[col])) {
                    issues.push({ table: tableName, column: col, rowId, issueType: 'INVALID_JSON', description: 'Invalid JSON', value: row[col]?.substring(0, 100) });
                }
            }

            // Boolean validation
            for (const col of config.booleanColumns || []) {
                if (!isValidBoolean(row[col])) {
                    issues.push({ table: tableName, column: col, rowId, issueType: 'INVALID_BOOLEAN', description: 'Unexpected boolean value', value: row[col] });
                }
            }

            // Positive integer validation (for qty fields)
            for (const col of config.positiveIntColumns || []) {
                if (row[col] !== null && row[col] < 0) {
                    issues.push({ table: tableName, column: col, rowId, issueType: 'NEGATIVE_VALUE', description: 'Negative value in quantity field', value: row[col] });
                }
            }
        }

        // FK checks
        for (const fk of config.fkChecks || []) {
            try {
                const orphans = await all(db, `
                    SELECT t.${config.idColumn} as id, t.${fk.column} as fk_value
                    FROM ${tableName} t
                    LEFT JOIN ${fk.refTable} r ON t.${fk.column} = r.${fk.refColumn}
                    WHERE t.${fk.column} IS NOT NULL AND r.${fk.refColumn} IS NULL
                `);

                for (const o of orphans) {
                    issues.push({ table: tableName, column: fk.column, rowId: o.id, issueType: 'ORPHAN_FK', description: `References non-existent ${fk.refTable}.${fk.refColumn}`, value: o.fk_value });
                }
            } catch {
                // Table might not exist
            }
        }
    } catch (err: any) {
        if (!err.message.includes('no such table')) {
            console.log(`   ⚠️ ${tableName}: ${err.message}`);
        }
    }
}

async function auditTenant(tenantId: string): Promise<AuditIssue[]> {
    const dbPath = path.join(TENANTS_DIR, tenantId, 'tenant.db');
    
    if (!fs.existsSync(dbPath)) {
        console.error(`❌ Tenant database not found: ${dbPath}`);
        return [];
    }
    
    console.log(`\n📋 Auditing tenant: ${tenantId}`);
    const issues: AuditIssue[] = [];
    const db = new sqlite3.Database(dbPath);
    
    try {
        // Inventory tables
        await auditTable(db, 'current_stock', issues, {
            idColumn: 'product_id',
            uuidColumns: ['product_id'],
            dateColumns: ['expiry'],
            positiveIntColumns: ['qty_units']
        });
        
        await auditTable(db, 'inventory_movements', issues, {
            idColumn: 'movement_id',
            uuidColumns: ['movement_id', 'product_id'],
            dateColumns: ['expiry', 'created_at']
        });
        
        await auditTable(db, 'stock_reservations', issues, {
            idColumn: 'reservation_id',
            uuidColumns: ['reservation_id', 'product_id'],
            dateColumns: ['expiry', 'reserved_at', 'expires_at'],
            positiveIntColumns: ['qty_units']
        });
        
        // Procurement tables
        await auditTable(db, 'delivery_notes', issues, {
            idColumn: 'delivery_note_id',
            uuidColumns: ['delivery_note_id', 'po_id'],
            dateColumns: ['received_at', 'created_at']
        });
        
        await auditTable(db, 'delivery_note_items', issues, {
            idColumn: 'id',
            uuidColumns: ['id', 'delivery_note_id', 'product_id'],
            positiveIntColumns: ['qty_pending'],
            fkChecks: [{ column: 'delivery_note_id', refTable: 'delivery_notes', refColumn: 'delivery_note_id' }]
        });
        
        await auditTable(db, 'delivery_note_layers', issues, {
            idColumn: 'delivery_note_id',
            uuidColumns: ['product_id'],
            dateColumns: ['expiry'],
            positiveIntColumns: ['qty_received', 'qty_remaining'],
            fkChecks: [{ column: 'delivery_note_id', refTable: 'delivery_notes', refColumn: 'delivery_note_id' }]
        });
        
        await auditTable(db, 'purchase_orders', issues, {
            idColumn: 'po_id',
            uuidColumns: ['po_id'],
            dateColumns: ['created_at', 'updated_at']
        });
        
        await auditTable(db, 'po_items', issues, {
            idColumn: 'po_id',
            uuidColumns: ['product_id'],
            positiveIntColumns: ['qty_ordered', 'qty_delivered'],
            fkChecks: [{ column: 'po_id', refTable: 'purchase_orders', refColumn: 'po_id' }]
        });
        
        // Transfer tables
        await auditTable(db, 'stock_demands', issues, {
            idColumn: 'id',
            uuidColumns: ['id'],
            dateColumns: ['created_at', 'updated_at']
        });
        
        await auditTable(db, 'stock_demand_lines', issues, {
            idColumn: 'id',
            uuidColumns: ['id', 'demand_id', 'product_id'],
            positiveIntColumns: ['qty_requested', 'qty_allocated', 'qty_transferred'],
            fkChecks: [{ column: 'demand_id', refTable: 'stock_demands', refColumn: 'id' }]
        });
        
        await auditTable(db, 'stock_transfers', issues, {
            idColumn: 'id',
            uuidColumns: ['id', 'demand_id'],
            dateColumns: ['validated_at', 'created_at'],
            fkChecks: [{ column: 'demand_id', refTable: 'stock_demands', refColumn: 'id' }]
        });
        
        await auditTable(db, 'stock_transfer_lines', issues, {
            idColumn: 'id',
            uuidColumns: ['id', 'transfer_id', 'product_id', 'demand_line_id'],
            dateColumns: ['expiry'],
            positiveIntColumns: ['qty_transferred'],
            fkChecks: [{ column: 'transfer_id', refTable: 'stock_transfers', refColumn: 'id' }]
        });
        
        // Settings tables
        await auditTable(db, 'users', issues, {
            idColumn: 'id',
            uuidColumns: ['id', 'role_id'],
            booleanColumns: ['active'],
            jsonColumns: ['service_ids'],
            dateColumns: ['created_at']
        });
        
        await auditTable(db, 'services', issues, {
            idColumn: 'id',
            uuidColumns: ['id'],
        });
        
        await auditTable(db, 'locations', issues, {
            idColumn: 'location_id',
            uuidColumns: ['location_id', 'service_id'],
            booleanColumns: ['is_active'],
            dateColumns: ['created_at']
        });
        
        // EMR tables
        await auditTable(db, 'admissions', issues, {
            idColumn: 'id',
            uuidColumns: ['id', 'patient_id', 'service_id'],
            dateColumns: ['admission_date', 'discharge_date', 'created_at']
        });
        
        await auditTable(db, 'prescriptions', issues, {
            idColumn: 'id',
            uuidColumns: ['id', 'patient_id'],
            jsonColumns: ['data'],
            dateColumns: ['created_at']
        });
        
        // Config tables
        await auditTable(db, 'product_configs', issues, {
            idColumn: 'product_id',
            uuidColumns: ['product_id'],
            booleanColumns: ['is_enabled'],
            dateColumns: ['created_at', 'updated_at']
        });
        
        await auditTable(db, 'product_suppliers', issues, {
            idColumn: 'id',
            uuidColumns: ['id', 'product_id'],
            booleanColumns: ['is_active'],
            dateColumns: ['created_at', 'updated_at']
        });
        
    } finally {
        db.close();
    }
    
    return issues;
}

async function main() {
    const tenantId = process.argv[2];
    
    console.log('='.repeat(60));
    console.log('SQLite Tenant Database Audit');
    console.log('='.repeat(60));
    
    let tenantsToAudit: string[] = [];
    
    if (tenantId) {
        tenantsToAudit = [tenantId];
    } else {
        // Audit all client tenants
        const dirs = fs.readdirSync(TENANTS_DIR);
        tenantsToAudit = dirs.filter(d => 
            d.startsWith('client_') && 
            fs.existsSync(path.join(TENANTS_DIR, d, 'tenant.db'))
        );
        console.log(`Found ${tenantsToAudit.length} tenant(s) to audit`);
    }
    
    const allIssues: Record<string, AuditIssue[]> = {};
    
    for (const tid of tenantsToAudit) {
        const issues = await auditTenant(tid);
        if (issues.length > 0) {
            allIssues[tid] = issues;
        }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('AUDIT SUMMARY');
    console.log('='.repeat(60));
    
    const totalIssues = Object.values(allIssues).flat().length;
    
    if (totalIssues === 0) {
        console.log('✅ No issues found! All tenants ready for migration.');
    } else {
        console.log(`⚠️ Found ${totalIssues} issue(s) across ${Object.keys(allIssues).length} tenant(s):`);
        
        for (const [tid, issues] of Object.entries(allIssues)) {
            console.log(`\n${tid}: ${issues.length} issues`);
            const byType: Record<string, number> = {};
            for (const i of issues) {
                byType[i.issueType] = (byType[i.issueType] || 0) + 1;
            }
            for (const [type, count] of Object.entries(byType)) {
                console.log(`  ${type}: ${count}`);
            }
        }
        
        // Save report
        const reportPath = path.join(__dirname, '../../data/audit_tenants_report.json');
        fs.writeFileSync(reportPath, JSON.stringify(allIssues, null, 2));
        console.log(`\nFull report saved to: ${reportPath}`);
    }
    
    return totalIssues > 0 ? 1 : 0;
}

main()
    .then(code => process.exit(code))
    .catch(err => {
        console.error('Audit failed:', err);
        process.exit(1);
    });
