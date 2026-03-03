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

        // Find orphaned categories in global_products
        const orphanedProducts = await client.query(`
            SELECT gp.id, gp.name, gp.care_category_id 
            FROM public.global_products gp 
            LEFT JOIN public.care_categories cc ON gp.care_category_id = cc.id 
            WHERE gp.care_category_id IS NOT NULL AND cc.id IS NULL;
        `);
        console.log(`Found ${orphanedProducts.rows.length} orphaned products.`);

        // Find orphaned categories in global_dci
        const orphanedDCI = await client.query(`
            SELECT gd.id, gd.name, gd.care_category_id 
            FROM public.global_dci gd 
            LEFT JOIN public.care_categories cc ON gd.care_category_id = cc.id 
            WHERE gd.care_category_id IS NOT NULL AND cc.id IS NULL;
        `);
        console.log(`Found ${orphanedDCI.rows.length} orphaned DCIs.`);

        if (orphanedProducts.rows.length > 0) {
            console.log('Clearing orphaned categories from global_products...');
            await client.query(`
                UPDATE public.global_products
                SET care_category_id = NULL
                WHERE care_category_id NOT IN (SELECT id FROM public.care_categories)
            `);
        }

        if (orphanedDCI.rows.length > 0) {
            console.log('Clearing orphaned categories from global_dci...');
            await client.query(`
                UPDATE public.global_dci
                SET care_category_id = NULL
                WHERE care_category_id NOT IN (SELECT id FROM public.care_categories)
            `);
        }
        
        console.log('Done!');
    } catch(err) {
        console.error('Error:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
