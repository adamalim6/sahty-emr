import React, { createContext, useContext, useState, ReactNode } from 'react';

export enum UserRole {
    DOCTOR = 'DOCTOR',
    PHARMACIST = 'PHARMACIST',
    NURSE = 'NURSE',
    ADMIN = 'ADMIN'
}

export interface User {
    name: string;
    role: UserRole;
    email?: string;
    id?: string;
}

interface AuthContextType {
    user: User | null;
    login: (role: UserRole) => void;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(() => {
        const stored = localStorage.getItem('sahty_user');
        return stored ? JSON.parse(stored) : null;
    });

    const login = (role: UserRole) => {
        const newUser: User = role === UserRole.DOCTOR
            ? { id: 'u1', name: 'Dr. S. Alami', role: UserRole.DOCTOR, email: 'dr.alami@hospital.com' }
            : { id: 'u2', name: 'Pharmacien Chef', role: UserRole.PHARMACIST, email: 'pharmacy@hospital.com' };

        setUser(newUser);
        localStorage.setItem('sahty_user', JSON.stringify(newUser));
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('sahty_user');
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
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
