/**
 * Auth Guards — Permission & Module-Based Authorization Middleware
 * 
 * Usage:
 *   router.get('/endpoint', authenticateToken, requirePermission('ph_stock'), handler);
 *   router.get('/emr/patients', authenticateToken, requireModule('EMR'), handler);
 * 
 * These guards read from req.auth (built by authenticateToken) and do NOT
 * hit the database — permissions/modules are already embedded in the JWT.
 */

import { Response, NextFunction } from 'express';

// Use the same augmented request type from authMiddleware
interface AuthenticatedRequest {
    auth?: {
        userId: string;
        tenantId?: string;
        permissions: string[];
        modules: string[];
        hasPermission(code: string): boolean;
        hasModule(module: string): boolean;
        hasAnyPermission(codes: string[]): boolean;
    };
    user?: any;
}

/**
 * Require a specific permission code.
 * Returns 403 if the user's role does not include this permission.
 */
export function requirePermission(code: string) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!req.auth) {
            return res.status(401).json({ error: 'Unauthenticated' });
        }
        if (!req.auth.hasPermission(code)) {
            console.warn(`[Guard] Permission denied: ${req.auth.userId} lacks '${code}'`);
            return res.status(403).json({ error: 'Forbidden', detail: `Missing permission: ${code}` });
        }
        next();
    };
}

/**
 * Require access to a specific module (e.g. 'EMR', 'PHARMACY', 'SETTINGS').
 * Returns 403 if the user's role does not include this module.
 */
export function requireModule(module: string) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!req.auth) {
            return res.status(401).json({ error: 'Unauthenticated' });
        }
        if (!req.auth.hasModule(module)) {
            // SuperAdmins bypass module checks
            const userType = req.user?.user_type;
            if (userType === 'SUPER_ADMIN' || userType === 'PUBLISHER_SUPERADMIN') {
                return next();
            }

            console.warn(`[Guard] Module denied: ${req.auth.userId} lacks '${module}'`);
            return res.status(403).json({ 
                error: 'Access Denied', 
                message: `You do not have access to the ${module} module.` 
            });
        }
        next();
    };
}

/**
 * Require at least one of the given permission codes.
 */
export function requireAnyPermission(codes: string[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!req.auth) {
            return res.status(401).json({ error: 'Unauthenticated' });
        }
        if (!req.auth.hasAnyPermission(codes)) {
            console.warn(`[Guard] Permission denied: ${req.auth.userId} lacks any of [${codes.join(', ')}]`);
            return res.status(403).json({ error: 'Forbidden', detail: `Missing any of: ${codes.join(', ')}` });
        }
        next();
    };
}

/**
 * Require ALL of the given permission codes.
 */
export function requireAllPermissions(codes: string[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!req.auth) {
            return res.status(401).json({ error: 'Unauthenticated' });
        }
        const missing = codes.filter(c => !req.auth!.hasPermission(c));
        if (missing.length > 0) {
            console.warn(`[Guard] Permission denied: ${req.auth.userId} lacks [${missing.join(', ')}]`);
            return res.status(403).json({ error: 'Forbidden', detail: `Missing permissions: ${missing.join(', ')}` });
        }
        next();
    };
}
