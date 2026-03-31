import React, { useState, useMemo } from 'react';
import { Search, Plus, Edit2, Play, Pause, AlertTriangle } from 'lucide-react';
import { useLimsCatalog } from './useLimsCatalog';

interface ColumnDef {
    key: string;
    label: string;
    render?: (val: any, row: any) => React.ReactNode;
}

interface LimsCatalogGridProps {
    resource: string;
    title: string;
    columns: ColumnDef[];
    renderForm: (
        initialData: any | null, 
        onSubmit: (data: any) => Promise<void>, 
        onCancel: () => void,
        isSaving: boolean,
        error: string | null
    ) => React.ReactNode;
    labelField?: string; // Standard is 'libelle'
}

export const LimsCatalogGrid: React.FC<LimsCatalogGridProps> = ({ 
    resource, 
    title, 
    columns, 
    renderForm,
    labelField = 'libelle'
}) => {
    const { items, isLoading, createItem, updateItem, deactivateItem, reactivateItem, isSaving } = useLimsCatalog(resource);
    
    const [search, setSearch] = useState('');
    const [filterActif, setFilterActif] = useState<'ACTIFS' | 'TOUS'>('ACTIFS');
    
    const [editingItem, setEditingItem] = useState<any | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

    const filteredItems = useMemo(() => {
        return items.filter((item: any) => {
            const matchesSearch = (item.code?.toLowerCase() || '').includes(search.toLowerCase()) ||
                                  (item[labelField]?.toLowerCase() || '').includes(search.toLowerCase());
            
            const matchesFilter = filterActif === 'TOUS' || item.actif;
            return matchesSearch && matchesFilter;
        });
    }, [items, search, filterActif, labelField]);

    const handleOpenCreate = () => {
        setEditingItem(null);
        setFormError(null);
        setIsFormOpen(true);
    };

    const handleOpenEdit = (item: any) => {
        setEditingItem(item);
        setFormError(null);
        setIsFormOpen(true);
    };

    const handleSubmit = async (data: any) => {
        try {
            setFormError(null);
            if (editingItem) {
                await updateItem({ id: editingItem.id, data });
            } else {
                await createItem(data);
            }
            setIsFormOpen(false);
        } catch (err: any) {
            setFormError(err.message || 'Une erreur est survenue');
            throw err;
        }
    };

    const handleToggleActif = async (item: any) => {
        try {
            if (item.actif) {
                setDeactivatingId(item.id);
            } else {
                await reactivateItem(item.id);
            }
        } catch (err: any) {
            alert(err.message);
        }
    };

    const confirmDeactivate = async () => {
        if (!deactivatingId) return;
        try {
            await deactivateItem(deactivatingId);
            setDeactivatingId(null);
        } catch (err: any) {
            alert(err.message);
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
            {/* Top Bar */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
                <h1 className="text-xl font-bold tracking-tight text-slate-800">{title}</h1>
                
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="text"
                            placeholder="Rechercher..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="bg-white border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full pl-9 p-2 transition-shadow shadow-sm"
                        />
                    </div>
                    
                    <select
                        value={filterActif}
                        onChange={e => setFilterActif(e.target.value as any)}
                        className="bg-white border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2 shadow-sm"
                    >
                        <option value="ACTIFS">Actifs Uniquement</option>
                        <option value="TOUS">Tous (Actifs + Inactifs)</option>
                    </select>

                    <button 
                        onClick={handleOpenCreate}
                        className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm px-4 py-2 transition-colors shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Ajouter</span>
                    </button>
                </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-auto p-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm text-left text-slate-600">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50/80 border-b border-slate-200">
                            <tr>
                                <th className="px-5 py-3.5 font-semibold">Code</th>
                                <th className="px-5 py-3.5 font-semibold">Label</th>
                                {columns.map(c => (
                                    <th key={c.key} className="px-5 py-3.5 font-semibold">{c.label}</th>
                                ))}
                                <th className="px-5 py-3.5 font-semibold text-center w-24">Statut</th>
                                <th className="px-5 py-3.5 font-semibold text-right w-32">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={10} className="px-5 py-8 text-center text-slate-500">Chargement en cours...</td>
                                </tr>
                            ) : filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="px-5 py-8 text-center text-slate-500">Aucun résultat trouvé.</td>
                                </tr>
                            ) : (
                                filteredItems.map((item: any) => (
                                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="px-5 py-3 font-mono text-xs font-semibold text-slate-900">{item.code}</td>
                                        <td 
                                            className="px-5 py-3 text-sm text-slate-700 font-medium truncate max-w-[400px]" 
                                            title={item[labelField] ?? ''}
                                        >
                                            {item[labelField] ?? '[Sans libellé]'}
                                        </td>
                                        {columns.map(c => (
                                            <td key={c.key} className="px-5 py-3">
                                                {c.render ? c.render(item[c.key], item) : item[c.key]}
                                            </td>
                                        ))}
                                        <td className="px-5 py-3 text-center">
                                            {item.actif ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                    Actif
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 border border-rose-200">
                                                    Inactif
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button 
                                                    onClick={() => handleOpenEdit(item)}
                                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                    title="Modifier"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                
                                                {item.actif ? (
                                                    <button 
                                                        onClick={() => handleToggleActif(item)}
                                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                                        title="Désactiver"
                                                    >
                                                        <Pause className="w-4 h-4" />
                                                    </button>
                                                ) : (
                                                    <button 
                                                        onClick={() => handleToggleActif(item)}
                                                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                                        title="Activer"
                                                    >
                                                        <Play className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modals */}
            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-slate-100">
                            <h2 className="text-lg font-bold text-slate-800">
                                {editingItem ? 'Modifier l\'élément' : 'Nouvel élément'}
                            </h2>
                        </div>
                        <div className="p-6 overflow-y-auto">
                            {renderForm(editingItem, handleSubmit, () => setIsFormOpen(false), isSaving, formError)}
                        </div>
                    </div>
                </div>
            )}

            {deactivatingId && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm text-center transform transition-all">
                        <div className="mx-auto w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mb-4">
                            <AlertTriangle className="w-6 h-6 text-rose-600" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-2">Désactiver cet élément ?</h3>
                        <p className="text-slate-500 text-sm mb-6">
                            Cette entrée sera désactivée mais non supprimée. Elle n'apparaîtra plus dans les sélections par défaut.
                        </p>
                        <div className="flex gap-3 justify-center">
                            <button 
                                onClick={() => setDeactivatingId(null)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors text-sm"
                            >
                                Annuler
                            </button>
                            <button 
                                onClick={confirmDeactivate}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg transition-colors shadow-sm text-sm"
                            >
                                Confirmer la désactivation
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
