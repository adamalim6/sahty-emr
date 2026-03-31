const { Pool } = require('pg');

async function check() {
  const pId = '46c45590-1dcb-4408-916a-b397664847ce';
  const pPool = new Pool({ connectionString: 'postgresql://sahty:sahty_dev_2026@localhost:5432/tenant_ced91ced-fe46-45d1-8ead-b5d51bad5895' });

  try {
      const anchorRes = await pPool.query(`SELECT admission_id, scheduled_at FROM public.prescription_events WHERE id = $1`, [pId]);
      const scheduled_at = anchorRes.rows[0].scheduled_at;
      console.log('JS Date:', scheduled_at);
      
      const res = await pPool.query(`
        SELECT pe.scheduled_at, $2::timestamp as param_time,
               EXTRACT(EPOCH FROM (pe.scheduled_at - $2::timestamp)) as diff
        FROM public.prescription_events pe
        WHERE pe.id = $1
      `, [pId, scheduled_at]);
      
      console.log('DB Diff:', res.rows[0]);
  } catch(e) { console.error(e) }
  process.exit(0);
}
check();
