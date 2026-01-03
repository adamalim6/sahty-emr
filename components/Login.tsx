
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Building2, ShieldCheck, Stethoscope } from 'lucide-react';

export const Login: React.FC = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            const user = await login({ username, password });
            
            // Intelligent Redirection
            if (user.user_type === 'PUBLISHER_SUPERADMIN') {
                navigate('/super-admin');
            } else if (user.user_type === 'TENANT_SUPERADMIN') {
                navigate('/settings');
            } else if (user.role_id === 'role_pharmacien') {
                navigate('/pharmacy');
            } else {
                // Default EMR View (Doctors, Nurses)
                navigate('/');
            }
        } catch (err: any) {
            setError(err.message || 'Login failed');
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="bg-blue-600 p-8 text-center">
                    <h1 className="text-3xl font-bold text-white mb-2">SAHTY EMR</h1>
                    <p className="text-blue-100">Système d'Information Hospitalier</p>
                </div>
                
                <div className="p-8">
                    <div className="flex justify-center space-x-4 mb-8">
                         <div className="flex flex-col items-center justify-center p-3 bg-slate-50 rounded-lg border border-slate-200 w-24">
                            <ShieldCheck className="text-purple-600 h-6 w-6 mb-1" />
                            <span className="text-[10px] text-slate-500 font-medium">Admin</span>
                         </div>
                         <div className="flex flex-col items-center justify-center p-3 bg-slate-50 rounded-lg border border-slate-200 w-24">
                            <Building2 className="text-blue-600 h-6 w-6 mb-1" />
                            <span className="text-[10px] text-slate-500 font-medium">Tenant</span>
                         </div>
                         <div className="flex flex-col items-center justify-center p-3 bg-slate-50 rounded-lg border border-slate-200 w-24">
                            <Stethoscope className="text-emerald-600 h-6 w-6 mb-1" />
                            <span className="text-[10px] text-slate-500 font-medium">Soignants</span>
                         </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nom d'utilisateur</label>
                            <input 
                                type="text" 
                                className="w-full rounded-lg border-slate-300 border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                placeholder="ex: admin"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Mot de passe</label>
                            <input 
                                type="password" 
                                className="w-full rounded-lg border-slate-300 border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                            />
                        </div>

                        {error && (
                            <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg flex items-center">
                                ⚠️ {error}
                            </div>
                        )}

                        <button 
                            type="submit" 
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors shadow-lg shadow-blue-600/20"
                        >
                            Se Connecter
                        </button>
                    </form>
                    
                    <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                        <p className="text-xs text-slate-400">
                             SAHTY EMR © 2025 • Secured Environment
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
