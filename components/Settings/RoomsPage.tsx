
import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Plus, Edit2, Trash2, Bed, Activity, Stethoscope, X, Save, AlertCircle } from 'lucide-react';

interface Unit {
    id: string;
    client_id: string;
    name: string;
    description?: string;
    unit_category: 'CHAMBRE' | 'PLATEAU_TECHNIQUE' | 'BOOTH_CONSULTATION';
    number_of_beds?: number | null;
}

export const RoomsPage: React.FC = () => {
    const [units, setUnits] = useState<Unit[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'CHAMBRE' | 'PLATEAU_TECHNIQUE' | 'BOOTH_CONSULTATION'>('CHAMBRE');
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        number_of_beds: 1
    });

    useEffect(() => {
        loadUnits();
    }, []);

    const loadUnits = async () => {
        try {
            const data = await api.getTenantRooms();
            setUnits(data);
        } catch (e) {
            console.error('Failed to load units', e);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (unit: Unit) => {
        setEditingUnit(unit);
        setFormData({
            name: unit.name,
            description: unit.description || '',
            number_of_beds: unit.number_of_beds || 1
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette unité ?')) return;
        try {
            await api.deleteRoom(id);
            setUnits(units.filter(u => u.id !== id));
        } catch (e) {
            alert('Erreur lors de la suppression');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                name: formData.name,
                description: formData.description,
                unit_category: activeTab, // Always create in current tab category
                number_of_beds: activeTab === 'CHAMBRE' ? formData.number_of_beds : null
            };

            if (editingUnit) {
                const updated = await api.updateRoom(editingUnit.id, payload);
                setUnits(units.map(u => u.id === updated.id ? updated : u));
            } else {
                const created = await api.createRoom(payload);
                setUnits([...units, created]);
            }
            setIsModalOpen(false);
            setEditingUnit(null);
            setFormData({ name: '', description: '', number_of_beds: 1 });
        } catch (e: any) {
             // Handle API Error from generic error handler or specific parsing
             // Assuming API throws with custom message now
             alert(e.message || 'Erreur lors de l\'enregistrement');
        }
    };

    const filteredUnits = units.filter(u => u.unit_category === activeTab);

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Gestion des Unités</h1>
                    <p className="text-slate-500">Configuration des espaces physiques de soin</p>
                </div>
                <button
                    onClick={() => { 
                        setEditingUnit(null); 
                        setFormData({ name: '', description: '', number_of_beds: 1 }); 
                        setIsModalOpen(true); 
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
                >
                    <Plus size={20} />
                    <span>Nouvelle Unité ({activeTab === 'CHAMBRE' ? 'Chambre' : activeTab === 'PLATEAU_TECHNIQUE' ? 'Plateau' : 'Box'})</span>
                </button>
            </div>

            {/* Tabs */}
            <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl mb-6 w-fit">
                <button
                    onClick={() => setActiveTab('CHAMBRE')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2 transition-all ${activeTab === 'CHAMBRE' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Bed size={18} />
                    <span>Types de Chambres</span>
                </button>
                <button
                    onClick={() => setActiveTab('PLATEAU_TECHNIQUE')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2 transition-all ${activeTab === 'PLATEAU_TECHNIQUE' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Activity size={18} />
                    <span>Plateaux Techniques</span>
                </button>
                <button
                    onClick={() => setActiveTab('BOOTH_CONSULTATION')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2 transition-all ${activeTab === 'BOOTH_CONSULTATION' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Stethoscope size={18} />
                    <span>Box Consultation</span>
                </button>
            </div>

            {loading ? (
                <div className="text-center py-10 text-slate-500">Chargement...</div>
            ) : filteredUnits.length === 0 ? (
                <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    <p className="text-slate-500">Aucune unité configurée dans cette catégorie.</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 font-semibold text-slate-700">Nom de l'unité</th>
                                <th className="px-6 py-4 font-semibold text-slate-700">Description</th>
                                {activeTab === 'CHAMBRE' && <th className="px-6 py-4 font-semibold text-slate-700 text-center">Nombre de Lits</th>}
                                <th className="px-6 py-4 font-semibold text-slate-700 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredUnits.map(unit => (
                                <tr key={unit.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-800">{unit.name}</td>
                                    <td className="px-6 py-4 text-slate-500">{unit.description || '-'}</td>
                                    {activeTab === 'CHAMBRE' && (
                                        <td className="px-6 py-4 text-center">
                                            <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-sm font-mono font-bold">
                                                {unit.number_of_beds}
                                            </span>
                                        </td>
                                    )}
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <button 
                                            onClick={() => handleEdit(unit)}
                                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(unit.id)}
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
                                {editingUnit ? 'Modifier l\'unité' : 'Nouvelle Unité'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={24} />
                            </button>
                        </div>
                        
                        <div className="bg-blue-50 text-blue-800 p-3 rounded-lg mb-4 text-sm flex items-center">
                            <AlertCircle size={16} className="mr-2 flex-shrink-0" />
                            <span>Catégorie : <strong>{activeTab === 'CHAMBRE' ? 'Hospitalisation' : activeTab === 'PLATEAU_TECHNIQUE' ? 'Plateau Technique' : 'Box de Consultation'}</strong></span>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nom de l'unité <span className="text-red-500">*</span></label>
                                <input 
                                    type="text" 
                                    className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    value={formData.name}
                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                    placeholder={activeTab === 'CHAMBRE' ? "ex: Chambre Standard" : "ex: Salle de Réveil"}
                                    required
                                    onInvalid={e => (e.target as HTMLInputElement).setCustomValidity('Veuillez remplir ce champ.')}
                                    onInput={e => (e.target as HTMLInputElement).setCustomValidity('')}
                                />
                            </div>

                            {activeTab === 'CHAMBRE' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de Lits (Capacité) <span className="text-red-500">*</span></label>
                                    <input 
                                        type="number" 
                                        min="1" 
                                        max="6"
                                        className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        value={formData.number_of_beds}
                                        onChange={e => setFormData({...formData, number_of_beds: parseInt(e.target.value)})}
                                        required
                                    />
                                    <p className="text-xs text-slate-400 mt-1">Maximum 6 lits par chambre.</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                                <textarea 
                                    className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    value={formData.description}
                                    onChange={e => setFormData({...formData, description: e.target.value})}
                                    rows={3}
                                    placeholder="Optionnel"
                                />
                            </div>

                            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
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
