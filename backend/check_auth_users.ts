import { getGlobalPool } from './db/globalPg';

async function check() {
    const globalPool = getGlobalPool();
    const res = await globalPool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'auth' AND table_name = 'users';
    `);
    console.log(res.rows);
    process.exit(0);
}

check();
