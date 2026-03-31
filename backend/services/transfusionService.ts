import { tenantQuery, tenantTransaction } from '../db/tenantPg';
import { PoolClient } from 'pg';

export interface BloodBagReceptionPayload {
    tenant_patient_id: string;
    admission_id?: string;
    blood_product_code: string;
    bag_number: string;
    abo_group: string;
    rhesus: string;
    volume_ml?: number;
    expiry_at?: string;
    notes?: string;
}

export interface TransfusionBloodBag {
    id: string;
    tenant_id: string;
    tenant_patient_id: string;
    admission_id: string | null;
    received_at: Date;
    received_by_user_id: string;
    received_by_user_first_name: string | null;
    received_by_user_last_name: string | null;
    blood_product_code: string;
    bag_number: string;
    abo_group: string;
    rhesus: string;
    volume_ml: number | null;
    expiry_at: Date | null;
    status: string;
    notes: string | null;
    billed_at: Date | null;
    billing_status: string | null;
    created_at: Date;
}

export class TransfusionService {

    async listPatientBloodBags(tenantId: string, tenantPatientId: string): Promise<TransfusionBloodBag[]> {
        const query = `
            SELECT *
            FROM public.transfusion_blood_bags
            WHERE tenant_id = $1 AND tenant_patient_id = $2
            ORDER BY received_at DESC
        `;
        return tenantQuery<TransfusionBloodBag>(tenantId, query, [tenantId, tenantPatientId]);
    }

    async createBloodBagReception(tenantId: string, userId: string, payload: BloodBagReceptionPayload): Promise<TransfusionBloodBag> {
        
        if (!payload.volume_ml || payload.volume_ml <= 0) {
            throw new Error("Volume de la poche (ml) est obligatoire et doit être supérieur à 0.");
        }

        // Find user name
        const userQuery = `SELECT first_name, last_name FROM auth.users WHERE user_id = $1`;
        const userRes = await tenantQuery<{first_name: string, last_name: string}>(tenantId, userQuery, [userId]);
        const userFirstName = userRes.length > 0 ? userRes[0].first_name : null;
        const userLastName = userRes.length > 0 ? userRes[0].last_name : null;

        const insertQuery = `
            INSERT INTO public.transfusion_blood_bags (
                tenant_id, tenant_patient_id, admission_id, 
                received_by_user_id, received_by_user_first_name, received_by_user_last_name,
                blood_product_code, bag_number, abo_group, rhesus, volume_ml, expiry_at, notes
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
            )
            RETURNING *
        `;
        const values = [
            tenantId,
            payload.tenant_patient_id,
            payload.admission_id || null,
            userId,
            userFirstName,
            userLastName,
            payload.blood_product_code,
            payload.bag_number,
            payload.abo_group,
            payload.rhesus,
            payload.volume_ml !== undefined ? payload.volume_ml : null,
            payload.expiry_at || null,
            payload.notes || null
        ];

        try {
            const inserted = await tenantQuery<TransfusionBloodBag>(tenantId, insertQuery, values);
            return inserted[0];
        } catch (error: any) {
            if (error.code === '23505' || (error.message && error.message.includes('idx_transfusion_bags_tenant_bag'))) {
                throw new Error("Cette poche est déjà enregistrée dans le système.");
            }
            throw error;
        }
    }

    async discardBloodBag(tenantId: string, bloodBagId: string): Promise<TransfusionBloodBag> {
        const checkQuery = `SELECT status FROM public.transfusion_blood_bags WHERE tenant_id = $1 AND id = $2`;
        const stateRes = await tenantQuery<{status: string}>(tenantId, checkQuery, [tenantId, bloodBagId]);
        if (stateRes.length === 0) throw new Error("Poche de sang introuvable.");
        
        const currentStatus = stateRes[0].status;
        if (currentStatus !== 'RECEIVED') {
            throw new Error(`Impossible de mettre au rebut une poche qui est dans l'état: ${currentStatus}`);
        }

        const updateQuery = `
            UPDATE public.transfusion_blood_bags
            SET status = 'DISCARDED'
            WHERE tenant_id = $1 AND id = $2
            RETURNING *
        `;
        const updated = await tenantQuery<TransfusionBloodBag>(tenantId, updateQuery, [tenantId, bloodBagId]);
        return updated[0];
    }

