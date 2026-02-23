import { Client } from 'pg';

async function main() {
    const client = new Client({
        user: 'sahty', host: 'localhost', database: 'sahty_global', password: 'sahty_dev_2026', port: 5432,
    });
    await client.connect();

    const res = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'global_dci';
    `);
    console.log("global_dci columns:", res.rows);
    
    await client.end();
}

main().catch(console.error);
