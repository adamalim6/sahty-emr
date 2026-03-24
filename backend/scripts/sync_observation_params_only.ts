import { Pool } from 'pg';
import { getGlobalPool } from '../db/globalPg';

const adminPool = new Pool({ host:'localhost', port:5432, user:'sahty', password:'sahty_dev_2026', database:'postgres' });

async function run() {
    try {
        const globalPool = getGlobalPool();
        const { rows: globalParams } = await globalPool.query(`SELECT * FROM public.observation_parameters`);
        
        console.log(`Fetched ${globalParams.length} parameters from sahty_global.`);
        const cols = Object.keys(globalParams[0]);
        const colsList = cols.map(c => `"${c}"`).join(', ');

        const { rows: dbs } = await adminPool.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
        const tenants = dbs.map(r => r.datname);
        
        for (const dbName of tenants) {
            console.log(`Syncing parameters to ${dbName}...`);
            const pool = new Pool({ host:'localhost', port:5432, user:'sahty', password:'sahty_dev_2026', database: dbName });
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                await client.query('TRUNCATE TABLE reference.observation_parameters CASCADE');
                
                const values = [];
                const placeholders = [];
                let pIdx = 1;
                for (const row of globalParams) {
                    const rowPlaceholders = [];
                    for (const col of cols) {
                        rowPlaceholders.push(`$${pIdx++}`);
                        values.push(row[col]);
                    }
                    placeholders.push(`(${rowPlaceholders.join(', ')})`);
                }
                
                await client.query(`
                    INSERT INTO reference.observation_parameters (${colsList})
                    VALUES ${placeholders.join(', ')}
                `, values);
                
                await client.query('COMMIT');
                console.log(`Successfully synced ${dbName}`);
            } catch (e) {
                await client.query('ROLLBACK');
                console.error(`Failed on ${dbName}:`, e);
            } finally {
                client.release();
                await pool.end();
            }
        }
        await globalPool.end();
    } catch (e) {
        console.error("Global error:", e);
    } finally {
        await adminPool.end();
    }
}

run();
