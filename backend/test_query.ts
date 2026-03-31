import { Pool } from 'pg';

async function run() {
    const globalPool = new Pool({ connectionString: 'postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global' });
    const res = await globalPool.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
    const tenantDatabases = res.rows.map(row => row.datname);
    await globalPool.end();

    const targetDb = tenantDatabases[0];
    console.log("Testing on", targetDb);
    const tPool = new Pool({ connectionString: `postgresql://sahty:sahty_dev_2026@localhost:5432/${targetDb}` });

    try {
        const nfsq = await tPool.query(`SELECT id FROM reference.global_actes WHERE libelle_sih ILIKE '%Ac Anti-Acide glutamique%'`);
        if (nfsq.rows.length === 0) return;
        const actId = nfsq.rows[0].id;
        
        console.log("ACT ID:", actId);
        
        const q1 = await tPool.query(`SELECT * FROM reference.lab_act_specimen_types WHERE global_act_id = $1`, [actId]);
        console.log("Raw mapping rows:", q1.rows);

        if (q1.rows.length > 0) {
            const specId = q1.rows[0].specimen_type_id;
            const q2 = await tPool.query(`SELECT * FROM reference.lab_specimen_types WHERE id = $1`, [specId]);
            console.log("Referenced specimen in tenant DB:", q2.rows);
        }
    } finally {
        await tPool.end();
    }
}
run();
