
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { getTenantDbName } from '../db/tenantPg';

export class TenantProvisioningService {
    private static instance: TenantProvisioningService;
    
    // Use SAHTY_EMR (default) or SAHTY_GLOBAL to connect for admin tasks
    // We need a pool that is NOT connected to the target tenant DB (which doesn't exist yet)
    private adminPool: Pool;

    private constructor() {
        this.adminPool = new Pool({
            host: process.env.PG_HOST || 'localhost',
            port: parseInt(process.env.PG_PORT || '5432'),
            user: process.env.PG_USER || 'sahty',
            password: process.env.PG_PASSWORD || 'sahty_dev_2026',
            database: process.env.PG_DB || 'sahty_emr' // Default DB to connect to
        });
    }

    public static getInstance(): TenantProvisioningService {
        if (!TenantProvisioningService.instance) {
            TenantProvisioningService.instance = new TenantProvisioningService();
        }
        return TenantProvisioningService.instance;
    }

    public async createTenantDatabase(tenantId: string): Promise<void> {
        const dbName = getTenantDbName(tenantId);
        console.log(`[TenantProvisioning] Checking database ${dbName}...`);
        
        try {
            // Check if DB exists
            const checkRes = await this.adminPool.query(
                "SELECT 1 FROM pg_database WHERE datname = $1",
                [dbName]
            );

            if (checkRes.rows.length === 0) {
                console.log(`[TenantProvisioning] Creating database ${dbName}...`);
                // CREATE DATABASE cannot run in a transaction block
                await this.adminPool.query(`CREATE DATABASE "${dbName}"`);
                console.log(`[TenantProvisioning] Database ${dbName} created.`);
                
                // Now apply schema
                await this.applySchema(tenantId, dbName);
            } else {
                console.log(`[TenantProvisioning] Database ${dbName} already exists.`);
            }
        } catch (error: any) {
            console.error(`[TenantProvisioning] Failed to create database ${dbName}:`, error);
            throw error;
        }
    }

    private async applySchema(tenantId: string, dbName: string): Promise<void> {
        console.log(`[TenantProvisioning] Applying schema to ${dbName}...`);
        
        // Connect specifically to the new DB
        const pool = new Pool({
            host: process.env.PG_HOST || 'localhost',
            port: parseInt(process.env.PG_PORT || '5432'),
            user: process.env.PG_USER || 'sahty',
            password: process.env.PG_PASSWORD || 'sahty_dev_2026',
            database: dbName
        });

        try {
            const schemaDir = path.join(__dirname, '../../migrations/pg/tenant');
            const files = ['000_init.sql', '001_tier2_additions.sql', '010_indexes.sql'];

            for (const file of files) {
                const filePath = path.join(schemaDir, file);
                if (fs.existsSync(filePath)) {
                    console.log(`[TenantProvisioning] Running ${file}...`);
                    const sql = fs.readFileSync(filePath, 'utf-8');
                    await pool.query(sql);
                } else {
                    console.warn(`[TenantProvisioning] Schema file not found: ${filePath}`);
                }
            }
            console.log(`[TenantProvisioning] Schema applied successfully.`);
        } finally {
            await pool.end();
        }
    }
}

export const tenantProvisioningService = TenantProvisioningService.getInstance();
