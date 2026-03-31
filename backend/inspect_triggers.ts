import { Client } from 'pg';

const client = new Client({
  connectionString: 'postgresql://sahty:sahty_dev_2026@localhost:5432/tenant_ced91ced-fe46-45d1-8ead-b5d51bad5895'
});

async function run() {
  try {
      await client.connect();
      const res = await client.query(`
          SELECT tgname, pg_get_triggerdef(oid) as def
          FROM pg_trigger 
          WHERE tgrelid = 'public.prescriptions'::regclass 
             OR tgrelid = 'public.prescription_events'::regclass
             OR tgrelid = 'public.lab_requests'::regclass;
      `);
      res.rows.forEach(r => console.log(r.tgname, '=>', r.def));
  } catch (e) {
      console.error(e);
  } finally {
      await client.end();
  }
}
run();
