
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
            // Unified Login Logic
            // The system (backend) determines if I am Admin or Tenant
            const user = await login({ username, password });
            
            // Deterministic Routing Logic
            // Priority: Super Admin -> Tenant Admin -> Module Specific Roles -> Default EMR

            // 1. Super Admin (Global Realm)
            if (user.role_id === 'role_super_admin' || user.user_type === 'SUPER_ADMIN') {
                 navigate('/super-admin');
                 return;
            }

            // 2. Tenant Admin (Settings Manager)
            if (user.role_id === 'role_admin_struct' || user.user_type === 'TENANT_SUPERADMIN') {
                 navigate('/settings');
                 return;
            }

            // 3. Pharmacy User (Check Permission)
            if (user.role_id === 'role_pharmacien' || user.permissions?.includes('ph_dashboard')) {
                 navigate('/pharmacy');
                 return;
            }

            // 4. EMR Users (Check Permission)
            if (['role_medecin', 'role_infirmier'].includes(user.role_id) || user.permissions?.includes('emr_patients')) {
                 navigate('/'); // Root routes to EMR App
                 return;
            }

            // 5. LIMS Users (Laboratory Configuration)
            if (user.modules?.includes('LIMS') || user.permissions?.includes('lims_parametres')) {
                 navigate('/lims/parametres');
                 return;
            }

            // 6. Fallback
            navigate('/');

        } catch (err: any) {
            setError(err.message || 'Authentication failed');
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
                    <p className="text-center text-slate-500 mb-6 text-sm">
                        Please sign in to continue
                    </p>

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
