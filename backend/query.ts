const { tenantQuery } = require('./db/tenantPg');
const TENANT_ID = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
async function test() {
  const query = `
    SELECT p.id, p.tenant_patient_id, p.status, p.details, p.created_at,
           CASE WHEN p.stopped_at IS NOT NULL THEN 'STOPPED' 
                WHEN p.paused_at IS NOT NULL THEN 'PAUSED' 
                WHEN NOT EXISTS ( 
                  SELECT 1 FROM public.prescription_events pe 
                  WHERE pe.tenant_id = p.tenant_id AND pe.prescription_id = p.id AND (pe.scheduled_at + (COALESCE(pe.duration, 0) || ' minutes')::interval) > now() 
                ) THEN 'ELAPSED' 
                ELSE 'ACTIVE' END as derived_status 
    FROM public.prescriptions p;
  `;
  try {
    const res = await tenantQuery(TENANT_ID, query);
    console.log(JSON.stringify(res, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
test();
