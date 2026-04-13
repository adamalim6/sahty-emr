import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Plus, Edit2, Trash2, X, Save, Cpu } from 'lucide-react';

interface TechnicalUnitType {
    id: string;
    name: string;
    code?: string;
    description?: string;
    icon?: string;
}

const ICON_OPTIONS = [
    { value: 'scalpel', label: 'Bloc Opératoire' },
    { value: 'stethoscope', label: 'Consultation' },
    { value: 'scan', label: 'Imagerie' },
    { value: 'microscope', label: 'Laboratoire' },
    { value: 'heart-pulse', label: 'Soins Intensifs' },
    { value: 'baby', label: 'Maternité' },
    { value: 'syringe', label: 'Injection / Soins' },
    { value: 'radiation', label: 'Radiothérapie' },
    { value: 'eye', label: 'Ophtalmologie' },
    { value: 'bone', label: 'Orthopédie' },
];

export const PlateauxTechniquesPage: React.FC = () => {
    const [types, setTypes] = useState<TechnicalUnitType[]>([]);
    const [loading, setLoading] = useState(true);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingType, setEditingType] = useState<TechnicalUnitType | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        code: '',
        description: '',
        icon: ''
    });

    useEffect(() => { loadTypes(); }, []);

    const loadTypes = async () => {
        try {
            const data = await api.getTechnicalUnitTypes();
            setTypes(data);
        } catch (e) {
            console.error('Failed to load technical unit types', e);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (type: TechnicalUnitType) => {
        setEditingType(type);
        setFormData({
            name: type.name,
            code: type.code || '',
            description: type.description || '',
            icon: type.icon || ''
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce type de plateau technique ?')) return;
        try {
            await api.deleteTechnicalUnitType(id);
            setTypes(types.filter(t => t.id !== id));
        } catch (e) {
            alert('Erreur lors de la suppression');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                name: formData.name,
                code: formData.code || undefined,
                description: formData.description || undefined,
                icon: formData.icon || undefined
            };

            if (editingType) {
                const updated = await api.updateTechnicalUnitType(editingType.id, payload);
                setTypes(types.map(t => t.id === updated.id ? updated : t));
            } else {
                const created = await api.createTechnicalUnitType(payload);
                setTypes([...types, created]);
            }
            setIsModalOpen(false);
            setEditingType(null);
            setFormData({ name: '', code: '', description: '', icon: '' });
        } catch (e: any) {
            alert(e.message || "Erreur lors de l'enregistrement");
        }
    };

    const openNew = () => {
        setEditingType(null);
        setFormData({ name: '', code: '', description: '', icon: '' });
        setIsModalOpen(true);
    };

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Plateaux Techniques</h1>
                    <p className="text-slate-500">Définissez les types d'unités techniques (Bloc, Box de consultation, Imagerie...)</p>
                </div>
                <button
                    onClick={openNew}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
                >
                    <Plus size={20} />
                    <span>Nouveau Type</span>
                </button>
            </div>

            {loading ? (
                <div className="text-center py-10 text-slate-500">Chargement...</div>
            ) : types.length === 0 ? (
                <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    <Cpu className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                    <p className="text-slate-500 font-medium">Aucun type de plateau technique configuré.</p>
                    <p className="text-slate-400 text-sm mt-1">Commencez par créer un type (ex: Bloc Opératoire, Box de Consultation).</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 font-semibold text-slate-700">Nom</th>
                                <th className="px-6 py-4 font-semibold text-slate-700">Code</th>
                                <th className="px-6 py-4 font-semibold text-slate-700">Description</th>
                                <th className="px-6 py-4 font-semibold text-slate-700 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {types.map(type => (
                                <tr key={type.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                                                <Cpu size={16} />
                                            </div>
                                            <span className="font-medium text-slate-800">{type.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {type.code
                                            ? <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-mono font-bold">{type.code}</span>
                                            : <span className="text-slate-300">-</span>
                                        }
                                    </td>
                                    <td className="px-6 py-4 text-slate-500 text-sm">{type.description || '-'}</td>
                                    <td className="px-6 py-4 text-right space-x-1">
                                        <button
                                            onClick={() => handleEdit(type)}
                                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(type.id)}
                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-slate-800">
                                {editingType ? 'Modifier le type' : 'Nouveau Plateau Technique'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Nom <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="ex: Bloc Opératoire"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Code</label>
                                <input
                                    type="text"
                                    className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono"
                                    value={formData.code}
                                    onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                    placeholder="ex: BO, BOX, IMG"
                                />
                                <p className="text-xs text-slate-400 mt-1">Code court optionnel pour référence rapide.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                                <textarea
                                    className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    rows={3}
                                    placeholder="Description optionnelle du type de plateau technique"
                                />
                            </div>

                            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">
                                    Annuler
                                </button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center">
                                    <Save size={18} className="mr-2" /> Enregistrer
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
