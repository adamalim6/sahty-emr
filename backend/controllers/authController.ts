
import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/auth';

const USERS_FILE = path.join(__dirname, '../data/users.json');
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-in-prod';

const getUsers = (): User[] => {
    if (!fs.existsSync(USERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
};

export const login = (req: Request, res: Response) => {
    const { username, password } = req.body;
    const users = getUsers();
    const user = users.find(u => u.username === username);

    if (!user) {
        return res.status(401).json({ error: 'User not found' });
    }

    const validPassword = bcrypt.compareSync(password, user.password_hash);
    
    if (!validPassword) {
        return res.status(401).json({ error: 'Invalid password' });
    }

    const token = jwt.sign(
        { 
            id: user.id, 
            username: user.username, 
            user_type: user.user_type, 
            role_id: user.role_id,
            client_id: user.client_id 
        }, 
        JWT_SECRET, 
        { expiresIn: '8h' }
    );

    // Inject permissions
    const roles = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/roles.json'), 'utf-8'));
    const userRole = roles.find((r: any) => r.id === user.role_id);
    const permissions = userRole ? userRole.permissions : [];

    res.json({ token, user: { ...user, password_hash: undefined, permissions } });
};

export const me = (req: any, res: Response) => {
    // req.user is populated by authenticateToken
    // Re-fetch role permissions to ensure they are up to date
    try {
        const roles = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/roles.json'), 'utf-8'));
        const userRole = roles.find((r: any) => r.id === req.user.role_id);
        const permissions = userRole ? userRole.permissions : [];
        
        res.json({ ...req.user, permissions });
    } catch (error) {
        // Fallback if roles.json fails
        res.json(req.user);
    }
};
