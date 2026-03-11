import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Plus, Edit2, Layers } from 'lucide-react';

export const UnitsManager: React.FC = () => {
    // Data State
    const [units, setUnits] = useState<any[]>([]);
    
    // UI State
    const [loading, setLoading] = useState(true);
    const [isCreatingUnit, setIsCreatingUnit] = useState(false);
    const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
    const [unitForm, setUnitForm] = useState({ code: '', display: '', isUcum: true, isActive: true, sortOrder: 0, requiresFluidInfo: false });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const unitsData = await api.getGlobalUnits();
            setUnits(unitsData);
        } catch (e) {
            console.error('Failed to load units catalog', e);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveUnit = async () => {
        try {
            if (editingUnitId) {
                await api.updateGlobalUnit(editingUnitId, unitForm);
            } else {
                await api.createGlobalUnit(unitForm);
            }
            setIsCreatingUnit(false);
            setEditingUnitId(null);
            setUnitForm({ code: '', display: '', isUcum: true, isActive: true, sortOrder: 0, requiresFluidInfo: false });
            loadData();
        } catch (e) {
            alert('Error saving unit');
        }
    };

    const handleEditUnit = (u: any) => {
        setUnitForm({
            code: u.code,
            display: u.display,
            isUcum: u.isUcum,
            isActive: u.isActive,
            requiresFluidInfo: u.requiresFluidInfo || false,
            sortOrder: u.sortOrder || 0
        });
        setEditingUnitId(u.id);
        setIsCreatingUnit(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (loading) return <div className="p-8">Chargement du référentiel des unités...</div>;

    return (
        <div className="p-8 h-full flex flex-col bg-slate-50 overflow-auto">
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-700 to-indigo-600">Catalogue des Unités</h2>
                    <button onClick={() => { setIsCreatingUnit(true); setEditingUnitId(null); setUnitForm({ code: '', display: '', isUcum: true, isActive: true, sortOrder: 0, requiresFluidInfo: false }); }} className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm transition-colors">
                        <Plus size={18} />
                        <span>Nouvelle Unité</span>
                    </button>
                </div>
                
                {isCreatingUnit && (
                    <div className="bg-white p-6 rounded-xl shadow-md border border-slate-100 flex flex-col space-y-4 animate-in fade-in slide-in-from-top-4">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-lg font-bold text-slate-800">{editingUnitId ? "Modifier l'Unité" : "Nouvelle Unité"}</h3>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Code</label>
                                <input className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none" placeholder="Code (ex: mg)" value={unitForm.code} onChange={e => setUnitForm({...unitForm, code: e.target.value})} disabled={!!editingUnitId} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Affichage</label>
                                <input className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none" placeholder="Affichage (ex: mg)" value={unitForm.display} onChange={e => setUnitForm({...unitForm, display: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Ordre de tri</label>
                                <input type="number" className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none" placeholder="Ordre de tri" value={unitForm.sortOrder} onChange={e => setUnitForm({...unitForm, sortOrder: Number(e.target.value)})} />
                            </div>
                        </div>
                        <div className="flex space-x-6 items-center">
                            <label className="flex items-center space-x-2 text-sm text-slate-700"><input type="checkbox" checked={unitForm.isUcum} onChange={e => setUnitForm({...unitForm, isUcum: e.target.checked})} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" /><span>Est UCUM</span></label>
                            <label className="flex items-center space-x-2 text-sm text-slate-700"><input type="checkbox" checked={unitForm.requiresFluidInfo} onChange={e => setUnitForm({...unitForm, requiresFluidInfo: e.target.checked})} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" /><span>Info hydrique requise</span></label>
                            <label className="flex items-center space-x-2 text-sm text-slate-700"><input type="checkbox" checked={unitForm.isActive} onChange={e => setUnitForm({...unitForm, isActive: e.target.checked})} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" /><span>Actif</span></label>
                        </div>
                        <div className="flex justify-end space-x-3 pt-2">
                            <button onClick={() => setIsCreatingUnit(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Annuler</button>
                            <button onClick={handleSaveUnit} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm transition-colors">Enregistrer</button>
                        </div>
                    </div>
                )}

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                            <tr>
                                <th className="p-4 font-semibold">Code</th>
                                <th className="p-4 font-semibold">Affichage</th>
                                <th className="p-4 font-semibold text-center">Standard UCUM</th>
                                <th className="p-4 font-semibold text-center">Bilan Hydrique</th>
                                <th className="p-4 font-semibold text-center">Statut</th>
                                <th className="p-4 font-semibold text-right">Ordre</th>
                            </tr>
                        </thead>
                        <tbody>
                            {units.map(u => (
                                <tr key={u.id} onClick={() => handleEditUnit(u)} className="border-b border-slate-100 last:border-none hover:bg-slate-50 transition-colors cursor-pointer">
                                    <td className="p-4 font-mono text-xs font-semibold text-indigo-600 flex items-center space-x-2">
                                        <Edit2 size={14} className="text-slate-400 group-hover:text-indigo-500" />
                                        <span>{u.code}</span>
                                    </td>
                                    <td className="p-4 font-medium text-slate-800">{u.display}</td>
                                    <td className="p-4 text-center">
                                        {u.isUcum ? <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold">Oui</span> : <span className="inline-block px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-medium">Non</span>}
                                    </td>
                                    <td className="p-4 text-center">
                                        {u.requiresFluidInfo ? <span className="inline-block px-2 py-1 bg-sky-100 text-sky-700 rounded text-xs font-bold">Oui</span> : <span className="inline-block px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-medium">Non</span>}
                                    </td>
                                    <td className="p-4 text-center">
                                        {u.isActive ? <span className="inline-block px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-bold">Actif</span> : <span className="inline-block px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold">Inactif</span>}
                                    </td>
                                    <td className="p-4 text-right font-mono text-slate-500">{u.sortOrder}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
