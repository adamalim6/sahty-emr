import { PoolClient } from 'pg';
import { tenantTransaction, tenantQuery } from '../db/tenantPg';
import { admissionChargeRepository } from '../repositories/admissionChargeRepository';
import { pricingResolutionRepository } from '../repositories/pricingResolutionRepository';

type PricingStatus = 'RESOLVED' | 'PROVISIONAL' | 'PENDING_REVIEW';
type CoverageResolutionMode = 'COVERAGE_MATCHED' | 'FALLBACK_DEFAULT' | 'NONE';
type ChargeStatus = 'CAPTURED' | 'PENDING_REVIEW';
type PricingSourceType = 'PRICING_LIST' | 'NONE';
type SnapshotSource = 'INITIAL_CAPTURE' | 'PROVISIONAL_NO_ITEM' | 'PENDING_REVIEW_NO_CONFIG';

interface ResolvedPricing {
    chargeStatus: ChargeStatus;
    pricingStatus: PricingStatus;
    coverageResolutionMode: CoverageResolutionMode;
    coverageResolutionReason: string | null;
    admissionCoverageId: string | null;
    organismeId: string | null;
    pricingSourceType: PricingSourceType;
    snapshotSource: SnapshotSource;
    pricingListId: string | null;
    pricingListCode: string | null;
    pricingListVersionNo: number | null;
    pricingListItemId: string | null;
    pricingListItemVersionId: string | null;
    pricingListItemVersionNo: number | null;
    billingLabel: string | null;
    unitPrice: number;
    dispatches: Array<{ dispatch_type: string; sequence_no: number; allocation_value: number }>;
}

/**
 * Run the pricing resolution decision tree for initial capture.
 *
 *   Case A — Coverage matches a published pricing list + item + version  → RESOLVED / COVERAGE_MATCHED
 *   Case B — Coverage absent-or-unmatched, default list has the item+ver → RESOLVED / FALLBACK_DEFAULT
 *   Case C — Default list exists but no item for this act                → PROVISIONAL / FALLBACK_DEFAULT
 *   Case D — No pricing config available anywhere                        → PENDING_REVIEW / NONE
 */
