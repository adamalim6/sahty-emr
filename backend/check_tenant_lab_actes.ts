import { Pool } from 'pg';

const rootPool = new Pool({
  user: 'sahty',
  host: 'localhost',
  database: 'postgres',
  password: 'sahty_dev_2026',
  port: 5432,
});

async function main() {
  try {
    const dbs = await rootPool.query(`SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%' LIMIT 1`);
    const tenantDb = dbs.rows[0]?.datname;
    await rootPool.end();

    if (!tenantDb) {
      console.log("No tenant database found.");
      return;
    }

    console.log("Querying tenant database:", tenantDb);

    const tPool = new Pool({
      user: 'sahty',
      host: 'localhost',
      database: tenantDb,
      password: 'sahty_dev_2026',
      port: 5432,
    });

    const res = await tPool.query(`
      SELECT COUNT(lp.id) as unmapped
      FROM lab_panels lp
      LEFT JOIN lab_panel_items lpi ON lpi.panel_id = lp.id
      WHERE lpi.panel_id IS NULL;
    `);
    console.log("Global Biology Acts without any analyte contexts mapped to them:", res.rows[0].unmapped);
    
    const total = await tPool.query(`SELECT COUNT(*) FROM lab_panels`);
    console.log("Total biology acts (lab_panels) in tenant:", total.rows[0].count);

    await tPool.end();
  } catch (e) {
    console.error(e);
  }
}

main();
