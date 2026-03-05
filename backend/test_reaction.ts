import { Pool } from 'pg';
const pool = new Pool({
  connectionString: 'postgres://sahty:sahty_dev_2026@localhost:5432/tenant_ced91ced-fe46-45d1-8ead-b5d51bad5895'
});

async function run() {
  const query = `
            SELECT 
                p.id as prescription_id,
                (
                    SELECT COALESCE(jsonb_agg(
                        jsonb_build_object(
                            'id', pe.id,
                            'administrations', (
                                SELECT COALESCE(jsonb_agg(
                                    jsonb_build_object(
                                        'id', ae.id,
                                        'action_type', ae.action_type,
                                        'reaction', (
                                            SELECT jsonb_build_object(
                                                'reaction_type', tr.reaction_type,
                                                'severity', tr.severity,
                                                'description', tr.description
                                            ) FROM public.transfusion_reactions tr WHERE tr.administration_event_id = ae.id
                                        )
                                    )
                                    ORDER BY ae.occurred_at ASC
                                ), '[]'::jsonb)
                                FROM public.administration_events ae
                                WHERE ae.prescription_event_id = pe.id
                            )
                        ) 
                    ), '[]'::jsonb)
                    FROM public.prescription_events pe
                    WHERE pe.prescription_id = p.id
                ) as events
            FROM public.prescriptions p
            WHERE p.tenant_patient_id = 'a720c03a-f492-46e6-ae4d-14f639392087'
              AND p.prescription_type = 'transfusion'
            ORDER BY p.created_at DESC
            LIMIT 1;
        `;
  const res = await pool.query(query);
  console.log(JSON.stringify(res.rows, null, 2));
  process.exit(0);
}
run();
