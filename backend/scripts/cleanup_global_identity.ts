
import { Client } from 'pg';

async function main() {
    // Connect to sahty_global
    const client = new Client({
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT || '5432'),
        user: process.env.PG_USER || 'sahty',
        password: process.env.PG_PASSWORD || 'sahty_dev_2026',
        database: 'sahty_global'
    });

    try {
        await client.connect();
        console.log('Connected to sahty_global.');

        // Verify it exists first
        const check = await client.query(`SELECT 1 FROM information_schema.schemata WHERE schema_name = 'identity'`);
        if ((check.rowCount || 0) > 0) {
            console.log('Dropping identity schema from sahty_global...');
            await client.query('DROP SCHEMA identity CASCADE');
            console.log('✅ Identity schema dropped from sahty_global.');
        } else {
            console.log('Identity schema does not exist in sahty_global.');
        }

    } catch (err: any) {
        console.error('Error dropping schema:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

main();
