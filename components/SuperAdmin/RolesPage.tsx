
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { Plus, Shield, Search } from 'lucide-react';

export const RolesPage: React.FC = () => {
    const navigate = useNavigate();
    const [roles, setRoles] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newRole, setNewRole] = useState({ name: '', description: '' });

    useEffect(() => {
        loadRoles();
    }, []);

    const loadRoles = async () => {
        try {
            const data = await api.getRoles();
            setRoles(data);
        } catch (e) {
            console.error('Failed to load roles', e);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.createRole(newRole);
            setIsModalOpen(false);
            setNewRole({ name: '', description: '' });
            loadRoles();
        } catch (e) {
            alert('Error creating role');
        }
    };

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Rôles Globaux</h1>
                    <p className="text-slate-500">Définition des profils et permissions</p>
                </div>
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
                >
                    <Plus size={20} />
                    <span>Nouveau Rôle</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {roles.map(role => (
                    <div 
                        key={role.id}
                        onClick={() => navigate(`/super-admin/roles/${role.id}`)}
                        className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                    >
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

            {/* Create Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl max-w-md w-full p-6">
                        <h2 className="text-xl font-bold mb-4">Nouveau Rôle</h2>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Nom du Rôle</label>
                                <input 
                                    type="text" 
                                    className="w-full border rounded-lg p-2"
                                    value={newRole.name}
                                    onChange={e => setNewRole({...newRole, name: e.target.value})}
                                    required 
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Description</label>
                                <textarea 
                                    className="w-full border rounded-lg p-2"
                                    value={newRole.description}
                                    onChange={e => setNewRole({...newRole, description: e.target.value})}
                                />
                            </div>
                            <div className="flex justify-end space-x-3 pt-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600">Annuler</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg">Créer</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
