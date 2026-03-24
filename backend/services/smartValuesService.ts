import { Pool } from 'pg';
import { getTenantPool } from '../db/tenantPg';

function escapeHtml(unsafe: string): string {
    if (!unsafe) return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

class SmartValuesService {
    
    async resolveSmartValue(tenantId: string, tenantPatientId: string, trigger: string): Promise<string> {
        switch (trigger.toLowerCase()) {
            case 'vitals':
                return this.resolveVitals(tenantId, tenantPatientId);
            case 'allergies':
                return this.resolveAllergies(tenantId, tenantPatientId);
            case 'addictions':
                return this.resolveAddictions(tenantId, tenantPatientId);
            default:
                throw new Error(`Smart value non supportée: ${trigger}`);
        }
    }

    private async resolveVitals(tenantId: string, tenantPatientId: string): Promise<string> {
        const pool: Pool = getTenantPool(tenantId);

        const res = await pool.query(`
            SELECT
                parameter_code,
                value_numeric,
                value_text,
                value_boolean,
                recorded_at
            FROM (
                SELECT
                    parameter_code,
                    value_numeric,
                    value_text,
                    value_boolean,
                    recorded_at,
                    ROW_NUMBER() OVER (
                        PARTITION BY parameter_code
                        ORDER BY recorded_at DESC
                    ) AS rn
                FROM surveillance_values_events
                WHERE tenant_id = $1
                AND tenant_patient_id = $2
                AND parameter_code IN (
                    'PA_SYS',
                    'PA_DIA',
                    'FC',
                    'TEMP',
                    'SPO2',
                    'WEIGHT'
                )
            ) ranked
            WHERE rn = 1;
        `, [tenantId, tenantPatientId]);

        console.log("Vitals query result:", res.rows);

        if (res.rows.length === 0) {
            return `<p><strong>Dernières constantes:</strong> Aucune donnée enregistrée.</p>`;
        }

        const vitalsMap = new Map<string, any>();
        res.rows.forEach(row => {
            const val = row.value_numeric ?? row.value_text ?? row.value_boolean;
            vitalsMap.set(row.parameter_code, val);
        });

        // Strict clinical ordering
        const orderedCodes = [
            { code: 'BP', label: 'PA', unit: 'mmHg' },
            { code: 'FC', label: 'FC', unit: 'bpm' },
            { code: 'TEMP', label: 'Température', unit: '°C' },
            { code: 'SPO2', label: 'SpO2', unit: '%' },
            { code: 'WEIGHT', label: 'Poids', unit: 'kg' }
        ];

        let html = `<p><strong>Dernières constantes</strong></p><ul>`;
        let count = 0;

        let bpStr: string | null = null;
        const sys = vitalsMap.get('PA_SYS');
        const dia = vitalsMap.get('PA_DIA');
        if (sys !== undefined || dia !== undefined) {
            bpStr = `${sys ?? '?'} / ${dia ?? '?'}`;
        }

        for (const item of orderedCodes) {
            if (item.code === 'BP') {
                if (bpStr) {
                    html += `<li>${item.label}: ${escapeHtml(bpStr)} ${item.unit}</li>`;
                    count++;
                }
            } else if (vitalsMap.has(item.code)) {
                const val = vitalsMap.get(item.code);
                html += `<li>${item.label}: ${escapeHtml(String(val))} ${item.unit}</li>`;
                count++;
            }
        }

        html += `</ul>`;

        if (count === 0) return `<p><strong>Dernières constantes:</strong> Aucune donnée enregistrée.</p>`;
        return html;
    }

    private async resolveAllergies(tenantId: string, tenantPatientId: string): Promise<string> {
        const pool: Pool = getTenantPool(tenantId);

        const res = await pool.query(`
            SELECT 
                a.id,
                a.allergen_name_snapshot,
                a.severity,
                a.reaction_description,
                array_agg(m.manifestation_code) FILTER (WHERE m.manifestation_code IS NOT NULL) AS manifestations
            FROM patient_allergies a
            LEFT JOIN patient_allergy_manifestations m
                ON m.patient_allergy_id = a.id
            WHERE 
                a.tenant_id = $1 
                AND a.tenant_patient_id = $2 
                AND a.status = 'ACTIVE'
            GROUP BY 
                a.id,
                a.allergen_name_snapshot,
                a.severity,
                a.reaction_description
            ORDER BY a.created_at DESC;
        `, [tenantId, tenantPatientId]);

        if (res.rows.length === 0) {
            return `<p><strong>Allergies:</strong> Aucune allergie active connue.</p>`;
        }

        let html = `<p><strong>Allergies:</strong></p><ul>`;

        for (const row of res.rows) {
            const allergen = escapeHtml(row.allergen_name_snapshot || 'Inconnu');
            
            let severityStr = '';
            if (row.severity) {
                severityStr = ` (${escapeHtml(row.severity)})`;
            }

            let manifsStr = '';
            if (row.manifestations && Array.isArray(row.manifestations) && row.manifestations.length > 0) {
                // Remove nulls if any, escape them
                const validManifs = row.manifestations.filter(Boolean).map((m: any) => escapeHtml(String(m)));
                if (validManifs.length > 0) {
                    manifsStr = ` — ${validManifs.join(', ')}`;
                }
            }

            let reactionStr = '';
            if (row.reaction_description) {
                reactionStr = ` — ${escapeHtml(row.reaction_description)}`;
            }

            html += `<li>${allergen}${severityStr}${manifsStr}${reactionStr}</li>`;
        }

        html += `</ul>`;
        return html;
    }

    private async resolveAddictions(tenantId: string, tenantPatientId: string): Promise<string> {
        const pool: Pool = getTenantPool(tenantId);

        const res = await pool.query(`
            SELECT addiction_type, substance_label, qty, unit, frequency, status 
            FROM patient_addictions
            WHERE tenant_patient_id = $1 AND status IN ('ACTIVE', 'WITHDRAWAL')
            ORDER BY created_at DESC;
        `, [tenantPatientId]);

        if (res.rows.length === 0) {
            return `<p><strong>Addictions:</strong> Aucun antécédent d'addiction actif documenté.</p>`;
        }

        let html = `<p><strong>Addictions:</strong></p><ul>`;

        for (const row of res.rows) {
            let labelParts = [];
            
            const ADDICTION_TYPE_LABELS: Record<string, string> = {
                'TOBACCO': 'Tabac',
                'ALCOHOL': 'Alcool',
                'CANNABIS': 'Cannabis',
                'OPIOIDS': 'Opioïdes',
                'STIMULANTS': 'Stimulants',
                'BEHAVIORAL': 'Comportementale',
                'OTHER': 'Autre'
            };
            const translatedType = ADDICTION_TYPE_LABELS[row.addiction_type] || row.addiction_type;
            
            labelParts.push(escapeHtml(translatedType));

            if (row.substance_label) {
                labelParts.push(escapeHtml(row.substance_label));
            }

            let descParts = [];
            if (row.qty) descParts.push(escapeHtml(String(row.qty)));
            if (row.unit) descParts.push(escapeHtml(row.unit));
            
            let qtyStr = descParts.join(' ');
            if (row.frequency) {
                if (qtyStr) qtyStr += ` / ${escapeHtml(row.frequency)}`;
                else qtyStr = escapeHtml(row.frequency);
            }

            let displayStatus = row.status;
            if (displayStatus === 'WITHDRAWAL') {
                displayStatus = 'EN_SEVRAGE';
            }
            const statusStr = ` (${escapeHtml(displayStatus)})`;

            html += `<li>${labelParts.join(': ')}${qtyStr ? ` — ${qtyStr}` : ''}${statusStr}</li>`;
        }

        html += `</ul>`;
        return html;
    }
}

export const smartValuesService = new SmartValuesService();
