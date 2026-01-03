
import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Plus, Search, Building, Edit2, CheckCircle, XCircle } from 'lucide-react';

export const OrganismesPage: React.FC = () => {
    const [organismes, setOrganismes] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Form State
    const [formData, setFormData] = useState<any>({
        id: '',
        designation: '',
        category: 'ASSURANCE',
        sub_type: 'CLASSIQUE',
        active: true
    });
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const data = await api.getOrganismes();
            setOrganismes(data);
        } catch (e) {
            console.error('Failed to load organismes', e);
        }
    };

    const handleEdit = (org: any) => {
        setFormData(org);
        setIsEditing(true);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setFormData({
            designation: '',
            category: 'ASSURANCE',
            sub_type: 'CLASSIQUE',
            active: true
        });
        setIsEditing(false);
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (isEditing) {
                await api.updateOrganisme(formData.id, formData);
            } else {
                await api.createOrganisme(formData);
            }
            setIsModalOpen(false);
            loadData();
        } catch (e) {
            alert('Operation failed');
        }
    };

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        if (!window.confirm(`Voulez-vous ${currentStatus ? 'désactiver' : 'activer'} cet organisme ?`)) return;
        try {
            await api.toggleOrganismeStatus(id, !currentStatus);
            loadData();
        } catch (e) {
            alert('Failed to update status');
        }
    };

    const filteredOrganismes = organismes.filter(o => 
        o.designation.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Gestion des Organismes</h1>
                    <p className="text-slate-500">Assurances, Mutuelles et Organismes Conventionnés</p>
                </div>
                <button 
                    onClick={handleCreate}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
                >
                    <Plus size={20} />
                    <span>Nouvel Organisme</span>
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                        <input 
                            type="text" 
                            placeholder="Rechercher un organisme..." 
                            className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg w-full md:w-80 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Désignation</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Catégorie</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Sous-Type</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Statut</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredOrganismes.map(org => (
                                <tr key={org.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                                                <Building size={16} />
                                            </div>
                                            <span className="font-medium text-slate-900">{org.designation}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            org.category === 'ASSURANCE' 
                                                ? 'bg-purple-100 text-purple-800' 
                                                : 'bg-emerald-100 text-emerald-800'
                                        }`}>
                                            {org.category}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">
                                        {org.sub_type || '-'}
                                    </td>
                                    <td className="px-6 py-4">
                                        {org.active ? (
                                            <div className="flex items-center text-emerald-600 text-sm font-medium">
                                                <CheckCircle size={16} className="mr-1.5" />
                                                Actif
                                            </div>
                                        ) : (
                                            <div className="flex items-center text-slate-400 text-sm font-medium">
                                                <XCircle size={16} className="mr-1.5" />
                                                Inactif
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <button 
                                            onClick={() => handleEdit(org)}
                                            className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                                            title="Modifier"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                        <button 
                                            onClick={() => toggleStatus(org.id, org.active)}
                                            className={`p-1 transition-colors ${org.active ? 'text-slate-400 hover:text-red-500' : 'text-slate-400 hover:text-emerald-500'}`}
                                            title={org.active ? "Désactiver" : "Activer"}
                                        >
                                            {org.active ? <XCircle size={18} /> : <CheckCircle size={18} />}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredOrganismes.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                        Aucun organisme trouvé
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-800">
                                {isEditing ? 'Modifier Organisme' : 'Nouvel Organisme'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <XCircle size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Désignation</label>
                                <input 
                                    type="text" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none" required
                                    value={formData.designation}
                                    onChange={e => setFormData({...formData, designation: e.target.value})}
                                    placeholder="Ex: Wafa Assurance"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Catégorie</label>
                                    <select 
                                        className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formData.category}
                                        onChange={e => setFormData({...formData, category: e.target.value})}
                                    >
                                        <option value="ASSURANCE">Assurance</option>
                                        <option value="ORGANISME_CONVENTIONNE">Organisme Conventionné</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Sous-Type</label>
                                    <select 
                                        className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formData.sub_type}
                                        onChange={e => setFormData({...formData, sub_type: e.target.value})}
                                    >
                                        <option value="CLASSIQUE">Classique</option>
                                        <option value="PUBLIC">Public</option>
                                        <option value="MUTUELLE">Mutuelle</option>
                                        <option value="FONDATION">Fondation</option>
                                        <option value="MILITAIRE">Militaire</option>
                                        <option value="REASSURANCE">Réassurance</option>
                                        <option value="TAKAFUL">Takaful</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex justify-end space-x-3 pt-6 border-t border-slate-50 mt-4">
                                <button 
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    Annuler
                                </button>
                                <button 
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                                >
                                    {isEditing ? 'Enregistrer' : 'Créer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
