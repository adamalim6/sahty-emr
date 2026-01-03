
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { Plus, Edit2, Trash2, Building2, Save, X } from 'lucide-react';

interface Service {
    id: string;
    name: string;
    description?: string;
    code?: string;
    client_id: string;
}

export const ServicesPage: React.FC = () => {
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingService, setEditingService] = useState<Service | null>(null);
    const [formData, setFormData] = useState({ name: '', code: '', description: '' });
    const navigate = useNavigate();

    useEffect(() => {
        loadServices();
    }, []);

    const loadServices = async () => {
        try {
            const data = await api.getServices();
            setServices(data);
        } catch (e) {
            console.error('Failed to load services', e);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (service: Service) => {
        setEditingService(service);
        setFormData({ 
            name: service.name, 
            code: service.code || '', 
            description: service.description || '' 
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce service ?')) return;
        try {
            await api.deleteService(id);
            setServices(services.filter(s => s.id !== id));
        } catch (e) {
            alert('Erreur lors de la suppression');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingService) {
                const updated = await api.updateService(editingService.id, formData);
                setServices(services.map(s => s.id === updated.id ? updated : s));
            } else {
                const created = await api.createService(formData);
                setServices([...services, created]);
            }
            setIsModalOpen(false);
            setEditingService(null);
            setFormData({ name: '', code: '', description: '' });
        } catch (e: any) {
            alert(e.message || 'Erreur lors de l\'enregistrement');
        }
    };

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Gestion des Services</h1>
                    <p className="text-slate-500">Organisation des départements hospitaliers</p>
                </div>
                <button 
                    onClick={() => { setEditingService(null); setFormData({ name: '', code: '', description: '' }); setIsModalOpen(true); }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
                >
                    <Plus size={20} />
                    <span>Ajouter un Service</span>
                </button>
            </div>

            {loading ? (
                <div className="text-center py-10 text-slate-500">Chargement...</div>
            ) : services.length === 0 ? (
                <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    <Building2 className="mx-auto text-slate-300 mb-3" size={48} />
                    <p className="text-slate-500">Aucun service configuré</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 font-semibold text-slate-700">Code</th>
                                <th className="px-6 py-4 font-semibold text-slate-700">Nom du Service</th>
                                <th className="px-6 py-4 font-semibold text-slate-700">Description</th>
                                <th className="px-6 py-4 font-semibold text-slate-700 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {services.map(service => (
                                <tr 
                                    key={service.id} 
                                    onClick={() => navigate(`/settings/services/${service.id}`)}
                                    className="hover:bg-slate-50 transition-colors cursor-pointer group"
                                >
                                    <td className="px-6 py-4 font-mono text-sm text-slate-500">{service.code || '-'}</td>
                                    <td className="px-6 py-4 font-medium text-slate-800 group-hover:text-blue-600 transition-colors">{service.name}</td>
                                    <td className="px-6 py-4 text-slate-500">{service.description || '-'}</td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleEdit(service); }}
                                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleDelete(service.id); }}
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
                                {editingService ? 'Modifier le Service' : 'Nouveau Service'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nom du Service <span className="text-red-500">*</span></label>
                                <input 
                                    type="text" 
                                    className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    value={formData.name}
                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                    placeholder="ex: Cardiologie"
                                    required 
                                    onInvalid={e => (e.target as HTMLInputElement).setCustomValidity('Veuillez remplir ce champ.')}
                                    onInput={e => (e.target as HTMLInputElement).setCustomValidity('')}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Code Service <span className="text-red-500">*</span></label>
                                <input 
                                    type="text" 
                                    className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none uppercase font-mono"
                                    value={formData.code}
                                    onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})}
                                    placeholder="ex: CARDIO"
                                    required
                                    onInvalid={e => (e.target as HTMLInputElement).setCustomValidity('Veuillez remplir ce champ.')}
                                    onInput={e => (e.target as HTMLInputElement).setCustomValidity('')}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                                <textarea 
                                    className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    value={formData.description}
                                    onChange={e => setFormData({...formData, description: e.target.value})}
                                    rows={3}
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
