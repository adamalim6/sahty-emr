
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { ArrowLeft, Save, Shield, CheckCircle } from 'lucide-react';

import { PAGE_REGISTRY } from '../../constants/pageRegistry';

export const RoleDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [role, setRole] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (id) loadRole(id);
    }, [id]);

    const loadRole = async (roleId: string) => {
        try {
            const data = await api.getRole(roleId);
            setRole(data);
        } catch (e) {
            console.error('Failed to load role', e);
        } finally {
            setLoading(false);
        }
    };

    const handlePermissionToggle = (pageId: string) => {
        if (!role) return;
        const currentPermissions = role.permissions || [];
        const hasPermission = currentPermissions.includes(pageId);
        
        const newPermissions = hasPermission
            ? currentPermissions.filter((p: string) => p !== pageId)
            : [...currentPermissions, pageId];
            
        setRole({ ...role, permissions: newPermissions });
    };

    const handleSave = async () => {
        setSaving(true);
        setSuccess(false);
        try {
            await api.updateRole(id!, role);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (e) {
            alert('Failed to save role');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div>Loading...</div>;
    if (!role) return <div>Role not found</div>;

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <button 
                onClick={() => navigate('/super-admin/roles')}
                className="flex items-center text-slate-500 hover:text-blue-600 transition-colors mb-6"
            >
                <ArrowLeft size={18} className="mr-2" /> Retour à la liste
            </button>

            <div className="flex justify-between items-start mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 flex items-center">
                        <Shield className="mr-3 text-violet-600" />
                        {role.name}
                    </h1>
                    <p className="text-slate-500 mt-2 max-w-2xl">{role.description}</p>
                </div>
                <button 
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center font-medium disabled:opacity-50"
                >
                    {success ? <CheckCircle size={20} className="mr-2" /> : <Save size={20} className="mr-2" />}
                    {success ? 'Enregistré' : 'Enregistrer'}
                </button>
            </div>

            <div className="space-y-8">
                {PAGE_REGISTRY.map((module) => (
                    <div key={module.module} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100">
                            <h3 className="font-bold text-slate-700 uppercase tracking-wider text-sm">{module.module}</h3>
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
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                className="sr-only peer"
                                                checked={isGranted}
                                                onChange={() => handlePermissionToggle(page.id)}
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
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
