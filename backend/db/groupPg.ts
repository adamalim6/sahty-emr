/**
 * PostgreSQL Group Database Connection Pool Manager
 * 
 * Manages per-group connection pools with caching and lifecycle management.
 * Each group has their own database: group_<group_id_with_underscores>
 * 
 * Mirrors tenantPg.ts exactly, adapted for group databases.
 */

import { Pool, PoolClient } from 'pg';

// Configuration from environment
const baseConfig = {
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    user: process.env.PG_USER || 'sahty',
    password: process.env.PG_PASSWORD || 'sahty_dev_2026',
    max: parseInt(process.env.PG_POOL_MAX || '10'),
    idleTimeoutMillis: parseInt(process.env.PG_POOL_IDLE_TIMEOUT || '30000'),
    connectionTimeoutMillis: parseInt(process.env.PG_POOL_CONNECTION_TIMEOUT || '5000'),
};

// Pool cache: db_name -> Pool
const pools: Map<string, Pool> = new Map();

/**
 * Get or create a connection pool for a group database.
 * @param dbName - The actual database name (e.g. "group_abc123_def456...")
 */
export function getGroupPool(dbName: string): Pool {
    if (!dbName) {
        throw new Error('Group DB name is required');
    }
    
    if (!pools.has(dbName)) {
        const pool = new Pool({
            ...baseConfig,
            database: dbName,
        });
        
        pool.on('error', (err) => {
            console.error(`[GroupPg:${dbName}] Pool error:`, err.message);
        });
        
        pools.set(dbName, pool);
        console.log(`[GroupPg] Pool created for ${dbName}`);
    }
    
    return pools.get(dbName)!;
}

/**
 * Execute a query on a group database
 */
export async function groupQuery<T = any>(
    dbName: string,
    sql: string, 
    params: any[] = []
): Promise<T[]> {
    const result = await getGroupPool(dbName).query(sql, params);
    return result.rows;
}

/**
 * Execute a query and return single row (or null)
 */
export async function groupQueryOne<T = any>(
    dbName: string,
    sql: string, 
    params: any[] = []
): Promise<T | null> {
    const result = await getGroupPool(dbName).query(sql, params);
    return result.rows[0] || null;
}

/**
 * Get a client for transaction support
 */
export async function getGroupClient(dbName: string): Promise<PoolClient> {
    return getGroupPool(dbName).connect();
}

/**
 * Get list of active group pool DB names
 */
export function getActiveGroupDbNames(): string[] {
    return Array.from(pools.keys());
}

/**
 * Close all group pools (for graceful shutdown)
 */
export async function closeAllGroupPools(): Promise<void> {
    const closePromises = Array.from(pools.entries()).map(async ([dbName, pool]) => {
        await pool.end();
        console.log(`[GroupPg] Pool closed for ${dbName}`);
    });
    
    await Promise.all(closePromises);
    pools.clear();
    console.log('[GroupPg] All pools closed');
}

// Graceful shutdown handler
process.on('SIGTERM', async () => {
    await closeAllGroupPools();
});

process.on('SIGINT', async () => {
    await closeAllGroupPools();
});
