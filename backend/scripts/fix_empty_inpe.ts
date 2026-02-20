
import { Pool } from 'pg';

async function run() {
    const adminPool = new Pool({ host:'localhost', port:5432, user:'sahty', password:'sahty_dev_2026', database:'postgres' });
    const res = await adminPool.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
    console.log('Tenant DBs:', res.rows.map((r: any) => r.datname));
    
    for (const row of res.rows) {
        const pool = new Pool({ host:'localhost', port:5432, user:'sahty', password:'sahty_dev_2026', database: row.datname });
        try {
            const bad = await pool.query("SELECT user_id, username, inpe FROM auth.users WHERE inpe = ''");
            if (bad.rows.length > 0) {
                console.log(`${row.datname}: Found ${bad.rows.length} users with empty-string INPE:`, bad.rows);
                await pool.query("UPDATE auth.users SET inpe = NULL WHERE inpe = ''");
                console.log(`${row.datname}: Fixed.`);
            } else {
                console.log(`${row.datname}: OK (no empty-string INPE)`);
            }
        } finally {
            await pool.end();
        }
    }
    await adminPool.end();
    process.exit(0);
}
run();
