
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { api } from '../services/api';

export enum UserType {
    PUBLISHER_SUPERADMIN = 'PUBLISHER_SUPERADMIN',
    TENANT_SUPERADMIN = 'TENANT_SUPERADMIN',
    TENANT_USER = 'TENANT_USER'
}

export interface User {
    id: string;
    username: string;
    nom: string;
    prenom: string;
    user_type: UserType;
    role_id: string;
    client_id?: string | null;
    permissions?: string[];
    service_ids?: string[]; // ADDED
}

interface AuthContextType {
    user: User | null;
    login: (credentials: any) => Promise<User>;
    logout: () => void;
    isAuthenticated: boolean;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const initAuth = async () => {
            const token = localStorage.getItem('token');
            if (token) {
                try {
                    const response = await fetch('http://localhost:3001/api/auth/me', {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    
                    if (response.ok) {
                        const userData = await response.json();
                        setUser(userData);
                    } else {
                        console.warn(`[AuthContext] Token invalid (Status ${response.status}). Logging out.`);
                        // Only logout on 401/403
                        if (response.status === 401 || response.status === 403) {
                             localStorage.removeItem('token');
                        }
                    }
                } catch (e: any) {
                    console.error("[AuthContext] Session check failed (Network):", e);
                    // Do NOT logout on network error, keep token for retry
                }
            }
            setLoading(false);
        };
        initAuth();
    }, []);

    const login = async (credentials: any) => {
        const { token, user } = await api.login(credentials);
        localStorage.setItem('token', token);
        setUser(user);
        return user;
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('token');
        window.location.href = '/login';
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
