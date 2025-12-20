import React, { useState } from 'react';
import { PharmacySupplier } from '../../types/pharmacy';
import { api } from '../../services/api';
import { Truck, Plus, Edit2, Trash2, X, Save, AlertCircle, Phone, Mail, MapPin } from 'lucide-react';

interface SupplierManagerProps {
    suppliers: PharmacySupplier[];
    onUpdateSuppliers: () => void; // Callback to refresh data
}

export const SupplierManager: React.FC<SupplierManagerProps> = ({ suppliers, onUpdateSuppliers }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [formData, setFormData] = useState<Partial<PharmacySupplier>>({
        name: '',
        contactPerson: '',
        email: '',
        phone: '',
        address: '',
        isActive: true
    });
    const [error, setError] = useState('');

    const openAddModal = () => {
        setEditingId(null);
        setFormData({ name: '', contactPerson: '', email: '', phone: '', address: '', isActive: true });
        setError('');
        setIsModalOpen(true);
    };

    const openEditModal = (supplier: PharmacySupplier) => {
        setEditingId(supplier.id);
        setFormData({ ...supplier });
        setError('');
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!formData.name?.trim()) {
            setError('Le nom du fournisseur est requis.');
            return;
        }

        try {
            if (editingId) {
                const payload = { ...formData, id: editingId } as PharmacySupplier;
                await api.updateSupplier(payload);
            } else {
                await api.createSupplier(formData);
            }
            onUpdateSuppliers();
            setIsModalOpen(false);
        } catch (e) {
            console.error(e);
            setError("Erreur lors de l'enregistrement");
        }
    };

    const handleDelete = async (id: string) => {
        const supplierName = suppliers.find(s => s.id === id)?.name;
        if (window.confirm(`Êtes-vous sûr de vouloir supprimer le fournisseur "${supplierName}" ?`)) {
            try {
                await api.deleteSupplier(id);
                onUpdateSuppliers();
            } catch (e) {
                alert("Erreur lors de la suppression du fournisseur");
            }
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-slate-900">Gestion des Fournisseurs</h2>
                    <p className="text-slate-500 text-sm">Gérez votre base de données fournisseurs.</p>
                </div>
                <button
                    onClick={openAddModal}
                    className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium shadow-sm transition-colors"
                >
                    <Plus size={18} />
                    <span>Nouveau Fournisseur</span>
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-xs border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4">Statut</th>
                            <th className="px-6 py-4">Nom</th>
                            <th className="px-6 py-4">Contact</th>
                            <th className="px-6 py-4">Coordonnées</th>
                            <th className="px-6 py-4">Adresse</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {suppliers.map(supplier => (
                            <tr key={supplier.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border
                    ${supplier.isActive
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                        {supplier.isActive ? 'Actif' : 'Inactif'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 font-bold text-slate-900">
                                    <div className="flex items-center">
                                        <Truck size={16} className="mr-2 text-slate-400" />
                                        {supplier.name}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-slate-600">
                                    {supplier.contactPerson || '-'}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col space-y-1 text-xs text-slate-500">
                                        {supplier.phone && (
                                            <div className="flex items-center">
                                                <Phone size={12} className="mr-1" /> {supplier.phone}
                                            </div>
                                        )}
                                        {supplier.email && (
                                            <div className="flex items-center">
                                                <Mail size={12} className="mr-1" /> {supplier.email}
                                            </div>
                                        )}
                                        {!supplier.phone && !supplier.email && '-'}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-slate-500 text-xs max-w-xs truncate">
                                    <div className="flex items-center">
                                        <MapPin size={12} className="mr-1 flex-shrink-0" />
                                        {supplier.address || '-'}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end space-x-2">
                                        <button
                                            onClick={() => openEditModal(supplier)}
                                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                            title="Modifier"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(supplier.id)}
                                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                            title="Supprimer"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {suppliers.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                                    Aucun fournisseur enregistré.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-slate-900">{editingId ? 'Modifier Fournisseur' : 'Nouveau Fournisseur'}</h3>
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
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nom du Fournisseur <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                                    placeholder="ex: Laboratoire X"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Personne de Contact</label>
                                <input
                                    type="text"
                                    value={formData.contactPerson || ''}
                                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                                    placeholder="ex: M. Dupont"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Téléphone</label>
                                    <input
                                        type="tel"
                                        value={formData.phone || ''}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                                        placeholder="+212..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                                    <input
                                        type="email"
                                        value={formData.email || ''}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                                        placeholder="contact@..."
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Adresse</label>
                                <textarea
                                    value={formData.address || ''}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 h-20 resize-none"
                                    placeholder="Adresse complète..."
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
                                    Fournisseur Actif
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
