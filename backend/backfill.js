const { Pool } = require('pg');

const mainPool = new Pool({
    user: 'sahty',
    host: 'localhost',
    database: 'sahty_global',
    password: 'sahty_dev_2026',
    port: 5432,
});

const tenantPool = new Pool({
    user: 'sahty',
    host: 'localhost',
    database: 'tenant_ced91ced-fe46-45d1-8ead-b5d51bad5895',
    password: 'sahty_dev_2026',
    port: 5432,
});

(async () => {
    try {
        const users = await mainPool.query('SELECT id, prenom, nom FROM users');
        const userMap = {};
        users.rows.forEach(u => userMap[u.id] = u);

        const history = await tenantPool.query('SELECT id, changed_by FROM patient_addiction_history WHERE changed_by_first_name IS NULL');
        
        console.log(`Found ${history.rowCount} rows to backfill.`);

        for (const row of history.rows) {
            const user = userMap[row.changed_by];
            if (user) {
                await tenantPool.query(
                    'UPDATE patient_addiction_history SET changed_by_first_name = $1, changed_by_last_name = $2 WHERE id = $3',
                    [user.prenom, user.nom, row.id]
                );
            }
        }
        console.log('Backfill complete!');
    } catch(e) {
        console.error('Error:', e.message);
    } finally {
        mainPool.end();
        tenantPool.end();
    }
})();
