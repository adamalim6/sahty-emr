import { Pool } from 'pg';

const pool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    user: process.env.PG_USER || 'sahty',
    password: process.env.PG_PASSWORD || 'sahty_dev_2026',
    database: 'sahty_global'
});

async function run() {
    const client = await pool.connect();
    try {
        console.log('Connected to sahty_global.');

        // 1. Move care_categories to public
        console.log('Moving care_categories to public schema...');
        try {
            await client.query('ALTER TABLE IF EXISTS reference.care_categories SET SCHEMA public');
            console.log('Moved care_categories to public.');
        } catch (e: any) {
            console.log('Failed to move care_categories, it might already be in public or not exist:', e.message);
        }

        // 2. Drop the rogue reference schema in global db
        console.log('Dropping reference schema from global db...');
        try {
            await client.query('DROP SCHEMA IF EXISTS reference CASCADE');
            console.log('Dropped reference schema.');
        } catch (e: any) {
            console.log('Failed to drop reference schema:', e.message);
        }

        // 3. Drop identity and identity_sync from global db
        console.log('Dropping identity schemas from global db...');
        try {
            await client.query('DROP SCHEMA IF EXISTS identity CASCADE');
            await client.query('DROP SCHEMA IF EXISTS identity_sync CASCADE');
            console.log('Dropped identity and identity_sync schemas.');
        } catch (e: any) {
            console.log('Failed to drop identity schemas:', e.message);
        }

        console.log('Data structure repaired in sahty_global!');

    } catch(err) {
        console.error('Error:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
