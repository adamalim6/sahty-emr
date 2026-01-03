
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { Shield, Lock } from 'lucide-react';

export const RolesPage: React.FC = () => {
    const navigate = useNavigate();
    const [roles, setRoles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadRoles();
    }, []);

    const loadRoles = async () => {
        try {
            const data = await api.getRoles();
            setRoles(data);
        } catch (e) {
            console.error('Failed to load roles', e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8">Chargement...</div>;

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Rôles Globaux</h1>
                    <p className="text-slate-500">Consultation des profils et permissions définis par l'éditeur</p>
                </div>
                {/* No Create Button for Tenant */}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {roles.map(role => (
                    <div 
                        key={role.id}
                        onClick={() => navigate(`/settings/roles/${role.id}`)}
                        className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
                    >
                        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded-full flex items-center border border-slate-200">
                                <Lock size={10} className="mr-1" /> Lecture seule
                            </span>
                        </div>
                        
                        <div className="flex items-start justify-between mb-4">
                            <div className="p-3 bg-violet-50 rounded-lg group-hover:bg-violet-100 transition-colors">
                                <Shield className="text-violet-600" size={24} />
                            </div>
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-2 group-hover:text-violet-600 transition-colors">{role.name}</h3>
                        <p className="text-sm text-slate-500 line-clamp-2">{role.description || 'Aucune description'}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};
