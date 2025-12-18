import React, { createContext, useContext, useState, ReactNode } from 'react';

export type UserRole = 'DOCTOR' | 'PHARMACIST';

export interface User {
    name: string;
    role: UserRole;
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
        const newUser: User = role === 'DOCTOR'
            ? { name: 'Dr. S. Alami', role: 'DOCTOR' }
            : { name: 'Pharmacien Chef', role: 'PHARMACIST' };

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
