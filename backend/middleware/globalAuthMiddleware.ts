import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { globalAdminService } from '../services/globalAdminService';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-in-prod';

export const authenticateGlobalAdmin = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Authentication required' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;

        // 🔐 MANDATORY SAFETY RULE: Tenant Containment
        // 1. Must have realm: 'global'
        if (decoded.realm !== 'global') {
            console.warn(`[SECURITY] Tenant user ${decoded.username} attempted to access Global Realm`);
            return res.status(403).json({ message: 'Forbidden: Invalid Realm' });
        }

        // 2. Must be SUPER_ADMIN
        if (decoded.role !== 'SUPER_ADMIN') {
             return res.status(403).json({ message: 'Forbidden: Insufficient Privileges' });
        }

        // 3. Verify existence in Global Store
        const user = await globalAdminService.getAdminById(decoded.userId);
        if (!user || !user.active) {
            return res.status(403).json({ message: 'Account disabled or not found' });
        }

        (req as any).user = user;
        next();
    } catch (error) {
        return res.status(403).json({ message: 'Invalid or expired token' });
    }
};
