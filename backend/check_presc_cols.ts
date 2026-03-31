import { Pool } from 'pg';

const tenantPool = new Pool({ connectionString: `postgresql://sahty:sahty_dev_2026@localhost:5432/tenant_ced91ced-fe46-45d1-8ead-b5d51bad5895` });

async function verify() {
    const res = await tenantPool.query(`
        SELECT column_name 
        FROM information_schema.columns
        WHERE table_name = 'prescriptions'
        AND column_name IN (
            'qty', 'molecule_id', 'molecule_name', 'product_id', 'product_name',
            'acte_id', 'libelle_sih', 'blood_product_type', 'unit_id', 'unit_label',
            'route_id', 'route_label', 'substitutable', 'dilution_required',
            'solvent_qty', 'solvent_unit_id', 'solvent_unit_label', 'solvent_molecule_id',
            'solvent_molecule_name', 'solvent_product_id', 'solvent_product_name',
            'schedule_mode', 'schedule_type', 'interval', 'simple_count', 'duration_unit',
            'duration_value', 'simple_period', 'daily_schedule', 'selected_days',
            'specific_times', 'start_datetime', 'interval_duration', 'is_custom_interval',
            'admin_mode', 'admin_duration_mins', 'skipped_events', 'manually_adjusted_events'
        )
    `);
    
    console.log("Newly added columns in 'prescriptions':");
    console.table(res.rows.map(r => r.column_name));
    console.log(`\nTotal verified: ${res.rowCount}`);
    
    await tenantPool.end();
}

verify().catch(console.error);
