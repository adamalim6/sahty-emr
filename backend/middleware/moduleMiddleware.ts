import { Request, Response, NextFunction } from 'express';

export const requireModule = (requiredModule: string) => {
    return (req: any, res: Response, next: NextFunction) => {
        const user = req.user;

        if (!user) {
            return res.status(401).json({ error: 'Unauthenticated' });
        }

        // Global Super Admins do NOT have access to tenant modules by default
        // unless they log in AS a tenant admin (which they can't via global login).
        // So we strictly check the modules array.
        
        // Ensure modules array exists
        const userModules = user.modules || [];

        // Tenant SuperAdmins have implicit access to all enabled modules
        if (user.user_type === 'TENANT_SUPERADMIN') {
            next();
            return;
        }

        // DSI (ADMIN_STRUCTURE) users have implicit access to all tenant modules
        // This is the "Administrateur Structure" role assigned during tenant creation
        if (user.role_code === 'ADMIN_STRUCTURE' || user.role_id === 'role_admin_struct') {
            next();
            return;
        }

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
