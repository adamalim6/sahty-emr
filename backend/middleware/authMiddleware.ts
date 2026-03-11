
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-in-prod';

// ─────────────────────────────────────────────────────────────────
// Auth Context — built from JWT payload at every request
// ─────────────────────────────────────────────────────────────────

export interface AuthContext {
    userId: string;
    firstName?: string;
    lastName?: string;
    tenantId?: string;
    role?: string;
    realm: 'global' | 'tenant';
    permissions: string[];
    modules: string[];
    service_ids: string[];
    hasPermission(code: string): boolean;
    hasModule(module: string): boolean;
    hasAnyPermission(codes: string[]): boolean;
}

export interface AuthRequest extends Request {
    /** Raw JWT payload (legacy — use req.auth for new code) */
    user?: {
        userId: string;
        username: string;
        user_type: string;       // legacy derived field
        role: string;            // role_code from JWT
        role_id?: string;
        tenantId?: string;
        client_id?: string;      // legacy alias for tenantId
        realm?: 'global' | 'tenant';
        permissions?: string[];
        modules?: string[];
        service_ids?: string[];
    };

    /** Structured auth context with helper methods (use this in new code) */
    auth?: AuthContext;
}

// ─────────────────────────────────────────────────────────────────
// Core Middleware: authenticateToken
// ─────────────────────────────────────────────────────────────────

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access denied' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;

        // 🔐 MANDATORY SAFETY RULE: Realm Isolation (Tenant-only)
        if (decoded.realm !== 'tenant') {
            return res.status(403).json({ error: 'Forbidden: Invalid Realm' });
        }

        // 1. Preserve legacy req.user (backward compat for existing controllers)
        req.user = decoded;

        // 2. Build structured req.auth for new code
        const permissions: string[] = decoded.permissions || [];
        const modules: string[] = decoded.modules || [];
        const service_ids: string[] = decoded.service_ids || [];

        req.auth = {
            userId: decoded.userId,
            firstName: decoded.prenom,
            lastName: decoded.nom,
            tenantId: decoded.tenantId || decoded.client_id,
            role: decoded.role,
            realm: decoded.realm || 'tenant',
            permissions,
            modules,
            service_ids,
            hasPermission(code: string): boolean {
                return permissions.includes(code);
            },
            hasModule(module: string): boolean {
                return modules.includes(module);
            },
            hasAnyPermission(codes: string[]): boolean {
                return codes.some(c => permissions.includes(c));
            }
        };

        next();
    } catch (err) {
        return res.status(403).json({ error: 'Invalid token' });
    }
};

/**
 * Middleware that accepts BOTH tenant and global tokens.
 * Used for shared endpoints like /api/actes where both hospital users (read)
 * and super admins (read/write) need access.
 */
export const authenticateAnyToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access denied' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;

        // Allow both 'tenant' and 'global'
        if (decoded.realm !== 'tenant' && decoded.realm !== 'global') {
            return res.status(403).json({ error: 'Forbidden: Invalid Realm' });
        }

        req.user = decoded;

        const permissions: string[] = decoded.permissions || [];
        const modules: string[] = decoded.modules || [];
        const service_ids: string[] = decoded.service_ids || [];

        req.auth = {
            userId: decoded.userId,
            firstName: decoded.prenom,
            lastName: decoded.nom,
            tenantId: decoded.tenantId || decoded.client_id,
            role: decoded.role,
            realm: decoded.realm || 'tenant', // Could be 'global' here
            permissions,
            modules,
            service_ids,
            hasPermission(code: string): boolean {
                return permissions.includes(code);
            },
            hasModule(module: string): boolean {
                return modules.includes(module);
            },
            hasAnyPermission(codes: string[]): boolean {
                return codes.some(c => permissions.includes(c));
            }
        };

        next();
    } catch (err) {
        return res.status(403).json({ error: 'Invalid token' });
    }
};

// ─────────────────────────────────────────────────────────────────
// Legacy Guards (kept for backward compat — prefer authGuards.ts)
// ─────────────────────────────────────────────────────────────────

export const requireRole = (allowedTypes: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user || !allowedTypes.includes(req.user.user_type)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
};

/**
 * Middleware to enforce Tenant Context.
 * Rejects requests if the user is not associated with a tenant (client_id is null).
 */
export const requireTenant = (req: AuthRequest, res: Response, next: NextFunction) => {
    const tenantId = req.auth?.tenantId || req.user?.client_id || (req.user as any)?.tenantId;
    if (!tenantId) {
        return res.status(403).json({ error: 'Tenant Context Required. Access Denied.' });
    }
    next();
};

/**
 * Helper to safely extract tenantId from request.
 * Should only be used after requireTenant middleware.
 */
export const getTenantId = (req: AuthRequest): string => {
    const id = req.auth?.tenantId || req.user?.client_id || (req.user as any)?.tenantId;
    if (!id) throw new Error("Critical: TenantId missing in protected route");
    return id;
};
