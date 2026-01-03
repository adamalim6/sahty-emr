
import React, { useState } from 'react';
import { StockLocation } from '../types/pharmacy';
import { api } from '../services/api';
import { MapPin, Plus, Edit2, Trash2, X, Save, AlertCircle } from 'lucide-react';

export const EmrLocationManager: React.FC = () => {
    // Real API Data
    const [locations, setLocations] = useState<StockLocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);

    const fetchLocations = async () => {
        try {
            setLoading(true);
            setFetchError(null);
            const data = await api.getEmrLocations();
            setLocations(data);
        } catch (err: any) {
            console.error(err);
            if (err.message?.includes('403') || err.message?.toLowerCase().includes('forbidden')) {
                setFetchError("Accès refusé : Vous n'avez pas les permissions pour gérer les emplacements.");
            } else {
                setFetchError("Impossible de charger les emplacements.");
            }
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => {
        fetchLocations();
    }, []);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [formData, setFormData] = useState<Partial<StockLocation>>({
        name: '',
        description: '',
        isActive: true
    });
    const [error, setError] = useState('');

    const openAddModal = () => {
        setEditingId(null);
        setFormData({ name: '', description: '', isActive: true });
        setError('');
        setIsModalOpen(true);
    };

    const openEditModal = (loc: StockLocation) => {
        setEditingId(loc.id);
        setFormData({ ...loc });
        setError('');
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!formData.name?.trim()) {
            setError('Le nom de l\'emplacement est requis.');
            return;
        }

        const nameExists = locations.some(l =>
            l.name.toLowerCase() === formData.name?.toLowerCase() && l.id !== editingId
        );

        if (nameExists) {
            setError('Un emplacement avec ce nom existe déjà.');
            return;
        }

        try {
            if (editingId) {
                await api.updateEmrLocation({ ...formData, id: editingId } as StockLocation);
            } else {
                await api.createEmrLocation({
                    name: formData.name,
                    description: formData.description,
                    isActive: formData.isActive
                });
            }
            fetchLocations();
            setIsModalOpen(false);
        } catch (e) {
            setError("Erreur lors de l'enregistrement");
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Êtes-vous sûr de vouloir supprimer cet emplacement ?')) {
            try {
                await api.deleteEmrLocation(id);
                fetchLocations();
            } catch (e) {
                alert("Erreur lors de la suppression");
            }
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-slate-900">Emplacements (Service)</h2>
                    <p className="text-slate-500 text-sm">Gestion des zones de stockage du service.</p>
                </div>
                <button
                    onClick={openAddModal}
                    className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium shadow-sm transition-colors"
                >
                    <Plus size={18} />
                    <span>Nouvel Emplacement</span>
                </button>
            </div>

            {fetchError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center mb-4">
                    <AlertCircle className="w-5 h-5 mr-2" />
                    {fetchError}
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-xs border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4">Statut</th>
                            <th className="px-6 py-4">Nom</th>
                            <th className="px-6 py-4">Description</th>
                            <th className="px-6 py-4 text-center">Utilisation</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {locations.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                    Aucun emplacement défini.
                                </td>
                            </tr>
                        ) : locations.map(loc => (
                            <tr key={loc.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border
                    ${loc.isActive
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                        {loc.isActive ? 'Actif' : 'Inactif'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 font-bold text-slate-900 flex items-center">
                                    <MapPin size={16} className="mr-2 text-slate-400" />
                                    {loc.name}
                                </td>
                                <td className="px-6 py-4 text-slate-500">
                                    {loc.description || '-'}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className="px-2 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-400">
                                        -
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end space-x-2">
                                        <button
                                            onClick={() => openEditModal(loc)}
                                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                            title="Modifier"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(loc.id)}
                                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                            title="Supprimer"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-slate-900">{editingId ? 'Modifier Emplacement' : 'Nouvel Emplacement'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {error && (
                                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-start">
                                    <AlertCircle size={16} className="mt-0.5 mr-2 flex-shrink-0" />
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nom <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                                    placeholder="ex: Armoire A"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 h-24 resize-none"
                                    placeholder="Détails optionnels..."
                                />
                            </div>

                            <div className="flex items-center space-x-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                <input
                                    type="checkbox"
                                    id="isActive"
                                    checked={formData.isActive}
                                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                    className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                                />
                                <label htmlFor="isActive" className="text-sm font-medium text-slate-700 cursor-pointer select-none">
                                    Emplacement Actif
                                </label>
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end space-x-3">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-medium transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-bold shadow-sm transition-colors flex items-center space-x-2"
                            >
                                <Save size={18} />
                                <span>Enregistrer</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
