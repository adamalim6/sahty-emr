/**
 * HPRIM Admin/Debug Controller
 * 
 * Thin endpoints for testing and monitoring HPRIM integration.
 */

import { Request, Response } from 'express';
import { AuthRequest, getTenantId } from '../middleware/authMiddleware';
import { tenantQuery } from '../db/tenantPg';
import { hprimOutboundService } from '../services/integrations/hprim/hprimOutboundService';
import { hprimInboundService } from '../services/integrations/hprim/hprimInboundService';
import { hprimConfig } from '../services/integrations/hprim/hprimConfig';
import { listReadyFiles, readHprFile } from '../services/integrations/hprim/hprimFileService';
import { globalQuery } from '../db/globalPg';

export const hprimController = {

    /**
     * POST /api/hprim/trigger-orm/:specimenId
     * Manually trigger ORM generation for a specimen
     */
    async triggerOrm(req: AuthRequest, res: Response) {
        try {
            const tenantId = getTenantId(req);
            const { specimenId } = req.params;

            if (!specimenId) {
                return res.status(400).json({ error: 'specimenId is required' });
            }

            const result = await hprimOutboundService.generateOrmForSpecimen(tenantId, specimenId);

            if (!result) {
                return res.json({ message: 'No ORM generated — no EVM-mapped acts found or specimen not found' });
            }

            res.json({ message: 'ORM generated', ...result });
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    },

    /**
     * GET /api/hprim/messages
     * List HPRIM messages with optional filters
     */
    async listMessages(req: AuthRequest, res: Response) {
        try {
            const tenantId = getTenantId(req);
            const { direction, status, message_type, limit } = req.query;

            let sql = 'SELECT * FROM public.lab_hprim_messages WHERE 1=1';
            const params: any[] = [];

            if (direction) {
                params.push(direction);
                sql += ` AND direction = $${params.length}`;
            }
            if (status) {
                params.push(status);
                sql += ` AND status = $${params.length}`;
            }
            if (message_type) {
                params.push(message_type);
                sql += ` AND message_type = $${params.length}`;
            }

            sql += ' ORDER BY created_at DESC';
            sql += ` LIMIT ${parseInt(String(limit)) || 50}`;

            const rows = await tenantQuery(tenantId, sql, params);
            res.json(rows);
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    },

    /**
     * POST /api/hprim/retry/:messageId
     * Retry a failed inbound message
     */
    async retryMessage(req: AuthRequest, res: Response) {
        try {
            const tenantId = getTenantId(req);
            const { messageId } = req.params;

            const rows = await tenantQuery<any>(tenantId, `
                SELECT * FROM public.lab_hprim_messages 
                WHERE id = $1 AND direction = 'INBOUND' AND status = 'ERROR'
            `, [messageId]);

            if (rows.length === 0) {
                return res.status(404).json({ error: 'Message not found or not in ERROR state' });
            }

            const msg = rows[0];

            if (msg.retry_count >= msg.max_retries) {
                return res.status(400).json({ error: 'Max retries exceeded' });
            }

            if (!msg.payload_text) {
                return res.status(400).json({ error: 'No payload stored for retry' });
            }

            // Re-process from stored payload
            // Note: files may have been moved to error/, so we process from DB payload
            await hprimInboundService.processOruFile(
                tenantId,
                msg.file_name,
                msg.payload_text,
                msg.file_path, // May not exist anymore
                msg.file_path.replace(/\.hpr$/i, '.ok')
            );

            res.json({ message: 'Retry initiated' });
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    },

    /**
     * GET /api/hprim/links
     * List HPRIM links for debugging
     */
    async listLinks(req: AuthRequest, res: Response) {
        try {
            const tenantId = getTenantId(req);
            const rows = await tenantQuery(tenantId, `
                SELECT lhl.*, lr.global_act_id, ga.libelle_sih as act_label
                FROM public.lab_hprim_links lhl
                JOIN public.lab_requests lr ON lr.id = lhl.lab_request_id
                JOIN reference.global_actes ga ON ga.id = lr.global_act_id
                ORDER BY lhl.created_at DESC
                LIMIT 50
            `);
            res.json(rows);
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    },
};
