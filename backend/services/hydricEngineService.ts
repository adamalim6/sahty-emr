import { PoolClient } from 'pg';
import { getTenantPool } from '../db/tenantPg';

export class HydricEngineService {
    
    /**
     * Recomputes HYDRIC_INPUT, HYDRIC_OUTPUT, and HYDRIC_BALANCE for the given time window
     * and UPSERTs them into surveillance_values_events.
     */
    async recalculateBuckets(tenantId: string, tenantPatientId: string, startIso: string, endIso: string, client?: PoolClient) {
        const pool = getTenantPool(tenantId);
        const db = client || await pool.connect();
        
        try {
            if (!client) await db.query('BEGIN');
            
            const userRes = await db.query(`SELECT user_id FROM auth.users ORDER BY created_at ASC LIMIT 1`);
            const fallbackUserId = userRes.rows[0]?.user_id;

            // 1. Fetch Parameter IDs for the calculated hydric parameters
            const paramsRes = await db.query(`
                SELECT id, code FROM reference.observation_parameters 
                WHERE code IN ('HYDRIC_INPUT', 'HYDRIC_OUTPUT', 'HYDRIC_BALANCE')
            `);
            const paramMap = paramsRes.rows.reduce((acc, row) => ({ ...acc, [row.code]: row.id }), {} as Record<string, string>);
            if (!paramMap['HYDRIC_INPUT'] || !paramMap['HYDRIC_OUTPUT'] || !paramMap['HYDRIC_BALANCE']) {
                console.warn("[HydricEngine] Calculated hydric parameters not found. Skipping engine execution.");
                if (!client) await db.query('COMMIT');
                return;
            }
            console.log("[HydricEngine] Starting recalculateBuckets for patient:", tenantPatientId, "from", startIso, "to", endIso);

            // 2. Determine Continuous Bucket Range to perfectly cover startIso to endIso
            const minDate = new Date(startIso);
            minDate.setMinutes(0, 0, 0);
            
            const maxDate = new Date(endIso);
            maxDate.setMinutes(0, 0, 0);
            
            // We initialize a map of buckets to safely accumulate prorated volumes and sums
            const buckets: Record<string, { in: number; out: number }> = {};
            const d = new Date(minDate);
            while (d <= maxDate) {
                buckets[d.toISOString()] = { in: 0, out: 0 };
                d.setHours(d.getHours() + 1);
            }

            const minIso = minDate.toISOString();
            const maxDateEnd = new Date(maxDate);
            maxDateEnd.setMinutes(59, 59, 999);
            const maxIso = maxDateEnd.toISOString();

            // 3. Purge existing calculated engine rows in this window.
            // The existing postgres trigger `trg_surveillance_event_bucket` fires AFTER DELETE, 
            // automatically clearing these values out of the `surveillance_hour_buckets` JSON.
            await db.query(`
                DELETE FROM surveillance_values_events
                WHERE tenant_patient_id = $1
                  AND parameter_code IN ('HYDRIC_INPUT', 'HYDRIC_OUTPUT', 'HYDRIC_BALANCE')
                  AND bucket_start >= $2::timestamptz AND bucket_start <= $3::timestamptz
            `, [tenantPatientId, minIso, maxDate.toISOString()]); 
            
            // Explicitly strip these keys from the JSONB cache, since the trigger is AFTER INSERT only!
            await db.query(`
                UPDATE surveillance_hour_buckets
                SET values = values - 'HYDRIC_INPUT' - 'HYDRIC_OUTPUT' - 'HYDRIC_BALANCE'
                WHERE tenant_patient_id = $1
                  AND bucket_start >= $2::timestamptz AND bucket_start <= $3::timestamptz
            `, [tenantPatientId, minIso, maxDate.toISOString()]);

            // 4. Fetch Manual Hydric Inputs & Outputs
            // Safely filtering using source = 'manual' to prevent recursive recalculations
            const manualRes = await db.query(`
                WITH latest_events AS (
                    SELECT DISTINCT ON (e.parameter_id, e.bucket_start) 
                        e.bucket_start, 
                        e.value_numeric, 
                        p.is_hydric_input, 
                        p.is_hydric_output
                    FROM surveillance_values_events e
                    JOIN reference.observation_parameters p ON e.parameter_id = p.id
                    WHERE e.tenant_patient_id = $1
                      AND e.bucket_start >= $2::timestamptz AND e.bucket_start <= $3::timestamptz
                      AND p.source = 'manual'
                      AND (p.is_hydric_input = true OR p.is_hydric_output = true)
                    ORDER BY e.parameter_id, e.bucket_start, e.recorded_at DESC
                )
                SELECT * FROM latest_events
                WHERE value_numeric IS NOT NULL
            `, [tenantPatientId, minIso, maxDate.toISOString()]);

            console.log("[HydricEngine] Found manual entries:", manualRes.rows.length);

            for (const row of manualRes.rows) {
                const bIso = new Date(row.bucket_start).toISOString();
                if (!buckets[bIso]) buckets[bIso] = { in: 0, out: 0 };
                if (row.is_hydric_input) buckets[bIso].in += Number(row.value_numeric);
                if (row.is_hydric_output) buckets[bIso].out += Number(row.value_numeric);
            }

            // 5. Fetch Transfusions (Pro-rating across START and END events)
            const transRes = await db.query(`
                SELECT 
                    s.actual_start_at as t_start, 
                    COALESCE(e.actual_end_at, s.actual_end_at, s.actual_start_at) as t_end, 
                    b.volume_administered_ml
                FROM administration_event_blood_bags b
                JOIN administration_events s ON b.administration_event_id = s.id AND s.action_type = 'started'
                LEFT JOIN administration_events e ON s.linked_event_id = e.linked_event_id AND e.action_type = 'ended' AND e.status != 'CANCELLED'
                JOIN prescription_events pe ON s.prescription_event_id = pe.id
                JOIN prescriptions p ON pe.prescription_id = p.id
                WHERE p.tenant_patient_id = $1
                  AND s.status != 'CANCELLED'
                  AND s.actual_start_at <= $3::timestamptz
                  AND COALESCE(e.actual_end_at, s.actual_end_at, s.actual_start_at) >= $2::timestamptz
            `, [tenantPatientId, minIso, maxIso]);

            console.log("[HydricEngine] Found transfusions:", transRes.rows.length);

            for (const row of transRes.rows) {
                const tStart = new Date(row.t_start).getTime();
                const tEnd = Math.max(new Date(row.t_end).getTime(), tStart);
                const vol = Number(row.volume_administered_ml);

                if (tStart === tEnd) {
                    const t = new Date(tStart);
                    t.setUTCMinutes(0, 0, 0);
                    const bIso = t.toISOString();
                    if (!buckets[bIso]) buckets[bIso] = { in: 0, out: 0 };
                    buckets[bIso].in += vol;
                } else {
                    const dur = tEnd - tStart;
                    const bStartIter = new Date(tStart);
                    bStartIter.setUTCMinutes(0, 0, 0);
                    while (bStartIter.getTime() < tEnd) {
                        const bIso = bStartIter.toISOString();
                        if (!buckets[bIso]) buckets[bIso] = { in: 0, out: 0 };
                        
                        const bStartMs = bStartIter.getTime();
                        const bEndMs = bStartMs + 60 * 60 * 1000;
                        
                        const oStart = Math.max(tStart, bStartMs);
                        const oEnd = Math.min(tEnd, bEndMs);
                        
                        if (oStart < oEnd) {
                            const pVol = vol * ((oEnd - oStart) / dur);
                            buckets[bIso].in += pVol;
                        }
                        
                        bStartIter.setTime(bStartIter.getTime() + 60 * 60 * 1000);
                    }
                }
            }

            // 6. Fetch Medications (Bolus & Perfusion Pro-rating safely deduplicated by linked_event_id group)
            const medsRes = await db.query(`
                WITH valid_meds AS (
                    SELECT 
                        m.linked_event_id,
                        m.id as event_id,
                        m.volume_administered_ml,
                        m.actual_start_at,
                        m.actual_end_at,
                        m.occurred_at,
                        m.action_type,
                        pe.requires_fluid_info,
                        p.tenant_patient_id,
                        ROW_NUMBER() OVER(PARTITION BY COALESCE(m.linked_event_id, m.id) ORDER BY CASE WHEN m.action_type = 'ended' THEN 1 WHEN m.action_type = 'started' THEN 2 ELSE 3 END) as rn
                    FROM administration_events m
                    JOIN prescription_events pe ON m.prescription_event_id = pe.id
                    JOIN prescriptions p ON pe.prescription_id = p.id
                    WHERE p.tenant_patient_id = $1
                      AND m.status != 'CANCELLED'
                      AND pe.requires_fluid_info = true
                      AND m.volume_administered_ml IS NOT NULL
                )
                SELECT 
                    v.event_id,
                    COALESCE(s.actual_start_at, v.actual_start_at, v.occurred_at) as t_start,
                    COALESCE(e.actual_end_at, v.actual_end_at, v.actual_start_at, v.occurred_at) as t_end,
                    v.volume_administered_ml
                FROM valid_meds v
                LEFT JOIN administration_events s ON (s.id = v.linked_event_id OR s.linked_event_id = v.linked_event_id) AND s.action_type = 'started' AND s.status != 'CANCELLED'
                LEFT JOIN administration_events e ON (e.id = COALESCE(v.linked_event_id, v.event_id) OR e.linked_event_id = COALESCE(v.linked_event_id, v.event_id)) AND e.action_type = 'ended' AND e.status != 'CANCELLED'
                WHERE v.rn = 1
                  AND COALESCE(s.actual_start_at, v.actual_start_at, v.occurred_at) <= $3::timestamptz
                  AND COALESCE(e.actual_end_at, v.actual_end_at, v.actual_start_at, v.occurred_at) >= $2::timestamptz
            `, [tenantPatientId, minIso, maxIso]);

            console.log("[HydricEngine] Found medications with requires_fluid_info:", medsRes.rows.length);

            for (const row of medsRes.rows) {
                const tStart = new Date(row.t_start).getTime();
                const tEnd = Math.max(new Date(row.t_end).getTime(), tStart);
                const vol = Number(row.volume_administered_ml);

                if (tStart === tEnd) {
                    const t = new Date(tStart);
                    t.setUTCMinutes(0, 0, 0);
                    const bIso = t.toISOString();
                    if (!buckets[bIso]) buckets[bIso] = { in: 0, out: 0 };
                    buckets[bIso].in += vol;
                } else {
                    const dur = tEnd - tStart;
                    const bStartIter = new Date(tStart);
                    bStartIter.setUTCMinutes(0, 0, 0);
                    while (bStartIter.getTime() < tEnd) {
                        const bIso = bStartIter.toISOString();
                        if (!buckets[bIso]) buckets[bIso] = { in: 0, out: 0 };
                        
                        const bStartMs = bStartIter.getTime();
                        const bEndMs = bStartMs + 60 * 60 * 1000;
                        
                        const oStart = Math.max(tStart, bStartMs);
                        const oEnd = Math.min(tEnd, bEndMs);
                        
                        if (oStart < oEnd) {
                            const pVol = vol * ((oEnd - oStart) / dur);
                            buckets[bIso].in += pVol;
                        }
                        
                        bStartIter.setTime(bStartIter.getTime() + 60 * 60 * 1000);
                    }
                }
            }

            // 7. Re-Insert calculated base entries inside the transaction
            const values: any[] = [];
            let argCount = 1;
            const insertChunks: string[] = [];
            
            console.log("[HydricEngine] Processed buckets:", JSON.stringify(buckets, null, 2));

            for (const [bIso, totals] of Object.entries(buckets)) {
                const inVol = Math.round(totals.in * 100) / 100;
                const outVol = Math.round(totals.out * 100) / 100;
                const balVol = Math.round((inVol - outVol) * 100) / 100;

                // We must insert zeroes to authoritatively state the result of the recalculation.
                // This guarantees UI cells show '0' rather than being visually blanked out
                const addRow = (paramId: string, paramCode: string, val: number) => {
                    insertChunks.push(`($${argCount}, $${argCount+1}, $${argCount+2}, $${argCount+3}, $${argCount+4}, $${argCount+5}, $${argCount+6})`);
                    values.push(tenantId, tenantPatientId, paramId, paramCode, bIso, val, fallbackUserId);
                    argCount += 7;
                };

                addRow(paramMap['HYDRIC_INPUT'], 'HYDRIC_INPUT', inVol);
                addRow(paramMap['HYDRIC_OUTPUT'], 'HYDRIC_OUTPUT', outVol);
                addRow(paramMap['HYDRIC_BALANCE'], 'HYDRIC_BALANCE', balVol);
            }

            console.log("[HydricEngine] Insert chunks count:", insertChunks.length);
            if (insertChunks.length > 0) {
                // The postgres trigger `trg_surveillance_event_bucket` fires AFTER INSERT,
                // securely re-aggregating the fresh calculations into the JSON bucket.
                const query = `
                    INSERT INTO surveillance_values_events (
                        tenant_id, tenant_patient_id, parameter_id, parameter_code, bucket_start, value_numeric, recorded_by
                    ) VALUES ${insertChunks.join(', ')}
                `;
                console.log("[HydricEngine] Running INSERT with args:", values);
                await db.query(query, values);
                console.log("[HydricEngine] INSERT successful");
            }

            if (!client) await db.query('COMMIT');
        } catch (e) {
            if (!client) await db.query('ROLLBACK');
            throw e;
        } finally {
            if (!client) db.release();
        }
    }