async function resolvePricing(
    client: PoolClient,
    admissionId: string,
    globalActId: string
): Promise<ResolvedPricing> {

    // ACTIVE primary binding for the admission (versioned-binding model).
    // Membership is pre-verified at bind time, so no need to re-check the patient FK here.
    const coverage = await pricingResolutionRepository.getPrimaryCoverage(client, admissionId);
    const admissionCoverageId = coverage?.admission_coverage_id ?? null;
    const coverageOrganismeId = coverage?.organisme_id ?? null;

    // --- Step 1: Try the coverage-driven pricing list ---
    if (coverage) {
        const coveragePl = await pricingResolutionRepository.findPublishedPricingListForOrganisme(
            client, coverage.organisme_id
        );
        if (coveragePl) {
            const item = await pricingResolutionRepository.findActiveItem(client, coveragePl.id, globalActId);
            if (item) {
                const version = await pricingResolutionRepository.getPublishedItemVersion(client, item.id);
                if (version) {
                    const dispatches = await pricingResolutionRepository.listDispatchesForItemVersion(client, version.id);
                    return {
                        chargeStatus: 'CAPTURED',
                        pricingStatus: 'RESOLVED',
                        coverageResolutionMode: 'COVERAGE_MATCHED',
                        coverageResolutionReason: null,
                        admissionCoverageId,
                        organismeId: coverageOrganismeId,
                        pricingSourceType: 'PRICING_LIST',
                        snapshotSource: 'INITIAL_CAPTURE',
                        pricingListId: coveragePl.id,
                        pricingListCode: coveragePl.code,
                        pricingListVersionNo: coveragePl.version_no,
                        pricingListItemId: item.id,
                        pricingListItemVersionId: version.id,
                        pricingListItemVersionNo: version.version_no,
                        billingLabel: version.billing_label,
                        unitPrice: Number(version.unit_price),
                        dispatches
                    };
                }
            }
        }
    }

    // --- Step 2: Fall back to default published pricing list ---
    const defaultPl = await pricingResolutionRepository.findDefaultPublishedPricingList(client);
    const fallbackReason = !coverage
        ? 'NO_COVERAGE_FOR_ADMITTED_PATIENT'
        : !coverageOrganismeId
            ? 'NO_ORGANISME_ON_COVERAGE'
            : 'NO_ITEM_ON_COVERAGE_LIST_OR_NO_PUBLISHED_LIST_FOR_ORGANISME';

    if (defaultPl) {
        const item = await pricingResolutionRepository.findActiveItem(client, defaultPl.id, globalActId);
        if (item) {
            const version = await pricingResolutionRepository.getPublishedItemVersion(client, item.id);
            if (version) {
                const dispatches = await pricingResolutionRepository.listDispatchesForItemVersion(client, version.id);
                return {
                    chargeStatus: 'CAPTURED',
                    pricingStatus: 'RESOLVED',
                    coverageResolutionMode: 'FALLBACK_DEFAULT',
                    coverageResolutionReason: fallbackReason,
                    admissionCoverageId,
                    organismeId: coverageOrganismeId,
                    pricingSourceType: 'PRICING_LIST',
                    snapshotSource: 'INITIAL_CAPTURE',
                    pricingListId: defaultPl.id,
                    pricingListCode: defaultPl.code,
                    pricingListVersionNo: defaultPl.version_no,
                    pricingListItemId: item.id,
                    pricingListItemVersionId: version.id,
                    pricingListItemVersionNo: version.version_no,
                    billingLabel: version.billing_label,
                    unitPrice: Number(version.unit_price),
                    dispatches
                };
            }
        }

        // Default list exists but no item/version → PROVISIONAL
        return {
            chargeStatus: 'PENDING_REVIEW',
            pricingStatus: 'PROVISIONAL',
            coverageResolutionMode: 'FALLBACK_DEFAULT',
            coverageResolutionReason: 'NO_ITEM_ON_DEFAULT_LIST',
            admissionCoverageId,
            organismeId: coverageOrganismeId,
            pricingSourceType: 'NONE',
            snapshotSource: 'PROVISIONAL_NO_ITEM',
            pricingListId: defaultPl.id,
            pricingListCode: defaultPl.code,
            pricingListVersionNo: defaultPl.version_no,
            pricingListItemId: null,
            pricingListItemVersionId: null,
            pricingListItemVersionNo: null,
            billingLabel: null,
            unitPrice: 0,
            dispatches: []
        };
    }

    // --- Step 3: No pricing config anywhere → PENDING_REVIEW ---
    return {
        chargeStatus: 'PENDING_REVIEW',
        pricingStatus: 'PENDING_REVIEW',
        coverageResolutionMode: 'NONE',
        coverageResolutionReason: 'NO_PRICING_CONFIG_AVAILABLE',
        admissionCoverageId,
        organismeId: coverageOrganismeId,
        pricingSourceType: 'NONE',
        snapshotSource: 'PENDING_REVIEW_NO_CONFIG',
        pricingListId: null,
        pricingListCode: null,
        pricingListVersionNo: null,
        pricingListItemId: null,
        pricingListItemVersionId: null,
        pricingListItemVersionNo: null,
        billingLabel: null,
        unitPrice: 0,
        dispatches: []
    };
}

