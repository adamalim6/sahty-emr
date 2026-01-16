
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { ArrowLeft, Shield, Info, Lock } from 'lucide-react';
import { PAGE_REGISTRY } from '../../constants/pageRegistry';

export const ReadOnlyRoleDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [role, setRole] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) loadRole(id);
    }, [id]);

    const loadRole = async (roleId: string) => {
        try {
            const data = await api.getSettingsRole(roleId);
            setRole(data);
        } catch (e) {
            console.error('Failed to load role', e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div>Chargement...</div>;
    if (!role) return <div>Rôle introuvable</div>;

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <button 
                onClick={() => navigate('/settings/roles')}
                className="flex items-center text-slate-500 hover:text-blue-600 transition-colors mb-6"
            >
                <ArrowLeft size={18} className="mr-2" /> Retour à la liste
            </button>

            {/* Banner Info */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-8 flex items-start">
                <Info className="text-blue-600 mt-1 mr-3 flex-shrink-0" size={20} />
                <div>
                    <h4 className="font-bold text-blue-900">Mode Consultation</h4>
                    <p className="text-blue-800 text-sm">
                        Les rôles et permissions sont définis globalement par l’éditeur du système.
                        Cette vue est consultative. Aucune modification n'est possible depuis ce contexte.
                    </p>
                </div>
            </div>

            <div className="flex justify-between items-start mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 flex items-center">
                        <Shield className="mr-3 text-slate-600" />
                        {role.name}
                        <span className="ml-3 text-xs bg-slate-100 text-slate-600 border border-slate-200 px-2 py-1 rounded-full flex items-center">
                            <Lock size={12} className="mr-1" /> Lecture Seule
                        </span>
                    </h1>
                    <p className="text-slate-500 mt-2 max-w-2xl">{role.description}</p>
                </div>
            </div>

            <div className="space-y-8">
                {PAGE_REGISTRY.map((module) => (
                    <div key={module.module} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden opacity-90">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-slate-700 uppercase tracking-wider text-sm">{module.module}</h3>
                            <Lock size={14} className="text-slate-400" />
                        </div>
                        <div className="divide-y divide-slate-100">
                            {module.pages.map(page => {
                                const isGranted = (role.permissions || []).includes(page.id);
                                return (
                                    <div key={page.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                        <div>
                                            <p className="font-medium text-slate-800">{page.name}</p>
                                            <p className="text-sm text-slate-500">{page.description}</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-not-allowed">
                                            <input 
                                                type="checkbox" 
                                                className="sr-only peer"
                                                checked={isGranted}
                                                disabled
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-400"></div>
                                        </label>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
