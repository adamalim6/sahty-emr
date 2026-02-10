
import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Plus, Search, Edit2, Trash2, X, XCircle, FolderTree, Server, Cloud } from 'lucide-react';

interface Group {
    id: string;
    name: string;
    hosting_mode: 'SAHTY_HOSTED' | 'GROUP_HOSTED';
    description: string | null;
    created_at: string;
    updated_at: string;
}

const HOSTING_LABELS: Record<string, { label: string; color: string; bgColor: string }> = {
    SAHTY_HOSTED: { label: 'Sahty Hosted', color: 'text-blue-800', bgColor: 'bg-blue-100' },
    GROUP_HOSTED: { label: 'Group Hosted', color: 'text-purple-800', bgColor: 'bg-purple-100' },
};

export const GroupsPage: React.FC = () => {
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<Group | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        hosting_mode: 'SAHTY_HOSTED' as 'SAHTY_HOSTED' | 'GROUP_HOSTED',
        description: ''
    });
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadGroups();
    }, []);

    const loadGroups = async () => {
        try {
            const data = await api.getGroups();
            setGroups(data);
        } catch (e) {
            console.error('Failed to load groups', e);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (group?: Group) => {
        if (group) {
            setEditingGroup(group);
            setFormData({
                name: group.name,
                hosting_mode: group.hosting_mode,
                description: group.description || ''
            });
        } else {
            setEditingGroup(null);
            setFormData({ name: '', hosting_mode: 'SAHTY_HOSTED', description: '' });
        }
        setError(null);
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSaving(true);
        try {
            if (editingGroup) {
                await api.updateGroup(editingGroup.id, formData);
            } else {
                await api.createGroup(formData);
            }
            setIsModalOpen(false);
            loadGroups();
        } catch (err: any) {
            setError(err.message || 'Une erreur est survenue');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce groupe ?')) return;
        try {
            await api.deleteGroup(id);
            loadGroups();
        } catch (e) {
            alert('Erreur lors de la suppression');
        }
    };

    const filteredGroups = groups.filter(g =>
        g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (g.description || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) return <div className="p-8 text-center text-slate-500">Chargement...</div>;

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FolderTree className="text-blue-600" />
                        Groupes
                    </h1>
                    <p className="text-slate-500">Gestion des groupes d'établissements</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors shadow-sm"
                >
                    <Plus size={20} />
                    <span>Nouveau Groupe</span>
                </button>
            </div>

            {/* Search */}
            <div className="mb-6 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                    type="text"
                    placeholder="Rechercher un groupe..."
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
            </div>

            {/* List */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4 font-semibold text-slate-700">Nom du groupe</th>
                            <th className="px-6 py-4 font-semibold text-slate-700">Mode d'hébergement</th>
                            <th className="px-6 py-4 font-semibold text-slate-700">Description</th>
                            <th className="px-6 py-4 font-semibold text-slate-700 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredGroups.map(group => {
                            const hosting = HOSTING_LABELS[group.hosting_mode] || HOSTING_LABELS.SAHTY_HOSTED;
                            return (
                                <tr key={group.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-slate-900 flex items-center gap-2">
                                            <FolderTree size={16} className="text-blue-500" />
                                            {group.name}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${hosting.bgColor} ${hosting.color}`}>
                                            {group.hosting_mode === 'SAHTY_HOSTED'
                                                ? <Cloud size={12} className="mr-1" />
                                                : <Server size={12} className="mr-1" />
                                            }
                                            {hosting.label}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500 text-sm max-w-xs truncate">
                                        {group.description || '—'}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleOpenModal(group)}
                                            className="text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50 transition-colors mr-2"
                                            title="Modifier"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(group.id)}
                                            className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 transition-colors"
                                            title="Supprimer"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredGroups.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                    {searchQuery ? 'Aucun groupe trouvé' : 'Aucun groupe créé pour le moment'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-slate-800">
                                {editingGroup ? 'Modifier le groupe' : 'Nouveau Groupe'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={24} />
                            </button>
                        </div>

                        {error && (
                            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center">
                                <XCircle size={16} className="mr-2 flex-shrink-0" />
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1 text-slate-700">
                                    Nom du groupe <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    autoFocus
                                    placeholder="Ex: Groupe Sahty Casablanca"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1 text-slate-700">
                                    Mode d'hébergement <span className="text-red-500">*</span>
                                </label>
                                <select
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                                    value={formData.hosting_mode}
                                    onChange={e => setFormData({ ...formData, hosting_mode: e.target.value as any })}
                                >
                                    <option value="SAHTY_HOSTED">Sahty Hosted — Hébergé par Sahty</option>
                                    <option value="GROUP_HOSTED">Group Hosted — Hébergé par le groupe</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1 text-slate-700">Description</label>
                                <textarea
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    rows={3}
                                    placeholder="Description optionnelle du groupe..."
                                />
                            </div>

                            <div className="flex justify-end space-x-3 pt-6 border-t border-slate-100 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm disabled:opacity-50"
                                >
                                    {saving ? 'En cours...' : editingGroup ? 'Enregistrer' : 'Créer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
