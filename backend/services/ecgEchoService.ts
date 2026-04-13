import { tenantQuery } from '../db/tenantPg';

// ─── Helpers ────────────────────────────────────────────────────────────────

function toNullableInt(v: any): number | null {
    if (v === '' || v === null || v === undefined) return null;
    const n = parseInt(v);
    return isNaN(n) ? null : n;
}

function toNullableFloat(v: any): number | null {
    if (v === '' || v === null || v === undefined) return null;
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
}

// ─── ECG ─────────────────────────────────────────────────────────────────────

export async function getECGsByPatient(tenantId: string, patientId: string) {
    return tenantQuery(tenantId, `
        SELECT e.*,
               po.body_html  AS conclusion_html,
               po.body_plain AS conclusion_plain
        FROM   patient_ecg_records e
        LEFT JOIN patient_observations po ON po.id = e.conclusion_observation_id
        WHERE  e.tenant_patient_id = $1
          AND  e.status != 'ENTERED_IN_ERROR'
        ORDER  BY e.exam_date DESC, e.exam_time DESC
    `, [patientId]);
}

export async function createECG(
    tenantId: string, patientId: string, data: any,
    userId: string | null, conclusionHtml: string, conclusionPlain: string
) {
    const isDraft = data.status === 'DRAFT';

    const obsSignedAt = isDraft ? null : new Date();
    const obsSignedBy = isDraft ? null : userId;
    const obsRows = await tenantQuery(tenantId, `
        INSERT INTO patient_observations
            (tenant_patient_id, note_type, privacy_level, author_role,
             status, declared_time, body_html, body_plain, created_by,
             author_first_name, author_last_name,
             signed_at, signed_by)
        VALUES ($1, 'INTERP_ECG', 'NORMAL', 'DOCTOR', $7,
                NOW(), $2, $3, $4, $5, $6,
                $8, $9)
        RETURNING id
    `, [patientId, conclusionHtml, conclusionPlain,
        userId, data.creatorFirstName ?? '', data.creatorLastName ?? '',
        isDraft ? 'DRAFT' : 'SIGNED', obsSignedAt, obsSignedBy]);

    const obsId = obsRows[0].id;

    const rows = await tenantQuery(tenantId, `
        INSERT INTO patient_ecg_records (
            tenant_id, tenant_patient_id,
            exam_date, exam_time, exam_type, position, speed_mm_s, quality,
            rhythm, regularity, p_wave,
            rhythm_disorders, conduction_disorders,
            repolarization, repolarization_details,
            ischemia, ischemia_type, ischemia_locations,
            fc_bpm, pr_ms, qrs_ms, qt_ms, qtc_ms,
            axis_p_deg, axis_qrs_deg, axis_t_deg,
            other_anomalies, conclusion_observation_id,
            doctor, has_attachment, created_by, status,
            created_by_first_name, created_by_last_name
        ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,
            $9,$10,$11,$12,$13,$14,$15,
            $16,$17,$18,
            $19,$20,$21,$22,$23,$24,$25,$26,
            $27,$28,$29,$30,$31,$32,
            $33,$34
        ) RETURNING *
    `, [
        tenantId, patientId,
        data.date, data.time,
        data.type, data.position, parseInt(data.speed) || 25, data.quality,
        data.rhythm, data.regularity, data.pWave,
        data.rhythmDisorders, data.conductionDisorders,
        data.repolarization, data.repolarizationDetails,
        data.ischemia, data.ischemiaType ?? null, data.ischemiaLoc,
        toNullableInt(data.fc), toNullableInt(data.pr),
        toNullableInt(data.qrs), toNullableInt(data.qt), toNullableInt(data.qtc),
        toNullableInt(data.axisP), toNullableInt(data.axisQRS), toNullableInt(data.axisT),
        data.otherAnomalies || null, obsId,
        data.doctor || null, data.hasAttachment ?? false,
        userId, isDraft ? 'DRAFT' : 'VALIDATED',
        data.creatorFirstName ?? null, data.creatorLastName ?? null
    ]);

    return { ...rows[0], conclusion_html: conclusionHtml };
}

