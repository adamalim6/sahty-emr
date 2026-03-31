import { Request, Response } from 'express';
import { getTenantId } from '../middleware/authMiddleware';
import { tenantTransaction } from '../db/tenantPg';
import { prescriptionService } from '../services/prescriptionService';
import { limsExecutionService } from '../services/lims/limsExecutionService';

export const administrationController = {
    async logWithBiology(req: Request, res: Response) {
        try {
            if (!(req as any).user || !(req as any).user.userId) {
                return res.status(401).json({ error: 'Invalid authentication context' });
            }

            const { 
                actionType, occurredAt, actualStartAt, actualEndAt, 
                note, selected_prescription_event_ids, anchor_prescription_event_id
            } = req.body;
            
            const userId = (req as any).user.userId;

            let tenantId;
            try {
                tenantId = getTenantId(req);
            } catch (err) {
                return res.status(403).json({ error: 'Tenant ID is required' });
            }

            if (!actionType) return res.status(400).json({ error: 'actionType is required' });
            if (!selected_prescription_event_ids || selected_prescription_event_ids.length === 0) {
                return res.status(400).json({ error: 'No biology events selected' });
            }

            // Execute within a single transaction
            const result = await tenantTransaction(tenantId, async (client) => {
                const createdAdminEventIds: string[] = [];
                
                // 1. Log each selected event as 'administered' (or as dictated by actionType)
                for (const eventId of selected_prescription_event_ids) {
                    const adminEvent = await prescriptionService.logAdministrationActionTx(
                        tenantId,
                        client,
                        eventId,
                        actionType,
                        {
                            occurredAt: occurredAt ? new Date(occurredAt) : undefined,
                            actualStartAt: actualStartAt ? new Date(actualStartAt) : undefined,
                            actualEndAt: actualEndAt ? new Date(actualEndAt) : undefined,
                            performedByUserId: userId,
                            note
                        }
                    );
                    createdAdminEventIds.push(adminEvent.id);
                }

                // 2. Delegate to LIMS using the transaction client and the mapped IDs
                const mappedEvents = selected_prescription_event_ids.map((peId: string, idx: number) => ({
                    prescription_event_id: peId,
                    administration_event_id: createdAdminEventIds[idx]
                }));

                await limsExecutionService.createBiologySpecimensTx(
                    tenantId,
                    client,
                    userId,
                    {
                         anchor_prescription_event_id,
                         mappedEvents,
                         collected_at: actualStartAt || occurredAt
                    }
                );
                
                return { success: true, createdAdminEventIds };
            }, { userId });

            res.status(201).json(result);
        } catch (error: any) {
            console.error('Error in logWithBiology:', error);
            res.status(500).json({ error: error.message || 'Failed to execute logWithBiology' });
        }
    }
};
