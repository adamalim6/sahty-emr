/**
 * Master Migration Script
 * 
 * Orchestrates the complete SQLite to PostgreSQL migration.
 * 
 * Usage: npx ts-node scripts/migrate/99_migrate_all.ts
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const TENANTS_DIR = path.join(__dirname, '../../data/tenants');
const SCRIPTS_DIR = __dirname;

// Skip these directories (test/legacy data)
const SKIP_PATTERNS = ['verify_', 'GLOBAL'];

function runScript(script: string, args: string[] = []): boolean {
    const cmd = `npx ts-node ${path.join(SCRIPTS_DIR, script)} ${args.join(' ')}`;
    console.log(`\n🚀 Running: ${cmd}\n`);
    
    try {
        execSync(cmd, { 
            cwd: path.join(__dirname, '../..'),
            stdio: 'inherit' 
        });
        return true;
    } catch (err) {
        console.error(`❌ Script failed: ${script}`);
        return false;
    }
}

async function main() {
    console.log('='.repeat(70));
    console.log('SAHTY EMR - COMPLETE SQLITE TO POSTGRESQL MIGRATION');
    console.log('='.repeat(70));
    console.log(`Started at: ${new Date().toISOString()}`);
    
    // Step 1: Audit global database
    console.log('\n' + '─'.repeat(70));
    console.log('STEP 1: Audit Global Database');
    console.log('─'.repeat(70));
    
    if (!runScript('00_audit_sqlite_global.ts')) {
        console.log('\n⚠️ Global audit found issues. Review them before proceeding.');
        console.log('Continue anyway? The migration will quarantine bad rows.');
    }
    
    // Step 2: Migrate global database
    console.log('\n' + '─'.repeat(70));
    console.log('STEP 2: Migrate Global Database');
    console.log('─'.repeat(70));
    
    if (!runScript('01_migrate_global.ts')) {
        console.error('\n❌ Global migration failed. Aborting.');
        process.exit(1);
    }
    
    // Step 3: Find tenant databases
    console.log('\n' + '─'.repeat(70));
    console.log('STEP 3: Identify Tenant Databases');
    console.log('─'.repeat(70));
    
    const tenantDirs = fs.readdirSync(TENANTS_DIR).filter(dir => {
        // Skip test/legacy directories
        if (SKIP_PATTERNS.some(p => dir.startsWith(p) || dir === p)) {
            console.log(`   Skipping: ${dir} (test/legacy)`);
            return false;
        }
        
        // Check if it has a tenant.db
        const dbPath = path.join(TENANTS_DIR, dir, 'tenant.db');
        if (!fs.existsSync(dbPath)) {
            console.log(`   Skipping: ${dir} (no tenant.db)`);
            return false;
        }
        
        return true;
    });
    
    console.log(`\nFound ${tenantDirs.length} tenant(s) to migrate:`);
    tenantDirs.forEach(t => console.log(`   - ${t}`));
    
    // Step 4: Audit all tenants
    console.log('\n' + '─'.repeat(70));
    console.log('STEP 4: Audit All Tenant Databases');
    console.log('─'.repeat(70));
    
    runScript('10_audit_sqlite_tenant.ts');
    
    // Step 5: Migrate each tenant
    console.log('\n' + '─'.repeat(70));
    console.log('STEP 5: Migrate Tenant Databases');
    console.log('─'.repeat(70));
    
    const results: { tenant: string; success: boolean }[] = [];
    
    for (const tenantDir of tenantDirs) {
        const tenantId = tenantDir.replace('client_', '');
        console.log(`\n${'─'.repeat(40)}`);
        console.log(`Migrating: ${tenantDir}`);
        console.log('─'.repeat(40));
        
        const success = runScript('11_migrate_tenant.ts', [tenantId]);
        results.push({ tenant: tenantDir, success });
    }
    
    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('MIGRATION COMPLETE');
    console.log('='.repeat(70));
    console.log(`Finished at: ${new Date().toISOString()}`);
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`\nGlobal: ✅ Migrated`);
    console.log(`Tenants: ${successful} successful, ${failed} failed`);
    
    if (failed > 0) {
        console.log('\nFailed tenants:');
        results.filter(r => !r.success).forEach(r => console.log(`   ❌ ${r.tenant}`));
    }
    
    console.log('\n📋 Next Steps:');
    console.log('   1. Review migration reports in backend/data/');
    console.log('   2. Run verification scripts: npm run verify:migration');
    console.log('   3. Update .env to use PostgreSQL');
    console.log('   4. Restart backend');
    
    return failed > 0 ? 1 : 0;
}

main()
    .then(code => process.exit(code))
    .catch(err => {
        console.error('Migration orchestration failed:', err);
        process.exit(1);
    });