export async function updateECG(
    tenantId: string, ecgId: string, data: any,
    conclusionHtml: string, conclusionPlain: string,
    userId?: string | null
) {
    const isDraft = data.status === 'DRAFT';
    const obsStatus = isDraft ? 'DRAFT' : 'SIGNED';

    // Update the linked observation body + status
    // When transitioning to SIGNED, set signed_at/signed_by only if not already set
    await tenantQuery(tenantId, `
        UPDATE patient_observations
        SET    body_html = $1, body_plain = $2, updated_at = NOW(),
               status = $5,
               signed_at = CASE WHEN $5::text = 'SIGNED' AND signed_at IS NULL THEN NOW() ELSE signed_at END,
               signed_by = CASE WHEN $5::text = 'SIGNED' AND signed_by IS NULL THEN $6::uuid ELSE signed_by END
        WHERE  id = (SELECT conclusion_observation_id FROM patient_ecg_records WHERE id = $3 AND tenant_id = $4)
    `, [conclusionHtml, conclusionPlain, ecgId, tenantId, obsStatus, userId ?? null]);

    const rows = await tenantQuery(tenantId, `
        UPDATE patient_ecg_records SET
            exam_date=$1, exam_time=$2, exam_type=$3, position=$4, speed_mm_s=$5, quality=$6,
            rhythm=$7, regularity=$8, p_wave=$9,
            rhythm_disorders=$10, conduction_disorders=$11,
            repolarization=$12, repolarization_details=$13,
            ischemia=$14, ischemia_type=$15, ischemia_locations=$16,
            fc_bpm=$17, pr_ms=$18, qrs_ms=$19, qt_ms=$20, qtc_ms=$21,
            axis_p_deg=$22, axis_qrs_deg=$23, axis_t_deg=$24,
            other_anomalies=$25, doctor=$26, has_attachment=$27,
            status=$28,
            updated_at=NOW()
        WHERE id=$29 AND tenant_id=$30
        RETURNING *
    `, [
        data.date, data.time, data.type, data.position, parseInt(data.speed) || 25, data.quality,
        data.rhythm, data.regularity, data.pWave,
        data.rhythmDisorders, data.conductionDisorders,
        data.repolarization, data.repolarizationDetails,
        data.ischemia, data.ischemiaType ?? null, data.ischemiaLoc,
        toNullableInt(data.fc), toNullableInt(data.pr),
        toNullableInt(data.qrs), toNullableInt(data.qt), toNullableInt(data.qtc),
        toNullableInt(data.axisP), toNullableInt(data.axisQRS), toNullableInt(data.axisT),
        data.otherAnomalies || null, data.doctor || null, data.hasAttachment ?? false,
        isDraft ? 'DRAFT' : 'VALIDATED',
        ecgId, tenantId
    ]);

    return { ...rows[0], conclusion_html: conclusionHtml };
}

export async function deleteECG(tenantId: string, ecgId: string) {
    await tenantQuery(tenantId, `
        DELETE FROM patient_observations
        WHERE id = (SELECT conclusion_observation_id FROM patient_ecg_records WHERE id = $1 AND tenant_id = $2)
    `, [ecgId, tenantId]);
    await tenantQuery(tenantId, `DELETE FROM patient_ecg_records WHERE id=$1 AND tenant_id=$2`, [ecgId, tenantId]);
}

export async function enterECGInError(tenantId: string, ecgId: string, userId: string | null, reason?: string) {
    await tenantQuery(tenantId, `
        UPDATE patient_ecg_records
        SET    status = 'ENTERED_IN_ERROR',
               entered_in_error_by = $1,
               entered_in_error_at = NOW(),
               entered_in_error_reason = $2,
               updated_at = NOW()
        WHERE  id = $3 AND tenant_id = $4
    `, [userId, reason ?? null, ecgId, tenantId]);

    // Also mark the linked observation as entered_in_error
    await tenantQuery(tenantId, `
        UPDATE patient_observations
        SET    status = 'ENTERED_IN_ERROR',
               entered_in_error_by = $1,
               entered_in_error_at = NOW(),
               entered_in_error_reason = $2
        WHERE  id = (SELECT conclusion_observation_id FROM patient_ecg_records WHERE id = $3 AND tenant_id = $4)
    `, [userId, reason ?? null, ecgId, tenantId]);
}

// ─── Echo ─────────────────────────────────────────────────────────────────────

export async function getEchosByPatient(tenantId: string, patientId: string) {
    return tenantQuery(tenantId, `
        SELECT e.*,
               po.body_html  AS conclusion_html,
               po.body_plain AS conclusion_plain
        FROM   patient_echo_records e
        LEFT JOIN patient_observations po ON po.id = e.conclusion_observation_id
        WHERE  e.tenant_patient_id = $1
          AND  e.status != 'ENTERED_IN_ERROR'
        ORDER  BY e.exam_date DESC, e.exam_time DESC
    `, [patientId]);
}

