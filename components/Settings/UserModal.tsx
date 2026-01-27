import React, { useState, useEffect } from 'react';

interface UserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (formData: any) => Promise<void>;
    user?: any; // If editing
    roles: any[]; // Filtered assignable roles for dropdown
    allRoles?: any[]; // All roles for isDSI lookup
    services: any[];
    lockedServiceId?: string; // New: For Service Personnel Tab context
}

export const UserModal: React.FC<UserModalProps> = ({ 
    isOpen, 
    onClose, 
    onSave, 
    user, 
    roles, 
    allRoles,
    services,
    lockedServiceId 
}) => {
    // Use allRoles (if provided) for DSI lookup, fallback to roles
    const lookupRoles = allRoles || roles;
    // Determine if DSI (Super Admin of Tenant) which has protections
    const isDSI = (u: any) => {
        if (!u || !u.role_id) return false;
        // Legacy Check
        if (u.role_id === 'role_admin_struct') return true;
        // Dynamic Check via lookupRoles (includes all roles for proper resolution)
        const role = lookupRoles.find(r => r.id === u.role_id);
        return role?.code === 'ADMIN_STRUCTURE';
    };

    const [formData, setFormData] = useState({
        username: '',
        password: '',
        nom: '',
        prenom: '',
        role_id: '',
        INPE: '',
        active: true,
        service_ids: [] as string[]
    });

    // RBAC: Always exclude system roles (SUPER_ADMIN, ADMIN_STRUCTURE) by code.
    // These roles can only be assigned by SuperAdmin during tenant creation.
    const SYSTEM_ROLE_CODES = ['SUPER_ADMIN', 'ADMIN_STRUCTURE'];
    const displayedRoles = roles.filter(r => !SYSTEM_ROLE_CODES.includes(r.code));

    useEffect(() => {
        if (isOpen) {
            if (user) {
                // Edit Mode
                setFormData({
                    username: user.username,
                    password: '', // Don't show hash
                    nom: user.nom,
                    prenom: user.prenom,
                    role_id: user.role_id,
                    INPE: user.INPE || '',
                    active: user.active !== undefined ? user.active : true,
                    service_ids: user.service_ids || []
                });
            } else {
                // Create Mode
                setFormData({
                    username: '',
                    password: '',
                    nom: '',
                    prenom: '',
                    role_id: displayedRoles.length > 0 ? displayedRoles[0].id : '',
                    INPE: '',
                    active: true,
                    service_ids: lockedServiceId ? [lockedServiceId] : []
                });
            }
        }
    }, [isOpen, user, roles, lockedServiceId]); // roles/displayedRoles dependency implied

    const handleChange = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleServiceToggle = (serviceId: string, checked: boolean) => {
        let newIds = formData.service_ids;
        
        if (checked) {
            if (!newIds.includes(serviceId)) newIds = [...newIds, serviceId];
        } else {
            // Cannot deselect locked service
            if (lockedServiceId && serviceId === lockedServiceId) return;
            newIds = newIds.filter(id => id !== serviceId);
        }
        
        setFormData(prev => ({ ...prev, service_ids: newIds }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await onSave(formData);
        } catch (e) {
            console.error(e); // Let parent handle alert if needed or rethrow
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-800">
                        {user ? (isDSI(user) ? 'Détails Administrateur' : 'Modifier Utilisateur') : 'Nouvel Utilisateur'}
                    </h2>
                    {user && isDSI(user) && (
                        <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full border border-amber-200">
                            Lecture Seule
                        </span>
                    )}
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* DSI Warning */}
                    {user && isDSI(user) && (
                        <div className="bg-blue-50 text-blue-800 text-sm p-3 rounded-lg border border-blue-100 mb-4">
                            Ce compte est l'administrateur principal de la structure. Ses informations sont protégées.
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nom</label>
                            <input 
                                type="text" className="w-full border rounded-lg p-2 bg-slate-50" 
                                value={formData.nom}
                                onChange={e => handleChange('nom', e.target.value)}
                                disabled={user && isDSI(user)}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Prénom</label>
                            <input 
                                type="text" className="w-full border rounded-lg p-2 bg-slate-50"
                                value={formData.prenom}
                                onChange={e => handleChange('prenom', e.target.value)}
                                disabled={user && isDSI(user)}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Rôle</label>
                        {user && isDSI(user) ? (
                            <div className="w-full border rounded-lg p-2 bg-slate-100 text-slate-600">
                                Administrateur Structure
                            </div>
                        ) : (
                            <select 
                                className="w-full border rounded-lg p-2"
                                value={formData.role_id}
                                onChange={e => handleChange('role_id', e.target.value)}
                                disabled={user && isDSI(user)}
                            >
                                {displayedRoles.map(role => (
                                    <option key={role.id} value={role.id}>{role.name}</option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Identifiant</label>
                            <input 
                                type="text" className="w-full border rounded-lg p-2 bg-slate-50"
                                value={formData.username}
                                onChange={e => handleChange('username', e.target.value)}
                                disabled={user && isDSI(user)}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Mot de passe</label>
                            <input 
                                type="password" className="w-full border rounded-lg p-2"
                                value={formData.password}
                                onChange={e => handleChange('password', e.target.value)}
                                placeholder={user ? "(Laisser vide pour ne pas changer)" : ""}
                                disabled={user && isDSI(user)}
                                required={!user}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Service(s) Affecté(s) (Optionnel)</label>
                        <div className="border rounded-lg p-3 max-h-32 overflow-y-auto space-y-2 bg-slate-50">
                            {services.length === 0 ? (
                                <p className="text-xs text-slate-400 italic">Aucun service configuré.</p>
                            ) : (
                                services.map(service => {
                                    const isLocked = lockedServiceId === service.id;
                                    return (
                                        <label key={service.id} className="flex items-center space-x-2 cursor-pointer hover:bg-slate-100 p-1 rounded">
                                            <input 
                                                type="checkbox"
                                                checked={formData.service_ids.includes(service.id)}
                                                onChange={e => handleServiceToggle(service.id, e.target.checked)}
                                                disabled={(user && isDSI(user)) || isLocked}
                                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className={`text-sm ${isLocked ? 'font-bold text-blue-700' : 'text-slate-700'}`}>
                                                {service.name} {isLocked && '(Requis)'}
                                            </span>
                                        </label>
                                    );
                                })
                            )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">L'utilisateur pourra accéder aux données de ces services.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">INPE (Médecins uniquement)</label>
                        <input 
                            type="text" className="w-full border rounded-lg p-2"
                            value={formData.INPE}
                            onChange={e => handleChange('INPE', e.target.value)}
                            disabled={user && isDSI(user)}
                        />
                    </div>

                    {/* Active Toggle (Not for DSI) */}
                    {(!user || !isDSI(user)) && (
                        <div className="flex items-center space-x-3 pt-2">
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    className="sr-only peer"
                                    checked={formData.active}
                                    onChange={e => handleChange('active', e.target.checked)}
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                <span className="ml-3 text-sm font-medium text-slate-900">
                                    {formData.active ? 'Compte Actif' : 'Compte Désactivé'}
                                </span>
                            </label>
                        </div>
                    )}

                    <div className="flex justify-end space-x-3 pt-6 border-t border-slate-100 mt-4">
                        <button 
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium"
                        >
                            Fermer
                        </button>
                        {(!user || !isDSI(user)) && (
                            <button 
                                type="submit"
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm font-medium transition-colors"
                            >
                                {user ? 'Enregistrer les modifications' : 'Créer Utilisateur'}
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
};
