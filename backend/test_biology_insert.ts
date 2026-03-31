import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://sahty:sahty_dev_2026@localhost:5432/tenant_ced91ced-fe46-45d1-8ead-b5d51bad5895'
});

async function run() {
  try {
      // Find a valid patient
      const pRes = await pool.query('SELECT tenant_patient_id as id, tenant_id FROM prescriptions LIMIT 1');
      if (pRes.rows.length === 0) return console.log("No patient found");
      const { id: patientId, tenant_id: tenantId } = pRes.rows[0];
      
      const queryPrescription = `
          INSERT INTO prescriptions (
              tenant_id, tenant_patient_id, admission_id, 
              prescription_type, condition_comment, status, 
              created_by, created_by_first_name, created_by_last_name,
              requires_fluid_info,
              qty, molecule_id, molecule_name, product_id, product_name,
              acte_id, libelle_sih, blood_product_type,
              unit_id, unit_label, route_label,
              substitutable, dilution_required,
              solvent_qty, solvent_unit_label, solvent_molecule_name, solvent_product_name,
              schedule_mode, schedule_type, interval, simple_count, duration_unit, duration_value, simple_period, daily_schedule,
              selected_days, specific_times, start_datetime, interval_duration, is_custom_interval,
              admin_mode, admin_duration_mins, skipped_events, manually_adjusted_events, database_mode
          ) 
          VALUES (
              $1, $2, $3, 
              $4, $5, 'ACTIVE', 
              $6, $7, $8, 
              $9,
              $10, $11, $12, $13, $14,
              $15, $16, $17,
              $18, $19, $20,
              $21, $22,
              $23, $24, $25, $26,
              $27, $28, $29, $30, $31, $32, $33, $34,
              $35, $36, $37, $38, $39,
              $40, $41, $42, $43, $44
          )
          RETURNING id, created_at
      `;

      await pool.query(queryPrescription, [
          tenantId, patientId, null,
          'biology', null,
          '00000000-0000-0000-0000-000000000001', 'First', 'Last',
          false,
          
          null, null, null, null, null,
          '75b1be48-a7bd-4438-8458-71de948b4b8a', 'Test Act', null,
          null, null, null,
          true, false,
          
          null, null, null, null,
          null, 'one-time', null, null, null, null, null, null,
          '[]', '[]', new Date(), null, false,
          'bolus', null, '[]', '{}', 'universal'
      ]);

      console.log("INSERT SUCCESSFUL");
  } catch (e: any) {
      console.error("INSERT FAILED:");
      console.error(e.message);
      console.error(e.detail);
      console.error(e.hint);
      console.error(e.column);
  } finally {
      await pool.end();
  }
}
run();
