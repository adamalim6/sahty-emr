import { getGlobalPool } from '../db/globalPg';

async function run() {
  const globalPool = getGlobalPool();
  try {
    const res = await globalPool.query(`
      SELECT code, label, value_type, unit 
      FROM public.observation_parameters 
      ORDER BY code
    `);
    console.log("=== GLOBAL OBSERVATION PARAMETERS ===");
    res.rows.forEach(r => {
      console.log(`Code: ${r.code.padEnd(20)} | Label: ${r.label?.padEnd(30)} | Type: ${r.value_type?.padEnd(10)} | Unit: ${r.unit || ''}`);
    });
  } catch (e) {
    console.error(e);
  } finally {
    await globalPool.end();
  }
}

run();
