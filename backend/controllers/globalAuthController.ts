import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { globalAdminService } from '../services/globalAdminService';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export const loginGlobalAdmin = async (req: Request, res: Response) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required' });
        }

        const user = await globalAdminService.authenticate(username, password);
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        if (user.role_code !== 'SUPER_ADMIN') {
             // Security Trap: A non-superadmin managed to get into the global file?
             // Should not happen if we seed correctly.
             return res.status(403).json({ message: 'Access Denied: Not a Super Admin' });
        }

        const token = jwt.sign(
            { 
                userId: user.id, 
                username: user.username, 
                role: 'SUPER_ADMIN', // Generic Role
                realm: 'global'      // 🔐 REALM CLAIM
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                nom: user.nom,
                prenom: user.prenom,
                role: 'SUPER_ADMIN'
            }
        });
    } catch (error) {
        console.error('Global login error:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
};
