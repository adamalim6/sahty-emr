import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Search, Loader2, Plus, Edit2, Trash2, X, Save } from 'lucide-react';

export const SousFamillesPage: React.FC = () => {
    const [sousFamilles, setSousFamilles] = useState<any[]>([]);
    const [familles, setFamilles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    
    // Modal State
    const [selectedItem, setSelectedItem] = useState<any | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [sfRes, fRes] = await Promise.all([
                api.getSousFamilles(),
                api.getFamilles()
            ]);
            setSousFamilles(sfRes);
            setFamilles(fRes);
        } catch (error) {
            console.error('Failed to load taxonomy:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setSelectedItem({ famille_id: '', code: '', libelle: '', actif: true });
        setIsModalOpen(true);
    };

    const handleEdit = (item: any) => {
        setSelectedItem({ ...item });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette sous-famille ?')) return;
        try {
            await api.deleteSousFamille(id);
            loadData();
        } catch (error) {
            console.error('Failed to delete sous-famille:', error);
            alert('Erreur lors de la suppression');
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedItem || !selectedItem.famille_id) {
            alert("Veuillez sélectionner une famille parente.");
            return;
        }

        setIsSaving(true);
        try {
            if (selectedItem.id) {
                await api.updateSousFamille(selectedItem.id, selectedItem);
            } else {
                await api.createSousFamille(selectedItem);
            }
            setIsModalOpen(false);
            loadData();
        } catch (error) {
            console.error('Failed to save sous-famille:', error);
            alert('Erreur lors de la sauvegarde');
        } finally {
            setIsSaving(false);
        }
    };

    const filtered = sousFamilles.filter(sf => 
        sf.code.toLowerCase().includes(search.toLowerCase()) || 
        sf.libelle.toLowerCase().includes(search.toLowerCase())
    );

    const getFamilleName = (id: string) => {
        const f = familles.find(fam => fam.id === id);
        return f ? f.libelle : <span className="text-slate-400 italic">Inconnue</span>;
    };

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Sous-Familles d'Actes</h1>
                    <p className="text-slate-500">Gestion de la taxonomie secondaire (Niveau 2)</p>
                </div>
                <button 
                    onClick={handleCreate}
                    className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors"
                >
                    <Plus size={18} />
                    <span>Nouvelle Sous-Famille</span>
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Rechercher par Code ou Libellé..." 
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-slate-700"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider text-xs border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 w-32">Code</th>
                                <th className="px-6 py-4">Libellé</th>
                                <th className="px-6 py-4">Famille Parente</th>
                                <th className="px-6 py-4 w-32 text-center">Statut</th>
                                <th className="px-6 py-4 w-24 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center justify-center text-slate-400">
                                            <Loader2 size={32} className="animate-spin mb-3 text-blue-500" />
                                            <span>Chargement...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center text-slate-400">
                                        Aucune sous-famille trouvée.
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-mono font-medium text-slate-700">
                                            {item.code}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-slate-800">
                                            {item.libelle}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            {getFamilleName(item.famille_id)}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${item.actif ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                                {item.actif ? 'Actif' : 'Inactif'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end space-x-2">
                                                <button 
                                                    onClick={() => handleEdit(item)}
                                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(item.id)}
                                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && selectedItem && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">
                                    {selectedItem.id ? 'Modifier la Sous-Famille' : 'Nouvelle Sous-Famille'}
                                </h2>
                            </div>
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form id="sous-famille-form" onSubmit={handleSave} className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Famille Parente *</label>
                                <select 
                                    className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:border-transparent focus:ring-blue-500 text-slate-700 bg-white"
                                    value={selectedItem.famille_id}
                                    onChange={e => setSelectedItem({...selectedItem, famille_id: e.target.value})}
                                    required
                                >
                                    <option value="">-- Sélectionner une famille --</option>
                                    {familles.map(f => (
                                        <option key={f.id} value={f.id}>{f.libelle}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Code *</label>
                                <input 
                                    type="text" 
                                    required
                                    className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:border-transparent focus:ring-blue-500 font-mono text-slate-700"
                                    value={selectedItem.code}
                                    onChange={e => setSelectedItem({...selectedItem, code: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Libellé *</label>
                                <input 
                                    type="text" 
                                    required
                                    className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:border-transparent focus:ring-blue-500 text-slate-700"
                                    value={selectedItem.libelle}
                                    onChange={e => setSelectedItem({...selectedItem, libelle: e.target.value})}
                                />
                            </div>
                            <div className="flex items-center pt-2">
                                <label className="flex items-center space-x-3 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 outline-none"
                                        checked={selectedItem.actif !== false}
                                        onChange={e => setSelectedItem({...selectedItem, actif: e.target.checked})}
                                    />
                                    <span className="text-slate-700 font-medium">Active</span>
                                </label>
                            </div>
                        </form>

                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end space-x-3">
                            <button 
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="px-5 py-2 text-slate-600 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg transition-all font-medium"
                            >
                                Annuler
                            </button>
                            <button 
                                form="sous-famille-form"
                                type="submit"
                                disabled={isSaving}
                                className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm flex items-center space-x-2 font-medium disabled:opacity-50 transition-all"
                            >
                                {isSaving ? (
                                    <><Loader2 size={16} className="animate-spin" /><span>Enregistrement...</span></>
                                ) : (
                                    <><Save size={16} /><span>Enregistrer</span></>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
