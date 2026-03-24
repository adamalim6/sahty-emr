import { Pool } from 'pg';
import { syncTenantReference } from './referenceSync';

async function run() {
  const pool = new Pool({ connectionString: 'postgresql://sahty:sahty_dev_2026@localhost:5432/tenant_00000000-0000-4000-a000-000000000001' });
  const client = await pool.connect();
  try {
      await syncTenantReference(client, '00000000-0000-4000-a000-000000000001');
      console.log('Finished without throwing!');
  } catch(e) {
      console.error("Caught error:", e);
  } finally {
      client.release();
      await pool.end();
  }
}
run();
