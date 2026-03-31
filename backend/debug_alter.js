const { Pool } = require('pg');

async function check() {
  const pPool = new Pool({ connectionString: 'postgresql://sahty:sahty_dev_2026@localhost:5432/tenant_ced91ced-fe46-45d1-8ead-b5d51bad5895' });

  try {
      await pPool.query(`ALTER TABLE public.lab_specimens ADD COLUMN IF NOT EXISTS created_by_user_id UUID`);
      console.log('Altered table successfully');
  } catch(e) { console.error(e) }
  process.exit(0);
}
check();
