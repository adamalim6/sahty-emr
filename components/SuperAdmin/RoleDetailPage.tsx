
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
        // Validation: Must have at least one permission
        if (!role.permissions || role.permissions.length === 0) {
            alert("Erreur de validation : Le rôle doit avoir accès à au moins une page.");
            return;
        }

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
                {PAGE_REGISTRY.filter(m => m.module !== 'Super Admin').map((module) => {
                    // Map registry names to internal Module Codes
                    let moduleCode = '';
                    if (module.module === 'Paramètres Tenant (DSI)') moduleCode = 'SETTINGS';
                    else if (module.module.startsWith('EMR')) moduleCode = 'EMR';
                    else if (module.module === 'Pharmacie') moduleCode = 'PHARMACY';
                    else if (module.module === 'Super Admin') moduleCode = 'SUPER_ADMIN';

                    const currentModules = role.modules || [];
                    const isModuleActive = currentModules.includes(moduleCode);

                    // Mutual Exclusivity Logic: Single Module per Role
                    // We enforce that a Global Role can only target ONE functional area.
                    const EXCLUSIVE_GROUP = ['EMR', 'PHARMACY', 'SETTINGS'];
                    const isExclusiveContext = EXCLUSIVE_GROUP.includes(moduleCode);
                    const otherExclusiveActive = isExclusiveContext 
                        ? currentModules.some((m: string) => EXCLUSIVE_GROUP.includes(m) && m !== moduleCode)
                        : false;

                    const handleModuleToggle = () => {
                        const newActive = !isModuleActive;
                        let newModules = [...currentModules];
                        let newPermissions = [...(role.permissions || [])];

                        if (newActive) {
                            // Turning ON
                            newModules.push(moduleCode);
                            // No permissions added by default, user must select them
                        } else {
                            // Turning OFF
                            newModules = newModules.filter((m: string) => m !== moduleCode);
                            // Remove all permissions belonging to this module
                            const modulePageIds = module.pages.map(p => p.id);
                            newPermissions = newPermissions.filter(p => !modulePageIds.includes(p));
                        }

                        setRole({ ...role, modules: newModules, permissions: newPermissions });
                    };

                    return (
                        <div key={module.module} className={`bg-white rounded-xl border transition-colors overflow-hidden ${isModuleActive ? 'border-blue-200 shadow-md' : 'border-slate-200 shadow-sm'}`}>
                            <div className={`px-6 py-4 border-b flex items-center justify-between ${isModuleActive ? 'bg-blue-50/50 border-blue-100' : 'bg-slate-50 border-slate-100'}`}>
                                <h3 className={`font-bold uppercase tracking-wider text-sm ${isModuleActive ? 'text-blue-700' : 'text-slate-500'}`}>
                                    {module.module}
                                </h3>
                                {/* Module Toggle Switch */}
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only peer"
                                        checked={isModuleActive}
                                        // Only disable if I'm OFF and some other exclusive is ON.
                                        // If I'm ON, I should be able to turn myself OFF regardless of conflicts.
                                        disabled={!isModuleActive && otherExclusiveActive}
                                        onChange={handleModuleToggle}
                                    />
                                    <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer 
                                        peer-checked:after:translate-x-full peer-checked:after:border-white 
                                        after:content-[''] after:absolute after:top-[2px] after:left-[2px] 
                                        after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all 
                                        ${(!isModuleActive && otherExclusiveActive) ? 'opacity-50 cursor-not-allowed' : 'peer-checked:bg-blue-600'}`}>
                                    </div>
                                    {(!isModuleActive && otherExclusiveActive) && <span className="ml-2 text-xs text-red-400 font-medium">(Incompatible)</span>}
                                </label>
                            </div>
                            
                            <div className="divide-y divide-slate-100">
                                {module.pages.map(page => {
                                    const isGranted = (role.permissions || []).includes(page.id);
                                    return (
                                        <div key={page.id} className={`p-6 flex items-center justify-between transition-colors ${isModuleActive ? 'hover:bg-slate-50' : 'opacity-50 grayscale'}`}>
                                            <div>
                                                <p className={`font-medium ${isModuleActive ? 'text-slate-800' : 'text-slate-400'}`}>{page.name}</p>
                                                <p className="text-sm text-slate-500">{page.description}</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    className="sr-only peer"
                                                    checked={isGranted}
                                                    disabled={!isModuleActive}
                                                    onChange={() => handlePermissionToggle(page.id)}
                                                />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                            </label>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
