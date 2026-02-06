/**
 * PostgreSQL Tenant Database Connection Pool Manager
 * 
 * Manages per-tenant connection pools with caching and lifecycle management.
 * Each tenant has their own database: tenant_{tenant_id}
 */

import { Pool, PoolClient } from 'pg';

// Configuration from environment
const baseConfig = {
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    user: process.env.PG_USER || 'sahty',
    password: process.env.PG_PASSWORD || 'sahty_dev_2026',
    max: parseInt(process.env.PG_POOL_MAX || '10'), // Lower per-tenant
    idleTimeoutMillis: parseInt(process.env.PG_POOL_IDLE_TIMEOUT || '30000'),
    connectionTimeoutMillis: parseInt(process.env.PG_POOL_CONNECTION_TIMEOUT || '5000'),
};

const DB_PREFIX = process.env.PG_TENANT_DB_PREFIX || 'tenant_';

// Pool cache: tenant_id -> Pool
const pools: Map<string, Pool> = new Map();

/**
 * Get database name for a tenant
 */
export function getTenantDbName(tenantId: string): string {
    return `${DB_PREFIX}${tenantId}`;
}

/**
 * Get or create a connection pool for a tenant
 */
export function getTenantPool(tenantId: string): Pool {
    if (!tenantId) {
        throw new Error('Tenant ID is required');
    }
    
    if (!pools.has(tenantId)) {
        const dbName = getTenantDbName(tenantId);
        const pool = new Pool({
            ...baseConfig,
            database: dbName,
        });
        
        pool.on('error', (err) => {
            console.error(`[TenantPg:${tenantId}] Pool error:`, err.message);
        });
        
        pools.set(tenantId, pool);
        console.log(`[TenantPg] Pool created for ${dbName}`);
    }
    
    return pools.get(tenantId)!;
}

/**
 * Execute a query on a tenant database
 */
export async function tenantQuery<T = any>(
    tenantId: string,
    sql: string, 
    params: any[] = []
): Promise<T[]> {
    const result = await getTenantPool(tenantId).query(sql, params);
    return result.rows;
}

/**
 * Execute a query and return single row (or null)
 */
export async function tenantQueryOne<T = any>(
    tenantId: string,
    sql: string, 
    params: any[] = []
): Promise<T | null> {
    const result = await getTenantPool(tenantId).query(sql, params);
    return result.rows[0] || null;
}

/**
 * Get a client for transaction support
 */
export async function getTenantClient(tenantId: string): Promise<PoolClient> {
    return getTenantPool(tenantId).connect();
}

/**
 * Execute a function within a transaction
 * 
 * This is the primary way to execute multi-step operations safely.
 * The client is automatically released after the transaction.
 */
export interface AuditContext {
    userId: string;
    clientInfo?: string; // IP or App Name
}

export async function tenantTransaction<T>(
    tenantId: string,
    fn: (client: PoolClient) => Promise<T>,
    auditContext?: AuditContext
): Promise<T> {
    const client = await getTenantClient(tenantId);
    try {
        await client.query('BEGIN');
        
        if (auditContext) {
            await client.query(`SELECT set_config('sahty.current_user_id', $1, true)`, [auditContext.userId]);
            if (auditContext.clientInfo) {
                // client_info is standard postgres var
                await client.query(`SELECT set_config('sahty.client_info', $1, true)`, [auditContext.clientInfo]); 
            }
        }

        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Close a specific tenant's pool
 */
export async function closeTenantPool(tenantId: string): Promise<void> {
    const pool = pools.get(tenantId);
    if (pool) {
        await pool.end();
        pools.delete(tenantId);
        console.log(`[TenantPg] Pool closed for tenant_${tenantId}`);
    }
}

/**
 * Close all tenant pools (for graceful shutdown)
 */
export async function closeAllTenantPools(): Promise<void> {
    const closePromises = Array.from(pools.entries()).map(async ([tenantId, pool]) => {
        await pool.end();
        console.log(`[TenantPg] Pool closed for tenant_${tenantId}`);
    });
    
    await Promise.all(closePromises);
    pools.clear();
    console.log('[TenantPg] All pools closed');
}

/**
 * Get list of active tenant pool IDs
 */
export function getActiveTenantIds(): string[] {
    return Array.from(pools.keys());
}

/**
 * Get pool statistics
 */
export function getPoolStats(): Record<string, { total: number; idle: number; waiting: number }> {
    const stats: Record<string, { total: number; idle: number; waiting: number }> = {};
    
    for (const [tenantId, pool] of pools) {
        stats[tenantId] = {
            total: pool.totalCount,
            idle: pool.idleCount,
            waiting: pool.waitingCount,
        };
    }
    
    return stats;
}

// Graceful shutdown handler
process.on('SIGTERM', async () => {
    console.log('[TenantPg] Received SIGTERM, closing pools...');
    await closeAllTenantPools();
});

process.on('SIGINT', async () => {
    console.log('[TenantPg] Received SIGINT, closing pools...');
    await closeAllTenantPools();
});
