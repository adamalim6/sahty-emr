import { Request, Response } from 'express';
import { getTenantId } from '../middleware/authMiddleware';
import { smartValuesService } from '../services/smartValuesService';

export class SmartValuesController {
    
    async resolveSmartValue(req: Request, res: Response) {
        try {
            const tenantId = getTenantId(req as any);
            const { trigger } = req.params;
            const { tenantPatientId } = req.query;

            if (!tenantPatientId || typeof tenantPatientId !== 'string') {
                return res.status(400).json({ error: "Missing tenantPatientId query parameter" });
            }

            if (!trigger) {
                return res.status(400).json({ error: "Missing trigger parameter" });
            }

            const html = await smartValuesService.resolveSmartValue(tenantId, tenantPatientId, trigger);
            
            res.json({ html });
        } catch (error: any) {
            console.error(`Error resolving smart value '${req.params.trigger}':`, error);
            if (error.message.includes('non supportée')) {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: 'Erreur serveur lors de la résolution de la valeur intelligente.' });
        }
    }
}

export const smartValuesController = new SmartValuesController();