    async getTransfusionTimeline(tenantId: string, tenantPatientId: string): Promise<any> {
        // Query reserved bags
        const reservedBags = await this.listPatientBloodBags(tenantId, tenantPatientId);

        // Query prescriptions and their nested events
        const query = `
            SELECT 
                p.id as prescription_id,
                p.tenant_patient_id,
                p.blood_product_type,
                p.qty,
                p.unit_id,
                p.route_label as route,
                p.admin_duration_mins,
                p.status,
                p.paused_at,
                p.stopped_at,
                p.created_at,
                p.created_by_first_name,
                p.created_by_last_name,
                COALESCE(u.display, p.unit_label, 'poche(s)') as unit_name,
                (
                    SELECT COALESCE(jsonb_agg(
                        jsonb_build_object(
                            'id', pe.id,
                            'scheduled_at', pe.scheduled_at,
                            'status', pe.status,
                            'administrations', (
                                SELECT COALESCE(jsonb_agg(
                                    jsonb_build_object(
                                        'id', ae.id,
                                        'action_type', ae.action_type,
                                        'occurred_at', ae.occurred_at,
                                        'actual_start_at', ae.actual_start_at,
                                        'actual_end_at', ae.actual_end_at,
                                        'status', ae.status,
                                        'linked_event_id', ae.linked_event_id,
                                        'created_at', ae.created_at,
                                        'performed_by_user_id', ae.performed_by_user_id,
                                        'performed_by_first_name', ae.performed_by_first_name,
                                        'performed_by_last_name', ae.performed_by_last_name,
                                        'checks', (
                                            SELECT jsonb_build_object(
                                                'identity_check_done', tc.identity_check_done,
                                                'compatibility_check_done', tc.compatibility_check_done,
                                                'bedside_double_check_done', tc.bedside_double_check_done,
                                                'vitals_baseline_done', tc.vitals_baseline_done,
                                                'notes', tc.notes
                                            ) FROM public.transfusion_checks tc WHERE tc.administration_event_id = ae.id
                                        ),
                                        'reaction', (
                                            SELECT jsonb_build_object(
                                                'reaction_type', tr.reaction_type,
                                                'severity', tr.severity,
                                                'description', tr.description,
                                                'actions_taken', tr.actions_taken
                                            ) FROM public.transfusion_reactions tr WHERE tr.administration_event_id = ae.id
                                        ),
                                        'bags', (
                                            SELECT COALESCE(jsonb_agg(
                                                jsonb_build_object(
                                                    'blood_bag_id', aebb.blood_bag_id,
                                                    'bag_number', tbb.bag_number,
                                                    'blood_product_code', tbb.blood_product_code,
                                                    'abo_group', tbb.abo_group,
                                                    'rhesus', tbb.rhesus,
                                                    'volume_ml', tbb.volume_ml,
                                                    'volume_administered_ml', aebb.volume_administered_ml
                                                )
                                            ), '[]'::jsonb) 
                                            FROM public.administration_event_blood_bags aebb
                                            JOIN public.transfusion_blood_bags tbb ON tbb.id = aebb.blood_bag_id
                                            WHERE aebb.administration_event_id = ae.id AND aebb.tenant_id = $1
                                        )
                                    )
                                    ORDER BY ae.occurred_at ASC
                                ), '[]'::jsonb)
                                FROM public.administration_events ae
                                WHERE ae.prescription_event_id = pe.id AND ae.status = 'ACTIVE' AND ae.tenant_id = $1
                            )
                        ) ORDER BY pe.scheduled_at ASC
                    ), '[]'::jsonb)
                    FROM public.prescription_events pe
                    WHERE pe.prescription_id = p.id AND pe.tenant_id = $1
                ) as events
            FROM public.prescriptions p
            LEFT JOIN reference.units u ON u.id = p.unit_id
            WHERE p.tenant_id = $1 
              AND p.tenant_patient_id = $2 
              AND p.prescription_type = 'transfusion'
            ORDER BY p.created_at DESC
        `;
        const prescriptions = await tenantQuery<any>(tenantId, query, [tenantId, tenantPatientId]);
        
        return {
            bags: reservedBags,
            prescriptions
        };
    }
}

export const transfusionService = new TransfusionService();
