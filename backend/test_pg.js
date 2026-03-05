const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://sahty:sahty_dev_2026@localhost:5432/tenant_ced91ced-fe46-45d1-8ead-b5d51bad5895'
});

async function run() {
  try {
    const res = await pool.query(`
      SELECT jsonb_build_object(
        'id', ae.id,
        'action_type', ae.action_type,
        'reaction', (
            SELECT jsonb_build_object(
                'reaction_type', tr.reaction_type,
                'description', tr.description
            ) FROM public.transfusion_reactions tr WHERE tr.administration_event_id = ae.id
        )
      ) as evt
      FROM public.administration_events ae
      WHERE ae.tenant_id = 'ced91ced-fe46-45d1-8ead-b5d51bad5895'
      ORDER BY ae.created_at DESC
      LIMIT 10;
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}
run();
