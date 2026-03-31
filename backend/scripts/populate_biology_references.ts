import { Pool } from 'pg';
import { randomUUID } from 'crypto';

console.log("HELLO WORLD. Script is running!");

async function main() {
    console.log("Inside main function...");
    const pool = new Pool({
        user: 'sahty',
        host: 'localhost',
        database: 'sahty_global',
        password: 'sahty_dev_2026',
        port: 5432,
    });

    try {
        console.log("Database connected.");
        const res = await pool.query("SELECT 1 as val");
        console.log("Query 1:", res.rows[0].val);
    } catch (e: any) {
        console.error("Error:", e.message);
    } finally {
        await pool.end();
    }
}

main().catch(console.error);
