/**
 * PostgreSQL Global Database Connection Pool
 * 
 * Provides a shared connection pool to the sahty_global database.
 * Used for accessing global reference data (products, actes, patients, etc.)
 */

import { Pool, PoolClient } from 'pg';

// Configuration from environment
const config = {
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    user: process.env.PG_USER || 'sahty',
    password: process.env.PG_PASSWORD || 'sahty_dev_2026',
    database: process.env.PG_GLOBAL_DB || 'sahty_global',
    max: parseInt(process.env.PG_POOL_MAX || '20'),
    idleTimeoutMillis: parseInt(process.env.PG_POOL_IDLE_TIMEOUT || '30000'),
    connectionTimeoutMillis: parseInt(process.env.PG_POOL_CONNECTION_TIMEOUT || '5000'),
};

// Singleton pool instance
let pool: Pool | null = null;

/**
 * Get the global database pool (creates if not exists)
 */
export function getGlobalPool(): Pool {
    if (!pool) {
        pool = new Pool(config);
        
        // Log connection errors
        pool.on('error', (err) => {
            console.error('Global pool error:', err.message);
        });
        
        console.log(`[GlobalPg] Pool created for ${config.database}`);
    }
    return pool;
}

/**
 * Execute a query on the global database
 */
export async function globalQuery<T = any>(
    sql: string, 
    params: any[] = []
): Promise<T[]> {
    const result = await getGlobalPool().query(sql, params);
    return result.rows;
}

/**
 * Execute a query and return single row (or null)
 */
export async function globalQueryOne<T = any>(
    sql: string, 
    params: any[] = []
): Promise<T | null> {
    const result = await getGlobalPool().query(sql, params);
    return result.rows[0] || null;
}

/**
 * Get a client for transaction support
 */
export async function getGlobalClient(): Promise<PoolClient> {
    return getGlobalPool().connect();
}

/**
 * Execute a function within a transaction
 */
export interface AuditContext {
    userId: string;
    clientInfo?: string;
}

export async function globalTransaction<T>(
    fn: (client: PoolClient) => Promise<T>,
    auditContext?: AuditContext
): Promise<T> {
    const client = await getGlobalClient();
    try {
        await client.query('BEGIN');

        if (auditContext) {
            await client.query(`SELECT set_config('sahty.current_user_id', $1, true)`, [auditContext.userId]);
            if (auditContext.clientInfo) {
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
 * Close the global pool (for graceful shutdown)
 */
export async function closeGlobalPool(): Promise<void> {
    if (pool) {
        await pool.end();
        pool = null;
        console.log('[GlobalPg] Pool closed');
    }
}

// Helper type for parameterized queries
export interface QueryConfig {
    text: string;
    values?: any[];
}
