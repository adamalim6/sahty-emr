
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-in-prod';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        username: string;
        user_type: string;
        role_id: string;
        client_id: string | null;
        service_ids?: string[];
    };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access denied' });

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
};


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
    if (!req.user || !req.user.client_id) {
        return res.status(403).json({ error: 'Tenant Context Required. Access Denied.' });
    }
    next();
};

/**
 * Helper to safely extract tenantId from request.
 * Should only be used after requireTenant middleware.
 */
export const getTenantId = (req: AuthRequest): string => {
    // Check both standard 'client_id' and potential legacy 'tenantId' from token
    const id = req.user?.client_id || (req.user as any)?.tenantId;
    if (!id) throw new Error("Critical: TenantId missing in protected route");
    return id;
};
