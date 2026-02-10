/**
 * Module Middleware — Route-Group Guard
 * 
 * Protects entire route groups by required module access.
 * Uses req.auth.modules (populated from JWT by authenticateToken).
 * 
 * NOTE: Prefer the new authGuards.ts `requireModule()` for new routes.
 * This file is kept for backward compatibility with existing route files.
 */

import { Response, NextFunction } from 'express';

export const requireModule = (requiredModule: string) => {
    return (req: any, res: Response, next: NextFunction) => {
        // Prefer structured req.auth (new path)
        if (req.auth) {
            if (req.auth.hasModule(requiredModule)) {
                return next();
            }
            console.warn(`[Access Denied] User ${req.auth.userId} tried to access ${requiredModule} but modules=[${req.auth.modules.join(', ')}]`);
            return res.status(403).json({ 
                error: 'Access Denied', 
                message: `You do not have access to the ${requiredModule} module.` 
            });
        }

        // Legacy fallback (req.auth not yet populated — shouldn't happen)
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: 'Unauthenticated' });
        }

        const userModules: string[] = user.modules || [];
        if (!userModules.includes(requiredModule)) {
            console.warn(`[Access Denied] User ${user.username} tried to access ${requiredModule} but only has [${userModules.join(', ')}]`);
            return res.status(403).json({ 
                error: 'Access Denied', 
                message: `You do not have access to the ${requiredModule} module.` 
            });
        }

        next();
    };
};
