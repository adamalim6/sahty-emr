import { getGlobalPool } from '../db/globalPg';

async function run() {
  const globalPool = getGlobalPool();
  try {
    const res = await globalPool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='observation_parameters';
    `);
    console.log(res.rows);
  } catch (e) {
    console.error(e);
  } finally {
    await globalPool.end();
  }
}

run();