export const admissionChargeService = {

    /**
     * Atomically:
     *   1. Create the clinical admission_acts row
     *   2. Resolve pricing context
     *   3. Create admission_charge_events
     *   4. Create the first immutable admission_charge_snapshots row
     *   5. Seed admission_charge_dispatches from the pricing version (if any)
     *   6. Update the event's current_snapshot_id pointer
     */
    async addActToAdmission(params: {
        tenantId: string;
        admissionId: string;
        globalActId: string;
        quantity?: number;
        userId: string | null;
    }) {
        const { tenantId, admissionId, globalActId, userId } = params;
        const quantity = params.quantity && params.quantity > 0 ? params.quantity : 1;

        return tenantTransaction(tenantId, async (client: PoolClient) => {
            // Validate admission and pull patient id
            const admRes = await client.query(
                `SELECT id, tenant_patient_id, status FROM public.admissions WHERE id = $1`,
                [admissionId]
            );
            const admission = admRes.rows[0];
            if (!admission) throw new Error('Admission introuvable');
            if (admission.status && admission.status !== 'En cours') {
                throw new Error("Impossible d'ajouter un acte à une admission clôturée");
            }
            if (!admission.tenant_patient_id) {
                throw new Error("Admission sans patient rattaché");
            }

            // Validate global act
            const gaRes = await client.query(
                `SELECT id FROM reference.global_actes WHERE id = $1 AND actif = true`,
                [globalActId]
            );
            if (!gaRes.rows[0]) throw new Error('Acte introuvable ou inactif');

            // Resolve pricing against the admission's ACTIVE primary binding (if any).
            const resolved = await resolvePricing(client, admissionId, globalActId);
            const totalPrice = Number((resolved.unitPrice * quantity).toFixed(2));

            // 1. Clinical act
            const act = await admissionChargeRepository.createAdmissionAct(client, {
                admissionId,
                globalActId,
                quantity
            });

            // 2. Charge event (with NULL current_snapshot_id for now)
            const chargeEvent = await admissionChargeRepository.createChargeEvent(client, {
                admissionId,
                admissionActId: act.id,
                patientId: admission.tenant_patient_id,
                globalActId,
                quantity,
                status: resolved.chargeStatus,
                pricingStatus: resolved.pricingStatus,
                coverageResolutionMode: resolved.coverageResolutionMode,
                coverageResolutionReason: resolved.coverageResolutionReason,
                admissionCoverageId: resolved.admissionCoverageId,
                capturedByUserId: userId
            });

            // 3. First snapshot (immutable)
            const snapshot = await admissionChargeRepository.createSnapshot(client, {
                chargeEventId: chargeEvent.id,
                snapshotNo: 1,
                isCurrent: true,
                supersedesSnapshotId: null,
                quantity,
                unitPrice: resolved.unitPrice,
                totalPrice,
                pricingSourceType: resolved.pricingSourceType,
                snapshotSource: resolved.snapshotSource,
                pricingListId: resolved.pricingListId,
                pricingListCode: resolved.pricingListCode,
                pricingListVersionNo: resolved.pricingListVersionNo,
                pricingListItemId: resolved.pricingListItemId,
                pricingListItemVersionId: resolved.pricingListItemVersionId,
                pricingListItemVersionNo: resolved.pricingListItemVersionNo,
                billingLabel: resolved.billingLabel,
                organismeId: resolved.organismeId,
                admissionCoverageId: resolved.admissionCoverageId,
                coverageResolutionMode: resolved.coverageResolutionMode,
                coverageResolutionReason: resolved.coverageResolutionReason,
                repricingReason: null,
                createdByUserId: userId
            });

            // 4. Seed dispatches from pricing version (cases A/B only)
            let dispatches: any[] = [];
            if (resolved.dispatches.length > 0) {
                dispatches = await admissionChargeRepository.createDispatches(
                    client,
                    snapshot.id,
                    resolved.dispatches.map(d => ({
                        dispatch_type: d.dispatch_type,
                        sequence_no: d.sequence_no,
                        amount: Number(d.allocation_value) * quantity
                    }))
                );
            }

            // 5. Point the event at its current snapshot
            await admissionChargeRepository.setCurrentSnapshot(client, chargeEvent.id, snapshot.id);

            return {
                admissionAct: act,
                chargeEvent: { ...chargeEvent, current_snapshot_id: snapshot.id },
                snapshot: { ...snapshot, dispatches }
            };
        }, userId ? { userId } : undefined);
    },

    async listCharges(params: { tenantId: string; admissionId: string; includeVoided?: boolean }) {
        return admissionChargeRepository.listChargesByAdmission(params.tenantId, params.admissionId, {
            includeVoided: params.includeVoided
        });
    },

    async voidCharge(params: {
        tenantId: string;
        chargeEventId: string;
        userId: string | null;
        reason: string | null;
    }) {
        return tenantTransaction(params.tenantId, async (client: PoolClient) => {
            const existing = await admissionChargeRepository.getAdmissionByChargeEvent(client, params.chargeEventId);
            if (!existing) throw new Error('Charge introuvable');
            if (existing.status === 'POSTED') {
                throw new Error('Impossible d\'annuler une charge déjà postée — utiliser un avoir');
            }
            if (existing.status === 'VOIDED_BEFORE_POSTING') {
                throw new Error('Charge déjà annulée');
            }

            const voided = await admissionChargeRepository.voidChargeEvent(client, {
                chargeEventId: params.chargeEventId,
                userId: params.userId,
                reason: params.reason
            });
            if (!voided) throw new Error('Impossible d\'annuler cette charge');
            return voided;
        }, params.userId ? { userId: params.userId } : undefined);
    },

    async searchActs(tenantId: string, search: string) {
        const q = (search || '').trim();
        if (q.length < 2) return [];
        return tenantQuery(tenantId, `
            SELECT id, code_sih, libelle_sih, type_acte
            FROM reference.global_actes
            WHERE actif = true
              AND (code_sih ILIKE $1 OR libelle_sih ILIKE $1)
            ORDER BY libelle_sih ASC
            LIMIT 50
        `, [`%${q}%`]);
    }
};
