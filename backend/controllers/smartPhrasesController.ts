import { Request, Response } from 'express';
import { smartPhrasesService } from '../services/smartPhrasesService';

export const getSystemPhrases = async (req: Request, res: Response) => {
    try {
        const phrases = await smartPhrasesService.getSystemPhrases();
        return res.json(phrases);
    } catch (error: any) {
        console.error('Error fetching system phrases:', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
};

export const createSystemPhrase = async (req: Request, res: Response) => {
    try {
        const { trigger, label, description, body_html } = req.body;

        if (!trigger || !body_html) {
            return res.status(400).json({ error: 'Missing required fields: trigger, body_html' });
        }

        const phrase = await smartPhrasesService.createSystemPhrase({
            trigger,
            label,
            description,
            body_html
        });

        return res.status(201).json(phrase);
    } catch (error: any) {
        if (error.statusCode === 409) {
            return res.status(409).json({ error: error.message });
        }
        console.error('Error creating system phrase:', error);
        return res.status(500).json({ error: 'Failed to create system phrase', details: error.message });
    }
};

export const updateSystemPhrase = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const phrase = await smartPhrasesService.updateSystemPhrase(id, updates);
        return res.json(phrase);
    } catch (error: any) {
        if (error.statusCode === 409) {
            return res.status(409).json({ error: error.message });
        }
        console.error('Error updating system phrase:', error);
        return res.status(500).json({ error: 'Failed to update system phrase', details: error.message });
    }
};

export const getPhrasesForUser = async (req: Request, res: Response) => {
    try {
        const { tenantId, userId } = (req as any).user;
        if (!tenantId || !userId) {
            return res.status(401).json({ error: 'Unauthorized: Missing tenant or user context' });
        }

        const phrases = await smartPhrasesService.getPhrasesForUser(tenantId, userId);
        return res.json(phrases);
    } catch (error: any) {
        console.error('Error fetching smart phrases:', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
};

export const createPhrase = async (req: Request, res: Response) => {
    try {
        const { tenantId, userId } = (req as any).user;
        const { trigger, label, description, body_html, scope } = req.body;

        if (!trigger || !body_html || !scope) {
            return res.status(400).json({ error: 'Missing required fields: trigger, body_html, scope' });
        }

        if (scope === 'user' && !userId) {
            return res.status(400).json({ error: 'user_id is required for user-scoped phrases' });
        }

        const cursorMatches = body_html.match(/\{\{cursor\}\}/g);
        if (cursorMatches && cursorMatches.length > 1) {
            return res.status(400).json({ error: 'Validation Error: Un seul curseur {{cursor}} est autorisé par template.' });
        }

        const phrase = await smartPhrasesService.createPhrase({
            trigger,
            label,
            description,
            body_html,
            scope,
            tenant_id: tenantId,
            user_id: scope === 'user' ? userId : undefined,
            created_by: userId
        });

        return res.status(201).json(phrase);
    } catch (error: any) {
        if (error.statusCode === 409) {
            return res.status(409).json({ error: error.message });
        }
        console.error('Error creating smart phrase:', error);
        return res.status(500).json({ error: 'Failed to create smart phrase', details: error.message });
    }
};

export const updatePhrase = async (req: Request, res: Response) => {
    try {
        const { tenantId } = (req as any).user;
        const { id } = req.params;
        const updates = req.body;

        if (updates.body_html) {
            const cursorMatches = updates.body_html.match(/\{\{cursor\}\}/g);
            if (cursorMatches && cursorMatches.length > 1) {
                return res.status(400).json({ error: 'Validation Error: Un seul curseur {{cursor}} est autorisé par template.' });
            }
        }

        const phrase = await smartPhrasesService.updatePhrase(id, updates, tenantId);
        return res.json(phrase);
    } catch (error: any) {
        if (error.statusCode === 409) {
            return res.status(409).json({ error: error.message });
        }
        console.error('Error updating smart phrase:', error);
        return res.status(500).json({ error: 'Failed to update smart phrase', details: error.message });
    }
};

export const compilePhrase = async (req: Request, res: Response) => {
    try {
        const { tenantId, id: userId } = (req as any).user;
        const { phraseId, tenantPatientId } = req.body;

        if (!phraseId || !tenantPatientId) {
            return res.status(400).json({ error: 'Missing required fields: phraseId, tenantPatientId' });
        }

        const compiledHtml = await smartPhrasesService.compilePhrase(tenantId, userId, tenantPatientId, phraseId);

        return res.json({ html: compiledHtml });
    } catch (error: any) {
        console.error('Error compiling smart phrase:', error);
        return res.status(500).json({ error: 'Failed to compile smart phrase', details: error.message });
    }
};