export async function createEcho(
    tenantId: string, patientId: string, data: any,
    userId: string | null, conclusionHtml: string, conclusionPlain: string
) {
    const isDraft = data.status === 'DRAFT';
    const v = data.valves || {};

    const obsSignedAt = isDraft ? null : new Date();
    const obsSignedBy = isDraft ? null : userId;
    const obsRows = await tenantQuery(tenantId, `
        INSERT INTO patient_observations
            (tenant_patient_id, note_type, privacy_level, author_role,
             status, declared_time, body_html, body_plain, created_by,
             author_first_name, author_last_name,
             signed_at, signed_by)
        VALUES ($1, 'INTERP_ECHO', 'NORMAL', 'DOCTOR', $7,
                NOW(), $2, $3, $4, $5, $6,
                $8, $9)
        RETURNING id
    `, [patientId, conclusionHtml, conclusionPlain,
        userId, data.creatorFirstName ?? '', data.creatorLastName ?? '',
        isDraft ? 'DRAFT' : 'SIGNED', obsSignedAt, obsSignedBy]);

    const obsId = obsRows[0].id;

    const rows = await tenantQuery(tenantId, `
        INSERT INTO patient_echo_records (
            tenant_id, tenant_patient_id,
            exam_date, exam_time, exam_type, modalities,
            fevg_pct, gls_pct, mapse_mm, dtd_vg_mm, dtd_index_mm_m2, siv_mm, pp_mm, hvg,
            trouble_cinetique, segments_cinetique,
            tapse_mm, fonction_vd, surface_vd_cm2,
            og_taille, od_taille, paps_mmhg, vci,
            valve_mitrale_status,    valve_mitrale_type,    valve_mitrale_severity,
            valve_aortique_status,   valve_aortique_type,   valve_aortique_severity,
            valve_tricuspide_status, valve_tricuspide_type, valve_tricuspide_severity,
            valve_pulmonaire_status, valve_pulmonaire_type, valve_pulmonaire_severity,
            pericarde, thrombus, vegetation, autre_anomalie,
            conclusion_observation_id, doctor, has_attachment, created_by, status,
            created_by_first_name, created_by_last_name
        ) VALUES (
            $1,$2,$3,$4,$5,$6,
            $7,$8,$9,$10,$11,$12,$13,$14,
            $15,$16,$17,$18,$19,$20,$21,$22,$23,
            $24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,
            $36,$37,$38,$39,$40,$41,$42,$43,$44,
            $45,$46
        ) RETURNING *
    `, [
        tenantId, patientId,
        data.date, data.time, data.type, data.modalities ?? [],
        toNullableFloat(data.fevg), toNullableFloat(data.gls),
        toNullableFloat(data.mapse), toNullableFloat(data.dtd_vg),
        toNullableFloat(data.dtd_index), toNullableFloat(data.siv),
        toNullableFloat(data.pp), data.hvg,
        data.troubleCinétique ?? false, data.segments ?? [],
        toNullableFloat(data.tapse), data.fonctionVD, toNullableFloat(data.surfaceVD),
        data.og_taille, data.od_taille, toNullableFloat(data.paps), data.vci,
        v.mitrale?.status ?? 'Normale',    v.mitrale?.type ?? [],    v.mitrale?.severity ?? 'Minime',
        v.aortique?.status ?? 'Normale',   v.aortique?.type ?? [],   v.aortique?.severity ?? 'Minime',
        v.tricuspide?.status ?? 'Normale', v.tricuspide?.type ?? [], v.tricuspide?.severity ?? 'Minime',
        v.pulmonaire?.status ?? 'Normale', v.pulmonaire?.type ?? [], v.pulmonaire?.severity ?? 'Minime',
        data.pericarde, data.thrombus ?? false, data.vegetation ?? false,
        data.autreAnomalie || null,
        obsId, data.doctor || null, data.hasAttachment ?? false,
        userId, isDraft ? 'DRAFT' : 'VALIDATED',
        data.creatorFirstName ?? null, data.creatorLastName ?? null
    ]);

    return { ...rows[0], conclusion_html: conclusionHtml };
}

