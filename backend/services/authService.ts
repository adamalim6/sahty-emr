/**
 * AuthService - Centralized Authentication Business Logic
 * Encapsulates login, password validation, and token generation.
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authUserRepository } from '../repositories/authUserRepository';
import { globalAdminService } from './globalAdminService';
import { User } from '../models/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-in-prod';

export interface LoginResult {
    token: string;
    user: Omit<User, 'password_hash'>;
    realm: 'global' | 'tenant';
    tenantId?: string | null;
    modules?: string[];
    permissions?: string[];
}

class AuthService {
    private static instance: AuthService;

    public static getInstance(): AuthService {
        if (!AuthService.instance) {
            AuthService.instance = new AuthService();
        }
        return AuthService.instance;
    }

    // ─────────────────────────────────────────────────────────────────
    // PASSWORD UTILITIES
    // ─────────────────────────────────────────────────────────────────

    /**
     * Validate password against hash
     */
    validatePassword(plainPassword: string, hash: string): boolean {
        return bcrypt.compareSync(plainPassword, hash);
    }

    /**
     * Hash a plain password
     */
    hashPassword(plainPassword: string): string {
        return bcrypt.hashSync(plainPassword, 10);
    }

    // ─────────────────────────────────────────────────────────────────
    // TOKEN GENERATION
    // ─────────────────────────────────────────────────────────────────

    /**
     * Generate JWT token
     */
    generateToken(
        user: User,
        realm: 'global' | 'tenant',
        options?: {
            tenantId?: string;
            modules?: string[];
            permissions?: string[];
            service_ids?: string[];
        }
    ): string {
        const payload: any = {
            userId: user.id,
            username: user.username,
            role: user.role_code || 'USER',
            realm,
            user_type: user.user_type
        };

        if (realm === 'tenant') {
            payload.tenantId = options?.tenantId || user.tenantId;
            payload.modules = options?.modules || [];
            payload.permissions = options?.permissions || [];
            payload.role_id = user.role_id;
            payload.service_ids = options?.service_ids || user.service_ids || [];
        }

        const expiresIn = realm === 'global' ? '24h' : '12h';
        return jwt.sign(payload, JWT_SECRET, { expiresIn });
    }

    // ─────────────────────────────────────────────────────────────────
    // LOGIN FLOW
    // ─────────────────────────────────────────────────────────────────

    /**
     * Main login method - tries Global DB first, then Tenant DBs
     */
    async login(username: string, password: string): Promise<LoginResult | null> {
        // 1. Try Global DB (SuperAdmin + Tenant Admins)
        const globalUser = await authUserRepository.findByUsername(username, 'global');
        
        if (globalUser && this.validatePassword(password, globalUser.password_hash)) {
            // Determine if this is a Tenant Admin or Global SuperAdmin
            const isTenantAdmin = globalUser.tenantId && globalUser.tenantId !== 'GLOBAL';
            const realm = isTenantAdmin ? 'tenant' : 'global';
            
            // Default modules for tenant admins
            const modules = isTenantAdmin ? ['SETTINGS', 'PHARMACY', 'EMR'] : [];

            const token = this.generateToken(globalUser, realm, {
                tenantId: globalUser.tenantId ?? undefined,
                modules
            });

            const { password_hash, ...safeUser } = globalUser;
            return {
                token,
                user: safeUser,
                realm,
                tenantId: globalUser.tenantId ?? undefined,
                modules
            };
        }

        // 2. Try Tenant DBs (Regular Users)
        const clients = await globalAdminService.getAllClients();
        
        for (const client of clients) {
            const tenantId = client.id;
            try {
                const tenantUser = await authUserRepository.findByUsername(username, tenantId);
                
                if (tenantUser && this.validatePassword(password, tenantUser.password_hash)) {
                    // Get role info for permissions/modules
                    const { settingsService } = await import('./settingsService');
                    const roles = await settingsService.getRoles(tenantId);
                    let userRole = roles.find(r => r.id === tenantUser.role_id);
                    
                    // Fallback to global role
                    if (!userRole && tenantUser.role_id) {
                        userRole = await globalAdminService.getGlobalRole(tenantUser.role_id);
                    }

                    const permissions = (userRole as any)?.permissions || [];
                    const modules = (userRole as any)?.modules || [];

                    const token = this.generateToken(tenantUser, 'tenant', {
                        tenantId,
                        modules,
                        permissions,
                        service_ids: tenantUser.service_ids
                    });

                    const { password_hash, ...safeUser } = tenantUser;
                    return {
                        token,
                        user: safeUser,
                        realm: 'tenant',
                        tenantId,
                        modules,
                        permissions
                    };
                }
            } catch (err) {
                // Tenant DB might not exist or be accessible, continue
                console.error(`Auth: Error checking tenant ${tenantId}:`, (err as Error).message);
            }
        }

        // 3. Not found anywhere
        return null;
    }

    /**
     * Validate an existing token and return user data
     */
    verifyToken(token: string): any | null {
        try {
            return jwt.verify(token, JWT_SECRET);
        } catch {
            return null;
        }
    }

    /**
     * Get user by ID from appropriate database
     */
    async getUserById(userId: string, realm: 'global' | 'tenant', tenantId?: string): Promise<User | null> {
        if (realm === 'global') {
            return authUserRepository.findById(userId, 'global');
        } else if (tenantId) {
            // Try tenant DB first
            const tenantUser = await authUserRepository.findById(userId, tenantId);
            if (tenantUser) return tenantUser;
            
            // Fallback to global DB (for Tenant Admins)
            return authUserRepository.findById(userId, 'global');
        }
        return null;
    }
}

export const authService = AuthService.getInstance();
