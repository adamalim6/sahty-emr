const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://sahty:sahty@localhost:5432/tenant_ced91ced-fe46-45d1-8ead-b5d51bad5895'
});
pool.query('SELECT p.id, p.tenant_patient_id, p.status, p.details, p.admission_id, p.created_at, \n' +
  '  CASE WHEN p.stopped_at IS NOT NULL THEN \'STOPPED\' ' +
  '       WHEN p.paused_at IS NOT NULL THEN \'PAUSED\' ' +
  '       WHEN NOT EXISTS ( ' +
  '         SELECT 1 FROM public.prescription_events pe ' +
  '         WHERE pe.tenant_id = p.tenant_id AND pe.prescription_id = p.id AND (pe.scheduled_at + (pe.duration || \' minutes\')::interval) > now() ' +
  '       ) THEN \'ELAPSED\' ' +
  '       ELSE \'ACTIVE\' END as derived_status ' +
  'FROM public.prescriptions p').then(res => {
  console.log(JSON.stringify(res.rows, null, 2));
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
