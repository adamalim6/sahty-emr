import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Plus, Pencil, Trash2, Server, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';

interface ExternalSystem {
    id: string;
    code: string;
    label: string;
    is_active: boolean;
    created_at: string;
}

export const ExternalSystemsPage: React.FC = () => {
    const [systems, setSystems] = useState<ExternalSystem[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<ExternalSystem | null>(null);
    const [formCode, setFormCode] = useState('');
    const [formLabel, setFormLabel] = useState('');
    const [formActive, setFormActive] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const data = await api.getExternalSystems();
            setSystems(data);
        } catch (e: any) {
            toast.error('Erreur lors du chargement');
        }
    };

    const openCreate = () => {
        setEditing(null);
        setFormCode('');
        setFormLabel('');
        setFormActive(true);
        setIsModalOpen(true);
    };

    const openEdit = (sys: ExternalSystem) => {
        setEditing(sys);
        setFormCode(sys.code);
        setFormLabel(sys.label);
        setFormActive(sys.is_active);
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!formCode.trim() || !formLabel.trim()) {
            toast.error('Code et label sont requis');
            return;
        }
        setSaving(true);
        try {
            if (editing) {
                await api.updateExternalSystem(editing.id, {
                    code: formCode, label: formLabel, is_active: formActive
                });
                toast.success('Système mis à jour');
            } else {
                await api.createExternalSystem({
                    code: formCode, label: formLabel, is_active: formActive
                });
                toast.success('Système créé');
            }
            setIsModalOpen(false);
            loadData();
        } catch (e: any) {
            toast.error(e.message || 'Erreur');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (sys: ExternalSystem) => {
        if (!confirm(`Supprimer le système "${sys.label}" ?`)) return;
        try {
            await api.deleteExternalSystem(sys.id);
            toast.success('Système supprimé');
            loadData();
        } catch (e: any) {
            toast.error(e.message || 'Erreur lors de la suppression');
        }
    };

    const handleToggle = async (sys: ExternalSystem) => {
        try {
            await api.updateExternalSystem(sys.id, { is_active: !sys.is_active });
            loadData();
        } catch (e: any) {
            toast.error(e.message || 'Erreur');
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Systèmes Externes</h1>
                    <p className="text-slate-500">Intégrations middleware et automates</p>
                </div>
                <button
                    onClick={openCreate}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
                >
                    <Plus size={20} />
                    <span>Nouveau Système</span>
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Code</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Label</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Statut</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {systems.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                                    <Server size={36} className="mx-auto mb-3 text-slate-300" />
                                    <p className="font-medium">Aucun système externe configuré</p>
                                    <p className="text-sm mt-1">Cliquez sur "Nouveau Système" pour commencer</p>
                                </td>
                            </tr>
                        ) : systems.map(sys => (
                            <tr key={sys.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4">
                                    <span className="font-mono font-bold text-sm text-slate-800 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
                                        {sys.code}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm font-medium text-slate-700">{sys.label}</td>
                                <td className="px-6 py-4">
                                    <button
                                        onClick={() => handleToggle(sys)}
                                        className="cursor-pointer"
                                        title={sys.is_active ? 'Désactiver' : 'Activer'}
                                    >
                                        {sys.is_active ? (
                                            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">Actif</span>
                                        ) : (
                                            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">Inactif</span>
                                        )}
                                    </button>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => openEdit(sys)}
                                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            title="Modifier"
                                        >
                                            <Pencil size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(sys)}
                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
                        <div className="bg-slate-800 px-6 py-4 text-white flex justify-between items-center">
                            <h3 className="font-bold text-lg">{editing ? 'Modifier le Système' : 'Nouveau Système'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-white/60 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Code</label>
                                <input
                                    type="text"
                                    value={formCode}
                                    onChange={e => setFormCode(e.target.value.toUpperCase())}
                                    placeholder="EVM"
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Label</label>
                                <input
                                    type="text"
                                    value={formLabel}
                                    onChange={e => setFormLabel(e.target.value)}
                                    placeholder="Eurobio Middleware"
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                />
                            </div>
                            <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3 border border-slate-100">
                                <span className="text-sm font-medium text-slate-700">Actif</span>
                                <button
                                    onClick={() => setFormActive(!formActive)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formActive ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${formActive ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                        </div>
                        <div className="flex gap-3 p-6 pt-0">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || !formCode.trim() || !formLabel.trim()}
                                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                <Check size={16} />
                                {editing ? 'Modifier' : 'Créer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
