/**
 * Auth Controller - Refactored to use AuthService
 * Handles login and session management endpoints.
 */

import { Request, Response } from 'express';
import { authService } from '../services/authService';
import { authUserRepository } from '../repositories/authUserRepository';
import { globalAdminService } from '../services/globalAdminService';
import { settingsService } from '../services/settingsService';

// ─────────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────────

export const login = async (req: Request, res: Response) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        const result = await authService.login(username, password);

        if (!result) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Enrich response with client country if available
        let clientCountry = 'MAROC';
        if (result.tenantId) {
            try {
                const client = await globalAdminService.getClientById(result.tenantId);
                if (client?.country) clientCountry = client.country;
            } catch {
                // Ignore
            }
        }

        return res.json({
            token: result.token,
            user: {
                ...result.user,
                role: result.user.role_code,
                realm: result.realm,
                modules: result.modules,
                permissions: result.permissions,
                client_country: clientCountry
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Server error during login.' });
    }
};

// ─────────────────────────────────────────────────────────────────
// SESSION CHECK (/me)
// ─────────────────────────────────────────────────────────────────

export const me = async (req: any, res: Response) => {
    try {
        const tenantId = req.user?.tenantId || req.user?.client_id;
        const userId = req.user?.userId;
        const realm = req.user?.realm;

        if (!userId) {
            return res.status(401).json({ error: 'Invalid session' });
        }

        // Get user from appropriate source
        const user = await authService.getUserById(
            userId,
            realm === 'global' ? 'global' : 'tenant',
            tenantId
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Build response with role info
        let modules: string[] = [];
        let permissions: string[] = [];
        let roleCode = user.role_code;

        if (realm === 'tenant' && tenantId) {
            // Get role details for tenant users
            try {
                const roles = await settingsService.getRoles(tenantId);
                const userRole = roles.find(r => r.id === user.role_id);
                
                if (userRole) {
                    modules = (userRole as any).modules || [];
                    permissions = (userRole as any).permissions || [];
                    roleCode = userRole.code;
                } else if (user.role_id) {
                    // Try global role
                    const globalRole = await globalAdminService.getGlobalRole(user.role_id);
                    if (globalRole) {
                        modules = globalRole.modules || [];
                        permissions = globalRole.permissions || [];
                        roleCode = globalRole.code;
                    }
                }
            } catch {
                // Use defaults
            }

            // Default modules for tenant admins
            if (user.user_type === 'TENANT_SUPERADMIN' && modules.length === 0) {
                modules = ['SETTINGS', 'PHARMACY', 'EMR'];
            }
        }

        return res.json({
            id: user.id,
            username: user.username,
            nom: user.nom,
            prenom: user.prenom,
            user_type: user.user_type,
            role_code: roleCode,
            role_id: user.role_id,
            tenantId: user.tenantId,
            service_ids: user.service_ids,
            modules,
            permissions,
            realm,
            client_country: 'MAROC'
        });

    } catch (error) {
        console.error('Error in /me:', error);
        return res.status(500).json({ error: 'Session validation failed' });
    }
};
