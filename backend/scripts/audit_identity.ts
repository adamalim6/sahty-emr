import { Pool } from 'pg';

async function main() {
    const pool = new Pool({
        host: 'localhost', port: 5432, user: 'sahty',
        password: 'sahty_dev_2026',
        database: 'tenant_ced91ced-fe46-45d1-8ead-b5d51bad5895'
    });
    try {
        const res = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'auth' AND table_name = 'users';
        `);
        console.log("auth.users Columns:");
        console.table(res.rows);

        const res2 = await pool.query(`
            SELECT
                kcu.column_name
            FROM 
                information_schema.table_constraints tco
            JOIN information_schema.key_column_usage kcu 
              ON kcu.constraint_name = tco.constraint_name
              AND kcu.constraint_schema = tco.constraint_schema
            WHERE tco.constraint_type = 'PRIMARY KEY' 
              AND tco.table_schema = 'auth' 
              AND tco.table_name = 'users';
        `);
        console.log("auth.users Primary Key:");
        console.table(res2.rows);

    } finally {
        await pool.end();
    }
}
main();
