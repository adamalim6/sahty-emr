import React, { useState, useEffect } from 'react';
import { api, CareCategory } from '../../services/api';
import { Plus, Edit2, ShieldAlert } from 'lucide-react';

export const CareCategoriesManager: React.FC = () => {
    // Data State
    const [categories, setCategories] = useState<CareCategory[]>([]);
    
    // UI State
    const [loading, setLoading] = useState(true);
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
    const [categoryForm, setCategoryForm] = useState<Partial<CareCategory>>({ code: '', label: '', isActive: true, sortOrder: 0 });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await api.getCareCategories();
            setCategories(data);
        } catch (e) {
            console.error('Failed to load care categories catalog', e);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveCategory = async () => {
        try {
            if (editingCategoryId) {
                await api.updateCareCategory(editingCategoryId, categoryForm);
            } else {
                await api.createCareCategory(categoryForm);
            }
            setIsCreatingCategory(false);
            setEditingCategoryId(null);
            setCategoryForm({ code: '', label: '', isActive: true, sortOrder: 0 });
            loadData();
        } catch (e: any) {
            alert(e.response?.data?.message || e.message || 'Erreur lors de la sauvegarde de la classe thérapeutique. Vérifiez les informations.');
        }
    };

    const handleEditCategory = (c: CareCategory) => {
        setCategoryForm({
            code: c.code,
            label: c.label,
            isActive: c.isActive,
            sortOrder: c.sortOrder || 0
        });
        setEditingCategoryId(c.id);
        setIsCreatingCategory(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (loading) return <div className="p-8">Chargement du référentiel des classes thérapeutiques...</div>;

    return (
        <div className="p-8 h-full flex flex-col bg-slate-50 overflow-auto">
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-700 to-indigo-600">Classes Thérapeutiques</h2>
                        <p className="text-sm text-slate-500 mt-1">Catalogue global des classes DCI et groupes MAR (ex: Antibiotiques, Antalgiques).</p>
                    </div>
                    <button onClick={() => { setIsCreatingCategory(true); setEditingCategoryId(null); setCategoryForm({ code: '', label: '', isActive: true, sortOrder: 0 }); }} className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm transition-colors">
                        <Plus size={18} />
                        <span>Nouvelle Classe</span>
                    </button>
                </div>
                
                {isCreatingCategory && (
                    <div className="bg-white p-6 rounded-xl shadow-md border border-slate-100 flex flex-col space-y-4 animate-in fade-in slide-in-from-top-4">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-lg font-bold text-slate-800">{editingCategoryId ? "Modifier la Classe" : "Nouvelle Classe Thérapeutique"}</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Code Unique</label>
                                <input className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none uppercase" placeholder="Ex: ANTIBIO" value={categoryForm.code} onChange={e => setCategoryForm({...categoryForm, code: e.target.value.toUpperCase()})} disabled={!!editingCategoryId} />
                                <p className="text-[10px] text-slate-400 mt-1">Sert de référence technique immuable.</p>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Libellé d'affichage</label>
                                <input className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none" placeholder="Ex: ANTIBIOTIQUES" value={categoryForm.label} onChange={e => setCategoryForm({...categoryForm, label: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Ordre d'affichage (Tri)</label>
                                <input type="number" className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none" placeholder="10, 20, 30..." value={categoryForm.sortOrder} onChange={e => setCategoryForm({...categoryForm, sortOrder: Number(e.target.value)})} />
                                <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">Détermine l'affichage dans le MAR.</p>
                            </div>
                        </div>
                        <div className="flex space-x-6 items-center">
                            <label className="flex items-center space-x-2 text-sm text-slate-700"><input type="checkbox" checked={categoryForm.isActive} onChange={e => setCategoryForm({...categoryForm, isActive: e.target.checked})} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" /><span>Statut Actif</span></label>
                        </div>
                        <div className="flex justify-end space-x-3 pt-2">
                            <button onClick={() => setIsCreatingCategory(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Annuler</button>
                            <button onClick={handleSaveCategory} disabled={!categoryForm.code || !categoryForm.label} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm transition-colors disabled:opacity-50">Enregistrer</button>
                        </div>
                    </div>
                )}

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                            <tr>
                                <th className="p-4 font-semibold">Code</th>
                                <th className="p-4 font-semibold">Libellé</th>
                                <th className="p-4 font-semibold text-center">Statut</th>
                                <th className="p-4 font-semibold text-right">Ordre d'affichage</th>
                            </tr>
                        </thead>
                        <tbody>
                            {categories.map(c => (
                                <tr key={c.id} onClick={() => handleEditCategory(c)} className="border-b border-slate-100 last:border-none hover:bg-slate-50 transition-colors cursor-pointer">
                                    <td className="p-4 font-mono text-xs font-semibold text-indigo-600 flex items-center space-x-2">
                                        <Edit2 size={14} className="text-slate-400 group-hover:text-indigo-500 flex-shrink-0" />
                                        <span>{c.code}</span>
                                    </td>
                                    <td className="p-4 font-medium text-slate-800">{c.label}</td>
                                    <td className="p-4 text-center">
                                        {c.isActive ? <span className="inline-block px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-bold w-16 text-center">Actif</span> : <span className="inline-block px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold w-16 text-center">Inactif</span>}
                                    </td>
                                    <td className="p-4 text-right font-mono text-slate-500">{c.sortOrder}</td>
                                </tr>
                            ))}
                            {categories.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-slate-500 italic">Aucune classe thérapeutique définie.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
