import { tenantQuery } from './db/tenantPg';
async function test() {
  const TENANT_ID = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
  const resGroups = await tenantQuery(TENANT_ID, `
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'reference' AND table_name = 'observation_groups';
  `);
  console.log("observation_groups Columns:", resGroups);
  
  const resFlowsheets = await tenantQuery(TENANT_ID, `
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'reference' AND table_name = 'observation_flowsheets';
  `);
  console.log("observation_flowsheets Columns:", resFlowsheets);
  process.exit(0);
}
test();
