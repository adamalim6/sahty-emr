const { Pool } = require('pg');

async function check() {
  const pId = '46c45590-1dcb-4408-916a-b397664847ce';
  const pPool = new Pool({ connectionString: 'postgresql://sahty:sahty_dev_2026@localhost:5432/tenant_ced91ced-fe46-45d1-8ead-b5d51bad5895' });

  try {
      const anchorRes = await pPool.query(`SELECT admission_id, scheduled_at FROM public.prescription_events WHERE id = $1`, [pId]);
      console.log('Anchor:', anchorRes.rows[0]);
      
      if (anchorRes.rows[0]) {
          const q = `
            SELECT lr.id, pe.status as pe_status, lr.admission_id as lr_adm, pe.admission_id as pe_adm
            FROM public.lab_requests lr
            JOIN public.prescription_events pe ON pe.id = lr.prescription_event_id
            WHERE pe.id = $1
          `;
          const res = await pPool.query(q, [pId]);
          console.log('Matches lr directly:', res.rows);
          
          if (res.rows.length > 0) {
              const limsServiceJoinCheck = await pPool.query(`
                SELECT COUNT(*) as join_count
                FROM public.lab_requests lr
                    JOIN reference.lab_act_specimen_containers lasc 
                         ON lasc.global_act_id = lr.global_act_id AND lasc.actif = true
                WHERE lr.id = $1
              `, [res.rows[0].id]);
              console.log('Inner Join Specimen Count:', limsServiceJoinCheck.rows[0]);
          }
      }
  } catch (err) {
      console.error(err);
  } finally {
      await pPool.end();
  }
}
check();
