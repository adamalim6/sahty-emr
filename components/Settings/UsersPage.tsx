
import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Plus, Search, User, Shield } from 'lucide-react';
import { UserModal } from './UserModal';

export const UsersPage: React.FC = () => {
    const [users, setUsers] = useState<any[]>([]);
    const [roles, setRoles] = useState<any[]>([]);
    const [services, setServices] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    const [editingUser, setEditingUser] = useState<any>(null);

    // Removed local formData state as it's now handled in UserModal

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [usersData, rolesData, servicesData] = await Promise.all([
                api.getTenantUsers(),
                api.getGlobalRoles(), // Ensure this API endpoint is accessible to Tenant Admin
                api.getServices()
            ]);
            
            // Filter out restricted roles (Super Admin & Admin Structure)
            // These roles are reserved for Publisher or assigned during client creation.
            const restrictedRoles = ['role_super_admin', 'role_admin_struct'];
            const allowedRoles = rolesData.filter((r: any) => !restrictedRoles.includes(r.id));
            
            setRoles(allowedRoles);
            if (allowedRoles.length > 0) {
                // Role handling moved to Modal or default state if needed
                // setFormData(prev => ({ ...prev, role_id: allowedRoles[0].id }));
            }
            setUsers(usersData);
            setServices(servicesData);
        } catch (e) {
            console.error('Failed to load data', e);
        }
    };

    const openEditModal = (user: any) => {
        setEditingUser(user);
        setIsModalOpen(true);
    };

    const openCreateModal = () => {
        setEditingUser(null);
        setIsModalOpen(true);
    };

    const handleSaveUser = async (data: any) => {
        try {
            if (editingUser) {
                await api.updateTenantUser(editingUser.id, data);
            } else {
                await api.createTenantUser(data);
            }
            setIsModalOpen(false);
            loadData();
        } catch (e: any) {
            alert(e.message || 'Opération échouée');
        }
    };

    const getRoleName = (id: string) => roles.find(r => r.id === id)?.name || (id === 'role_admin_struct' ? 'Administrateur Structure' : id);
    const isDSI = (user: any) => user.role_id === 'role_admin_struct';

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Gestion des Utilisateurs</h1>
                    <p className="text-slate-500">Personnel de l'établissement</p>
                </div>
                <button 
                    onClick={openCreateModal}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
                >
                    <Plus size={20} />
                    <span>Nouvel Utilisateur</span>
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Utilisateur</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Role</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Service(s)</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Identifiant</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Statut</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {users.map(user => (
                            <tr 
                                key={user.id} 
                                onClick={() => openEditModal(user)}
                                className="hover:bg-slate-50 cursor-pointer transition-colors"
                            >
                                <td className="px-6 py-4">
                                    <div className="flex items-center space-x-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                                            (user.active === false) ? 'bg-slate-100 text-slate-400' : 'bg-blue-100 text-blue-600'
                                        }`}>
                                            {user.nom.charAt(0)}
                                        </div>
                                        <div>
                                            <p className={`text-sm font-medium ${
                                                (user.active === false) ? 'text-slate-500 line-through' : 'text-slate-900'
                                            }`}>
                                                {user.nom} {user.prenom}
                                                {isDSI(user) && <span className="ml-2 text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded border border-blue-200">DSI</span>}
                                            </p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
                                        <Shield size={12} />
                                        <span>{getRoleName(user.role_id)}</span>
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-wrap gap-1">
                                        {user.service_ids && user.service_ids.length > 0 ? (
                                            user.service_ids.map((sid: string) => {
                                                const service = services.find(s => s.id === sid);
                                                return service ? (
                                                    <span key={sid} className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                                        {service.name}
                                                    </span>
                                                ) : null;
                                            })
                                        ) : (
                                            <span className="text-xs text-slate-400 italic">-</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-500 font-mono">
                                    {user.username}
                                </td>
                                <td className="px-6 py-4">
                                    {user.active === false ? (
                                         <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full border border-red-100">Inactif</span>
                                    ) : (
                                         <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">Actif</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            <UserModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveUser}
                user={editingUser}
                roles={roles}
                services={services}
            />
        </div>
    );
};
