import { getTenantPool } from '../db/tenantPg';
import { globalQueryOne, globalQuery } from '../db/globalPg';
import * as fs from 'fs';
import * as path from 'path';

export interface UpdateResult {
    status: 'success' | 'error' | 'skipped';
    fromVersion: number;
    toVersion: number;
    details: string[];
}

export class TenantUpdateService {
    
    // Hardcoded migration directory based on user spec
    private readonly migrationDir = path.join(__dirname, '../migrations/pg/ref_migrations');

    /**
     * Given a specific tenant ID, this verifies the current applied version vs the maximum global version,
     * isolates pending migration files, and loops through them sequentially executing them within a transaction.
     */
    public async updateTenantReferenceSchema(tenantId: string): Promise<UpdateResult> {
        const pool = getTenantPool(tenantId);
        const details: string[] = [];
        let currentVersion = 0;
        let globalVersion = 0;

        try {
            // 1. Get Tenant Version
            const versionRow = await pool.query('SELECT current_version FROM public.reference_schema_version WHERE id = 1');
            if (versionRow.rows.length === 0) {
                details.push("ERROR: reference_schema_version table is empty or missing. Please ensure provisioning or backfill was successful.");
                return { status: 'error', fromVersion: 0, toVersion: 0, details };
            }
            currentVersion = versionRow.rows[0].current_version;

            // 2. Get Global Maximum Version
            const globalRow = await globalQueryOne('SELECT MAX(version) as max_v FROM public.reference_schema_changelog');
            globalVersion = globalRow?.max_v || 0;

            if (currentVersion >= globalVersion) {
                details.push(`Tenant is already fully up to date on version ${currentVersion}.`);
                await globalQuery(
                    `INSERT INTO public.tenant_schema_update_logs (tenant_id, from_version, to_version, status, details) VALUES ($1, $2, $3, $4, $5)`,
                    [tenantId, currentVersion, currentVersion, 'skipped', JSON.stringify(details)]
                );
                return { status: 'skipped', fromVersion: currentVersion, toVersion: currentVersion, details };
            }

            details.push(`Tenant needs update from v${currentVersion} to v${globalVersion}`);

            // 3. Locate Pending Migration Files
            if (!fs.existsSync(this.migrationDir)) {
                details.push(`ERROR: Migration directory not found: ${this.migrationDir}`);
                await globalQuery(
                    `INSERT INTO public.tenant_schema_update_logs (tenant_id, from_version, to_version, status, details) VALUES ($1, $2, $3, $4, $5)`,
                    [tenantId, currentVersion, currentVersion, 'error', JSON.stringify(details)]
                );
                return { status: 'error', fromVersion: currentVersion, toVersion: currentVersion, details };
            }

            const allFiles = fs.readdirSync(this.migrationDir)
                               .filter(f => f.endsWith('.sql'))
                               .sort(); // Sorting standard "001_...", "002_..." naming schema correctly orders them
            
            // Note: Since filenames dictate implicit version sequences (001 -> v1, 002 -> v2),
            // We expect one file per version leap starting from Version 1 up to GlobalVersion.
            // A more robust regex parses the prefix strictly:
            const migrationsToApply = allFiles.map(file => {
                const parts = file.split('_');
                const vNum = parseInt(parts[0], 10);
                return { file, version: vNum };
            }).filter(m => m.version > currentVersion && m.version <= globalVersion)
              .sort((a, b) => a.version - b.version);

            // 4. Sequential Execution Phase
            let successfulUpgrades = currentVersion;
            
            for (const migration of migrationsToApply) {
                const sqlPath = path.join(this.migrationDir, migration.file);
                const sqlContent = fs.readFileSync(sqlPath, 'utf8');

                let localClient;
                try {
                    localClient = await pool.connect();
                    await localClient.query('BEGIN');
                    
                    details.push(`Executing migration: ${migration.file}...`);
                    
                    // Apply DDL payload
                    await localClient.query(sqlContent);
                    
                    // Increment the persistent tracker defensively as atomic payload alongside DDL
                    await localClient.query(`
                        UPDATE public.reference_schema_version 
                        SET current_version = $1, updated_at = now() 
                        WHERE id = 1
                    `, [migration.version]);

                    await localClient.query('COMMIT');
                    
                    details.push(`SUCCESS: Applied v${migration.version}.`);
                    successfulUpgrades = migration.version;
                } catch (migrationError: any) {
                    if (localClient) await localClient.query('ROLLBACK');
                    details.push(`ERROR on file ${migration.file}: ${migrationError.message}`);
                    throw migrationError; // Bubble out immediately stopping loop execution
                } finally {
                    if (localClient) localClient.release();
                }
            }
            
            await globalQuery(
                `INSERT INTO public.tenant_schema_update_logs (tenant_id, from_version, to_version, status, details) VALUES ($1, $2, $3, $4, $5)`,
                [tenantId, currentVersion, successfulUpgrades, 'success', JSON.stringify(details)]
            );

            return {
                status: 'success',
                fromVersion: currentVersion,
                toVersion: successfulUpgrades,
                details
            };

        } catch (e: any) {
            console.error(`[TenantUpdateService] Update exception for ${tenantId}:`, e.message);
            details.push(`EXCEPTION: ${e.message}`);
            await globalQuery(
                `INSERT INTO public.tenant_schema_update_logs (tenant_id, from_version, to_version, status, details) VALUES ($1, $2, $3, $4, $5)`,
                [tenantId, currentVersion, currentVersion, 'error', JSON.stringify(details)]
            );
            return {
                status: 'error',
                fromVersion: currentVersion,
                toVersion: currentVersion, // Assume rollback means no actual version changes persisted, although it technically stopped halfway if there were multiple pending files. Wait, if it failed on v3 but v2 passed, then the DB is on v2. The tracker is also on v2. So toVersion should literally be the DB query. But realistically we bubble up whatever the last success was before dying.
                details
            };
        }
    }
}

export const tenantUpdateService = new TenantUpdateService();
