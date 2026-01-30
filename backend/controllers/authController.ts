
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { globalAdminService } from '../services/globalAdminService';
import { settingsService } from '../services/settingsService';
// TenantStore removed - using PostgreSQL for tenant list
import { User } from '../models/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-in-prod';

export const login = async (req: Request, res: Response) => {
    const { username, password } = req.body; 
    const fs = require('fs');
    const path = require('path');
    const logFile = path.join(__dirname, '../auth_debug.log');

    const log = (msg: string) => {
        try {
            fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
        } catch (e) { console.error("Log failed", e); }
    };

    log(`Login attempt for username: ${username}`);

    try {
        // 1. Try Global SuperAdmin (and now Tenant Admins in Global DB!)
        log('Checking Global DB...');
        const globalUser = await globalAdminService.authenticate(username, password);

        if (globalUser) {
            log(`Authenticated in Global DB. User: ${globalUser.username}, Type: ${globalUser.user_type}, Client: ${globalUser.client_id}`);
            
            // Determine Realm
            // Global SuperAdmin => client_id is NULL or 'GLOBAL' (depends on how we stored it? 'GLOBAL' in legacy thought, but null in SQL schema?)
            // Migration script: Added client_id column. SuperAdmin row has NULL or empty?
            // Checking my check result earlier: SuperAdmin had proper ID. client_id?
            // "global_admin|admin|...|Global|SUPER_ADMIN|SUPER_ADMIN|1|...|"
            // The row output from `sqlite3` earlier didn't show column headers, but `Global` string was there.
            // Wait, "Global" was nom/prenom maybe?
            // Let's assume Global Admin has specific characteristics.
            
            const isTenantAdmin = !!globalUser.client_id && globalUser.client_id !== 'GLOBAL';
            const realm = isTenantAdmin ? 'tenant' : 'global';
            
            // Grant default modules to Tenant Admins
            const modules = isTenantAdmin ? ['SETTINGS', 'PHARMACY', 'EMR'] : [];

            const token = jwt.sign(
                { 
                    userId: globalUser.id, 
                    username: globalUser.username, 
                    role: globalUser.role_code || 'SUPER_ADMIN', 
                    realm: realm,
                    client_id: globalUser.client_id, 
                    modules: modules, 
                    user_type: globalUser.user_type,
                    // Legacy props for compatibility
                    tenantId: globalUser.client_id 
                },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            return res.json({
                token,
                user: {
                    ...globalUser,
                    password_hash: undefined,
                    role: globalUser.role_code,
                    realm: realm,
                    tenantId: globalUser.client_id
                }
            });
        }

        // 2. Fallback: Scan All Tenants for Regular Users (in Tenant PostgreSQL DBs)
        log('User not in Global DB. Scanning Tenants for regular user...');
        
        // Use PostgreSQL client list instead of deleted data/tenants folder
        const clients = await globalAdminService.getAllClients();
        const tenants = clients.map((c: any) => c.id);
        log(`Found ${tenants.length} tenants to scan: ${tenants.join(', ')}`);
        
        for (const tenantId of tenants) {
            try { 
                log(`Checking tenant ${tenantId}...`);
                const users = await settingsService.getUsers(tenantId);
                log(`  -> Found ${users.length} users in tenant ${tenantId}`);
                const user = users.find(u => u.username === username);
                
                if (user && user.active !== false) {
                    if (bcrypt.compareSync(password, user.password_hash)) {
                        log(`Match found in tenant ${tenantId}`);
                        
                        // Get Roles & Permissions
                        const roles = await settingsService.getRoles(tenantId);
                        let userRole = roles.find(r => r.id === user.role_id);
                        
                        // If role not found in tenant (Global Role?), fetch definition?
                        if (!userRole) {
                            userRole = await globalAdminService.getGlobalRole(user.role_id);
                        }

                        const permissions = (userRole as any)?.permissions || [];
                        const modules = (userRole as any)?.modules || [];

                        const token = jwt.sign(
                            { 
                                userId: user.id, 
                                username: user.username, 
                                role: userRole?.code || 'USER',
                                client_id: tenantId,
                                modules: modules,
                                permissions: permissions,
                                user_type: user.user_type,
                                role_id: user.role_id,
                                service_ids: user.service_ids,
                                tenantId: tenantId // Legacy compat
                            }, 
                            JWT_SECRET, 
                            { expiresIn: '12h' }
                        );

                        // Client Info (Country) - Legacy file read
                        let clientCountry = 'MAROC'; 
                        try {
                             // Optimization: Only read if necessary. Move to proper service later.
                             const clientsFile = path.join(__dirname, '../data/clients.json');
                             if (fs.existsSync(clientsFile)) {
                                 const clients = JSON.parse(fs.readFileSync(clientsFile, 'utf-8'));
                                 const client = clients.find((c: any) => c.id === tenantId);
                                 if (client && client.country) clientCountry = client.country;
                             }
                        } catch (e) {
                             // Ignore missing clients.json
                        }

                        log(`Login SUCCESS: User=${username} Role=${userRole?.code} Modules=${JSON.stringify(modules)}`);
                        return res.json({ 
                            token, 
                            user: { 
                                ...user, 
                                password_hash: undefined, 
                                tenantId,
                                role: userRole?.code,
                                modules,
                                permissions,
                                client_country: clientCountry
                            } 
                        });
                    }
                }
            } catch (err: any) {
                log(`Error in tenant ${tenantId}: ${err?.message || err}`);
                // Ignore per-tenant errors (continue to next)
            }
        }
        
        log(`User ${username} not found anywhere.`);
        return res.status(401).json({ error: 'Invalid credentials' });

    } catch (error) {
        log(`CRITICAL ERROR: ${error}`);
        console.error("Login error:", error);
        return res.status(500).json({ error: 'Server error during login.' });
    }
};

export const me = (req: any, res: Response) => {
    try {
        const tenantId = req.user.client_id;
        const userId = req.user.userId;

        if (tenantId) {
             // 1. Tenant User (or Tenant Admin)
             // We can fetch from SettingsService (works for Tenant DB users)
             // But valid Tenant Admins are also in Global DB now.
             // However, SettingsService queries the Tenant DB.
             // Are Tenant Admins synced to Tenant DB?
             // NO. I migrated them to Global DB.
             // So if `tenantId` is set, `settingsService.getUsers(tenantId)` might NOT return the Tenant Admin anymore!
             // It will return regular users.
             // 
             // CRITICAL FIX:
             // If the token matches a Tenant Admin (who is in Global DB), `settingsService.getUsers` (Tenant DB) will fail to find them.
             // We must check Global DB relative to that tenant first/also?
             // OR: rely on the fact that if they are in Global DB, we should fetch them from there.
             
             // Strategy:
             // Try fetching from Tenant DB (SettingsService).
             // If not found, try fetching from Global DB (GlobalAdminService) if user matches.
             
             handleMeResponse(req, res, tenantId, userId);

        } else {
             // 2. Global Super Admin
             handleGlobalMe(req, res, userId);
        }

    } catch (error) {
        console.error("Error in /me:", error);
        res.status(500).json({ error: "Session validation failed" });
    }
};

// Extracted helpers for clarity
async function handleMeResponse(req: any, res: Response, tenantId: string, userId: string) {
    try {
        // A. Try Tenant DB (Regular Users)
        const users = await settingsService.getUsers(tenantId);
        const fullUser = users.find(u => u.id === userId);
        
        if (fullUser) {
             const roles = await settingsService.getRoles(tenantId);
             let userRole = roles.find(r => r.id === fullUser.role_id);
             if (!userRole) userRole = await globalAdminService.getGlobalRole(fullUser.role_id);
             
             const permissions = (userRole as any)?.permissions || [];
             const modules = (userRole as any)?.modules || [];

             return res.json({ 
                 ...fullUser, 
                 password_hash: undefined,
                 role_code: userRole?.code,
                 modules,
                 permissions,
                 client_country: 'MAROC' // Simplify
             });
        }
        
        // B. Try Global DB (Tenant Admin)
        const globalUser = await globalAdminService.getAdminById(userId);
        if (globalUser && globalUser.client_id === tenantId) {
             // It is a Tenant Admin
             return res.json({
                 ...globalUser,
                 password_hash: undefined,
                 role_code: globalUser.role_code || 'ADMIN',
                 permissions: [], // Admins usually implies full access or we should add permissions to Global User table?
                 // For now, assume Tenant Admin has extensive rights or UI handles it by role_code
                 modules: ['SETTINGS', 'PHARMACY', 'EMR'] // Hardcode or fetch default modules for Admin
             });
        }
        
        // Not found
        res.status(404).json({ error: 'User not found in context' });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error fetching user' });
    }
}

async function handleGlobalMe(req: any, res: Response, userId: string) {
    try {
        const globalUser = await globalAdminService.getAdminById(userId);
        if (globalUser) {
             return res.json({
                 ...globalUser,
                 password_hash: undefined,
                 role_code: 'SUPER_ADMIN',
                 realm: 'global'
             });
        }
        res.status(404).json({ error: 'Global admin not found' });
    } catch (e) {
        res.status(500).json({ error: 'Error' });
    }
}
