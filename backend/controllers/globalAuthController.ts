/**
 * Global Auth Controller - Refactored to use AuthService
 * Handles SuperAdmin-only login endpoint.
 */

import { Request, Response } from 'express';
import { authService } from '../services/authService';

export const loginGlobalAdmin = async (req: Request, res: Response) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required' });
        }

        const result = await authService.login(username, password);
        
        if (!result) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // This endpoint is for SuperAdmins only
        if (result.realm !== 'global') {
            return res.status(403).json({ message: 'Access Denied: Not a Super Admin' });
        }

        return res.json({
            token: result.token,
            user: {
                id: result.user.id,
                username: result.user.username,
                nom: result.user.nom,
                prenom: result.user.prenom,
                role: 'SUPER_ADMIN'
            }
        });

    } catch (error) {
        console.error('Global login error:', error);
        return res.status(500).json({ message: 'Server error during login' });
    }
};
