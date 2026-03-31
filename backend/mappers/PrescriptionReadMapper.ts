import { PrescriptionData, ScheduleData, SolventData } from '../models/prescription';

export function assertStructuredRow(row: any) {
  // If a row has been migrated/written with structural data, it MUST have a schedule_mode.
  // If it does not, it means this row was never migrated and trying to map it will corrupt the output.
  if (row.schedule_mode === null && row.prescription_type === 'medication') {
    throw new Error(`Structured mapping incomplete for prescription ${row.id}`);
  }
}

export function mapSchedule(row: any): ScheduleData {
  return {
    mode: row.schedule_mode,
    interval: row.interval !== null ? String(row.interval) : "", // Assuming FormData expects string from types.ts
    simpleCount: row.simple_count !== null ? String(row.simple_count) : "",
    durationUnit: row.duration_unit,
    selectedDays: row.selected_days ?? [],
    simplePeriod: row.simple_period,
    dailySchedule: row.daily_schedule,
    durationValue: row.duration_value !== null ? String(row.duration_value) : "",
    specificTimes: row.specific_times ?? [],
    startDateTime: row.start_datetime ? new Date(row.start_datetime).toISOString() : "",
    intervalDuration: row.interval_duration !== null ? String(row.interval_duration) : "",
    isCustomInterval: row.is_custom_interval === true
  } as ScheduleData;
}

export function mapSolvent(row: any): SolventData {
  return {
    qty: row.solvent_qty !== null ? Number(row.solvent_qty) : null,
    unit: row.solvent_unit_label || null,
    molecule: row.solvent_molecule_name || null,
    commercialName: row.solvent_product_name || null
  } as unknown as SolventData; // Force coercion due to null properties based on strict typing
}

export function mapRowToFormData(row: any): PrescriptionData {
  return {
    molecule: row.molecule_name || null,
    moleculeId: row.molecule_id || null,
    commercialName: row.product_name || null,
    productId: row.product_id || null,
    qty: row.qty !== null ? Number(row.qty) : null,
    unit: row.unit_label || null,
    unit_id: row.unit_id || null,
    blood_product_type: row.blood_product_type || null,
    route: row.route_label || null,
    routeLabel: row.route_label || null, // UI displays routeLabel
    adminMode: row.admin_mode,
    adminDuration: row.admin_duration_mins !== null ? `${Math.floor(row.admin_duration_mins / 60).toString().padStart(2, '0')}:${(row.admin_duration_mins % 60).toString().padStart(2, '0')}` : "00:00", // Format correctly
    schedule_type: row.schedule_type,
    dilutionRequired: row.dilution_required === true,
    solvent: mapSolvent(row),
    databaseMode: row.database_mode || 'hospital',
    schedule: mapSchedule(row),
    conditionComment: row.condition_comment || null,
    substitutable: row.substitutable === true,
    skippedEvents: row.skipped_events ?? [],
    manuallyAdjustedEvents: row.manually_adjusted_events ?? {},
    prescriptionType: row.prescription_type || 'medication',
    libelle_sih: row.libelle_sih || null,
    acte_id: row.acte_id || null
  } as unknown as PrescriptionData;
}