export async function updateEcho(
    tenantId: string, echoId: string, data: any,
    conclusionHtml: string, conclusionPlain: string,
    userId?: string | null
) {
    const isDraft = data.status === 'DRAFT';
    const v = data.valves || {};
    const obsStatus = isDraft ? 'DRAFT' : 'SIGNED';

    await tenantQuery(tenantId, `
        UPDATE patient_observations
        SET    body_html = $1, body_plain = $2, updated_at = NOW(),
               status = $5,
               signed_at = CASE WHEN $5::text = 'SIGNED' AND signed_at IS NULL THEN NOW() ELSE signed_at END,
               signed_by = CASE WHEN $5::text = 'SIGNED' AND signed_by IS NULL THEN $6::uuid ELSE signed_by END
        WHERE  id = (SELECT conclusion_observation_id FROM patient_echo_records WHERE id = $3 AND tenant_id = $4)
    `, [conclusionHtml, conclusionPlain, echoId, tenantId, obsStatus, userId ?? null]);

    const rows = await tenantQuery(tenantId, `
        UPDATE patient_echo_records SET
            exam_date=$1, exam_time=$2, exam_type=$3, modalities=$4,
            fevg_pct=$5, gls_pct=$6, mapse_mm=$7, dtd_vg_mm=$8, dtd_index_mm_m2=$9,
            siv_mm=$10, pp_mm=$11, hvg=$12,
            trouble_cinetique=$13, segments_cinetique=$14,
            tapse_mm=$15, fonction_vd=$16, surface_vd_cm2=$17,
            og_taille=$18, od_taille=$19, paps_mmhg=$20, vci=$21,
            valve_mitrale_status=$22,    valve_mitrale_type=$23,    valve_mitrale_severity=$24,
            valve_aortique_status=$25,   valve_aortique_type=$26,   valve_aortique_severity=$27,
            valve_tricuspide_status=$28, valve_tricuspide_type=$29, valve_tricuspide_severity=$30,
            valve_pulmonaire_status=$31, valve_pulmonaire_type=$32, valve_pulmonaire_severity=$33,
            pericarde=$34, thrombus=$35, vegetation=$36, autre_anomalie=$37,
            doctor=$38, has_attachment=$39,
            status=$40,
            updated_at=NOW()
        WHERE id=$41 AND tenant_id=$42
        RETURNING *
    `, [
        data.date, data.time, data.type, data.modalities ?? [],
        toNullableFloat(data.fevg), toNullableFloat(data.gls),
        toNullableFloat(data.mapse), toNullableFloat(data.dtd_vg),
        toNullableFloat(data.dtd_index), toNullableFloat(data.siv),
        toNullableFloat(data.pp), data.hvg,
        data.troubleCinétique ?? false, data.segments ?? [],
        toNullableFloat(data.tapse), data.fonctionVD, toNullableFloat(data.surfaceVD),
        data.og_taille, data.od_taille, toNullableFloat(data.paps), data.vci,
        v.mitrale?.status ?? 'Normale',    v.mitrale?.type ?? [],    v.mitrale?.severity ?? 'Minime',
        v.aortique?.status ?? 'Normale',   v.aortique?.type ?? [],   v.aortique?.severity ?? 'Minime',
        v.tricuspide?.status ?? 'Normale', v.tricuspide?.type ?? [], v.tricuspide?.severity ?? 'Minime',
        v.pulmonaire?.status ?? 'Normale', v.pulmonaire?.type ?? [], v.pulmonaire?.severity ?? 'Minime',
        data.pericarde, data.thrombus ?? false, data.vegetation ?? false,
        data.autreAnomalie || null,
        data.doctor || null, data.hasAttachment ?? false,
        isDraft ? 'DRAFT' : 'VALIDATED',
        echoId, tenantId
    ]);

    return { ...rows[0], conclusion_html: conclusionHtml };
}

export async function deleteEcho(tenantId: string, echoId: string) {
    await tenantQuery(tenantId, `
        DELETE FROM patient_observations
        WHERE id = (SELECT conclusion_observation_id FROM patient_echo_records WHERE id = $1 AND tenant_id = $2)
    `, [echoId, tenantId]);
    await tenantQuery(tenantId, `DELETE FROM patient_echo_records WHERE id=$1 AND tenant_id=$2`, [echoId, tenantId]);
}

export async function enterEchoInError(tenantId: string, echoId: string, userId: string | null, reason?: string) {
    await tenantQuery(tenantId, `
        UPDATE patient_echo_records
        SET    status = 'ENTERED_IN_ERROR',
               entered_in_error_by = $1,
               entered_in_error_at = NOW(),
               entered_in_error_reason = $2,
               updated_at = NOW()
        WHERE  id = $3 AND tenant_id = $4
    `, [userId, reason ?? null, echoId, tenantId]);

    await tenantQuery(tenantId, `
        UPDATE patient_observations
        SET    status = 'ENTERED_IN_ERROR',
               entered_in_error_by = $1,
               entered_in_error_at = NOW(),
               entered_in_error_reason = $2
        WHERE  id = (SELECT conclusion_observation_id FROM patient_echo_records WHERE id = $3 AND tenant_id = $4)
    `, [userId, reason ?? null, echoId, tenantId]);
}