    /**
     * Fully rebuilds all hydric buckets dynamically for a patient by evaluating their entire chronological history.
     */
    async rebuildHydricBucketsForPatient(tenantId: string, tenantPatientId: string, client?: PoolClient) {
        const pool = getTenantPool(tenantId);
        const db = client || await pool.connect();
        
        try {
            // Find absolute timeframe utilizing pre-existing bucket bounds and actual administration dates
            const rangeRes = await db.query(`
                SELECT 
                    (SELECT MIN(bucket_start) FROM surveillance_hour_buckets WHERE tenant_patient_id = $1) as bucket_min,
                    (SELECT MAX(bucket_start) FROM surveillance_hour_buckets WHERE tenant_patient_id = $1) as bucket_max,
                    (
                        SELECT MIN(COALESCE(ae.actual_start_at, ae.occurred_at)) 
                        FROM administration_events ae 
                        JOIN prescription_events pe ON ae.prescription_event_id = pe.id 
                        JOIN prescriptions p ON pe.prescription_id = p.id 
                        WHERE p.tenant_patient_id = $1 AND ae.status != 'CANCELLED'
                    ) as admin_min,
                    (
                        SELECT MAX(COALESCE(ae.actual_end_at, ae.actual_start_at, ae.occurred_at)) 
                        FROM administration_events ae 
                        JOIN prescription_events pe ON ae.prescription_event_id = pe.id 
                        JOIN prescriptions p ON pe.prescription_id = p.id 
                        WHERE p.tenant_patient_id = $1 AND ae.status != 'CANCELLED'
                    ) as admin_max
            `, [tenantPatientId]);

            const row = rangeRes.rows[0];
            const bounds = [];
            if (row?.bucket_min) bounds.push(new Date(row.bucket_min).getTime());
            if (row?.bucket_max) bounds.push(new Date(row.bucket_max).getTime());
            if (row?.admin_min) bounds.push(new Date(row.admin_min).getTime());
            if (row?.admin_max) bounds.push(new Date(row.admin_max).getTime());

            if (bounds.length === 0) return;

            const minIso = new Date(Math.min(...bounds)).toISOString();
            const maxIso = new Date(Math.max(...bounds)).toISOString();

            await this.recalculateBuckets(tenantId, tenantPatientId, minIso, maxIso, db);
        } finally {
            if (!client) db.release();
        }
    }
}

export const hydricEngineService = new HydricEngineService();
