import { PrescriptionData } from '../models/prescription';

function parseNumberOrNull(value: any): number | null {
  if (value === null || value === undefined || value === '' || value === '--') return null;

  if (!/^\d+(\.\d+)?$/.test(String(value))) {
    throw new Error(`Invalid numeric value: ${value}`);
  }

  return Number(value);
}

function normalizeEmpty(value: any) {
  return value === '--' || value === '' ? null : value;
}

function parseDateOrNull(value: string | undefined | null) {
  if (!value) return null;

  const d = new Date(value);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }

  return d;
}

function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

export async function mapPayloadToPrescriptionColumns(data: PrescriptionData, client: any, pType: string) {
    let acte_id = normalizeEmpty((data as any).acte_id) || normalizeEmpty((data as any).acteId) || null;
    let libelle_sih = normalizeEmpty((data as any).libelle_sih) || null;

    if (pType !== 'medication') {
        const payloadFields = ['test', 'exam', 'care_act', 'procedure_act', 'product'];
        for (const field of payloadFields) {
            const nested = (data as any)[field];
            if (nested && !acte_id) {
                acte_id = nested[`catalog_${field}_id`] || nested.id || null;
                libelle_sih = libelle_sih || nested.display_name || nested.code || null;
                break;
            }
        }
    }

    let route_id = null;
    let route_label = null;
    let unit_id = null;
    let unit_label = null;

    if (data.route) {
        if (isUUID(data.route)) {
            const routeRes = await client.query(`SELECT id, label FROM reference.routes WHERE id = $1 LIMIT 1`, [data.route]);
            if (routeRes.rows.length > 0) {
                route_id = routeRes.rows[0].id;
                route_label = routeRes.rows[0].label;
            }
        } else {
            const routeRes = await client.query(`SELECT id, label FROM reference.routes WHERE code ILIKE $1 OR label ILIKE $1 LIMIT 1`, [data.route]);
            if (routeRes.rows.length > 0) {
                route_id = routeRes.rows[0].id;
                route_label = routeRes.rows[0].label;
            }
        }
    }

    if (data.unit) {
        let unitQuery = '';
        if (isUUID(data.unit)) {
            unitQuery = `SELECT id, display FROM reference.units WHERE id = $1 LIMIT 1`;
        } else {
            unitQuery = `SELECT id, display FROM reference.units WHERE code = $1 OR display = $1 LIMIT 1`;
        }
        const unitRes = await client.query(unitQuery, [data.unit]);
        if (unitRes.rows.length > 0) {
            unit_id = unitRes.rows[0].id;
            unit_label = unitRes.rows[0].display;
        } else if (!isUUID(data.unit)) {
            unit_label = data.unit;
        }
    }

    let solvent_unit_id = null;
    let solvent_unit_label = null;
    const sUnitTargetId = (data.solvent as any)?.unitId || (data.solvent as any)?.unit_id || (data.solvent?.unit && isUUID(data.solvent.unit) ? data.solvent.unit : null);
    
    if (sUnitTargetId) {
        const sUnitRes = await client.query(`SELECT id, display FROM reference.units WHERE id = $1 LIMIT 1`, [sUnitTargetId]);
        if (sUnitRes.rows.length > 0) {
            solvent_unit_id = sUnitRes.rows[0].id;
            solvent_unit_label = sUnitRes.rows[0].display;
        }
    }

    let admin_duration_mins: number | null = null;
    if (data.adminDuration) {
        const parts = data.adminDuration.split(':');
        if (parts.length === 2) {
            const calculated = (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
            if (calculated > 0) admin_duration_mins = calculated;
        }
    }

    let final_molecule_id = normalizeEmpty(data.moleculeId);
    // If it's a composite drug, the frontend sends a comma-separated list of UUIDs. Postgres expects a single UUID
    if (final_molecule_id && final_molecule_id.includes(',')) {
        final_molecule_id = final_molecule_id.split(',')[0].trim();
    }
    
    const isTransfusion = data.prescriptionType === 'transfusion';
    
    if (isTransfusion) {
        try {
            // Hardcode transfusion unit to 'poche(s)'
            const tUnitRes = await client.query(`SELECT id, display FROM reference.units WHERE code IN ('poche', 'poches') OR display ILIKE '%poche%' LIMIT 1`);
            if (tUnitRes.rows.length > 0) {
                unit_id = tUnitRes.rows[0].id;
                unit_label = tUnitRes.rows[0].display;
            } else {
                console.warn(`[PrescriptionMapper] WARNING: Transfusion unit 'poche(s)' not found in reference.units. Fallback to text label only.`);
                unit_label = 'poche(s)';
            }
        } catch (e) { 
            console.error(`[PrescriptionMapper] ERROR fetching 'poche' unit:`, e);
            unit_label = 'poche(s)';
        }
    }

    const isActeBased = data.prescriptionType ? ['biology', 'imagery', 'care'].includes(data.prescriptionType as string) : false;
    const isMedication = data.prescriptionType === 'medication' || !data.prescriptionType;

    if (isMedication && !final_molecule_id && data.molecule && data.molecule.trim() !== '') {
        try {
            const molRes = await client.query(`SELECT id FROM reference.dcis WHERE name ILIKE $1 LIMIT 1`, [data.molecule.trim()]);
            if (molRes.rows.length > 0) final_molecule_id = molRes.rows[0].id;
        } catch (e) { /* ignore */ }
    }

    let final_product_id = normalizeEmpty(data.productId);
    if (isMedication && !final_product_id && data.commercialName && data.commercialName.trim() !== '') {
        try {
            const prodRes = await client.query(`SELECT id FROM reference.products WHERE name ILIKE $1 LIMIT 1`, [data.commercialName.trim()]);
            if (prodRes.rows.length > 0) final_product_id = prodRes.rows[0].id;
        } catch (e) { /* ignore */ }
    }

    return {
        qty: parseNumberOrNull(normalizeEmpty(data.qty)),
        molecule_id: (isTransfusion || isActeBased) ? null : final_molecule_id,
        molecule_name: (isTransfusion || isActeBased) ? null : normalizeEmpty(data.molecule),
        product_id: (isTransfusion || isActeBased) ? null : final_product_id,
        product_name: (isTransfusion || isActeBased) ? null : normalizeEmpty(data.commercialName),
        acte_id: (isTransfusion || isMedication) ? null : acte_id,
        libelle_sih: (isTransfusion || isMedication) ? null : libelle_sih,
        blood_product_type: normalizeEmpty(data.blood_product_type),
        unit_id,
        unit_label,
        route_id,
        route_label,
        substitutable: typeof data.substitutable === 'boolean' ? data.substitutable : null,
        dilution_required: typeof data.dilutionRequired === 'boolean' ? data.dilutionRequired : null,
        
        solvent_qty: (isTransfusion || isActeBased) ? null : parseNumberOrNull(normalizeEmpty(data.solvent?.qty)),
        solvent_unit_id: (isTransfusion || isActeBased) ? null : solvent_unit_id,
        solvent_unit_label: (isTransfusion || isActeBased) ? null : solvent_unit_label,
        solvent_molecule_id: (isTransfusion || isActeBased) ? null : normalizeEmpty((data.solvent as any)?.moleculeId), 
        solvent_molecule_name: (isTransfusion || isActeBased) ? null : normalizeEmpty(data.solvent?.molecule),
        solvent_product_id: (isTransfusion || isActeBased) ? null : normalizeEmpty((data.solvent as any)?.productId),
        solvent_product_name: (isTransfusion || isActeBased) ? null : normalizeEmpty(data.solvent?.commercialName),
        
        schedule_mode: normalizeEmpty(data.schedule?.mode),
        schedule_type: normalizeEmpty(data.schedule_type),
        interval: parseNumberOrNull(normalizeEmpty(data.schedule?.interval)),
        simple_count: parseNumberOrNull(normalizeEmpty(data.schedule?.simpleCount)),
        duration_unit: normalizeEmpty(data.schedule?.durationUnit),
        duration_value: parseNumberOrNull(normalizeEmpty(data.schedule?.durationValue)),
        simple_period: normalizeEmpty(data.schedule?.simplePeriod),
        daily_schedule: normalizeEmpty(data.schedule?.dailySchedule),
        selected_days: data.schedule?.selectedDays || [],
        specific_times: data.schedule?.specificTimes || [],
        start_datetime: parseDateOrNull(data.schedule?.startDateTime),
        interval_duration: parseNumberOrNull(normalizeEmpty(data.schedule?.intervalDuration)),
        is_custom_interval: typeof data.schedule?.isCustomInterval === 'boolean' ? data.schedule.isCustomInterval : null,
        
        admin_mode: normalizeEmpty(data.adminMode),
        admin_duration_mins,
        
        skipped_events: data.skippedEvents || [],
        manually_adjusted_events: data.manuallyAdjustedEvents || {},

        database_mode: normalizeEmpty(data.databaseMode)
    };
}
