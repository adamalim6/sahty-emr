import { Pool } from 'pg';

async function run() {
    const adminPool = new Pool({ host:'localhost', port:5432, user:'sahty', password:'sahty_dev_2026', database:'postgres' });
    try {
        const res = await adminPool.query("SELECT * FROM tenants");
        console.log("Global Tenants:", res.rows.map(t => t.id + " | db: " + t.database_name).join("\n"));
        
        const q2 = await adminPool.query("SELECT datname FROM pg_database WHERE NOT datistemplate");
        console.log("All DBs:", q2.rows.map(r => r.datname).join(", "));
        
    } catch (e: any) {
        console.error(e.message);
    } finally {
        await adminPool.end();
        process.exit(0);
    }
}
run();
