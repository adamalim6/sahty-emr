import { globalQuery } from '../db/globalPg';
import { tenantQuery } from '../db/tenantPg';

async function runMigration() {
  console.log('Fetching all tenants...');
  const tenants = await globalQuery('SELECT client_id FROM users WHERE user_type = $1', ['TENANT_SUPERADMIN']);
  
  for (const row of tenants) {
    const tenantId = row.client_id;
    if (!tenantId) continue;
    console.log(`Migrating tenant: ${tenantId}`);
    
    try {
      await tenantQuery(tenantId, `
        ALTER TABLE administration_events
        ADD COLUMN IF NOT EXISTS performed_by_first_name VARCHAR,
        ADD COLUMN IF NOT EXISTS performed_by_last_name VARCHAR;
      `);
      console.log(`Success for tenant ${tenantId}`);
    } catch (e) {
      console.error(`Error migrating tenant ${tenantId}:`, e);
    }
  }
  
  console.log('Done!');
  process.exit(0);
}

runMigration().catch(e => {
    console.error(e);
    process.exit(1);
});
