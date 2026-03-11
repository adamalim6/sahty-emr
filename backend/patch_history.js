const { Pool } = require('pg');
const pool = new Pool({
    user: 'sahty_dev',
    host: 'localhost',
    database: 'sahty_tenant_adamalim6_sahty_emr',
    password: 'demo',
    port: 5432,
});

(async () => {
    try {
        await pool.query(`
            ALTER TABLE patient_addiction_history
            ADD COLUMN IF NOT EXISTS changed_by_first_name TEXT,
            ADD COLUMN IF NOT EXISTS changed_by_last_name TEXT;
        `);
        console.log("History schema patched successfully!");
    } catch(e) {
        console.error("DB ERROR", e);
    } finally {
        pool.end();
    }
})();
