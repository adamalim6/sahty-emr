/**
 * PostgreSQL Identity Database Connection Pool
 * 
 * Provides a shared connection pool to the sahty_identity database.
 * Used for accessing authoritative Master Patient Index (MPI) data.
 */

import { Pool, PoolClient } from 'pg';

// Configuration from environment
const config = {
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    user: process.env.PG_USER || 'sahty',
    password: process.env.PG_PASSWORD || 'sahty_dev_2026',
    database: process.env.PG_IDENTITY_DB || 'sahty_identity',
    max: parseInt(process.env.PG_POOL_MAX || '20'),
    idleTimeoutMillis: parseInt(process.env.PG_POOL_IDLE_TIMEOUT || '30000'),
    connectionTimeoutMillis: parseInt(process.env.PG_POOL_CONNECTION_TIMEOUT || '5000'),
};

// Singleton pool instance
let pool: Pool | null = null;

/**
 * Get the identity database pool (creates if not exists)
 */
export function getIdentityPool(): Pool {
    if (!pool) {
        pool = new Pool(config);
        
        // Log connection errors
        pool.on('error', (err) => {
            console.error('Identity pool error:', err.message);
        });
        
        console.log(`[IdentityPg] Pool created for ${config.database}`);
    }
    return pool;
}

/**
 * Execute a query on the identity database
 */
export async function identityQuery<T = any>(
    sql: string, 
    params: any[] = []
): Promise<T[]> {
    const result = await getIdentityPool().query(sql, params);
    return result.rows;
}

/**
 * Get a client from the pool for transactions
 * @returns PoolClient
 */
export async function getIdentityClient(): Promise<PoolClient> {
    const pool = getIdentityPool();
    return await pool.connect();
}

/**
 * Helper to run a transaction on the identity database
 */
export async function identityTransaction<T>(
    callback: (client: PoolClient) => Promise<T>
): Promise<T> {
    const client = await getIdentityClient();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}
