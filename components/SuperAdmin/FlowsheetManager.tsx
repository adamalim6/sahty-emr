import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Plus, Edit2, Check, X, Layers, Activity, FolderTree } from 'lucide-react';

export const FlowsheetManager: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'parameters' | 'groups' | 'flowsheets'>('parameters');
    
    // Data State
    const [parameters, setParameters] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [flowsheets, setFlowsheets] = useState<any[]>([]);
    const [units, setUnits] = useState<any[]>([]);
    
    // UI State
    const [loading, setLoading] = useState(true);
    const [isCreatingParam, setIsCreatingParam] = useState(false);
    const [editingParamId, setEditingParamId] = useState<string | null>(null);
    const [paramForm, setParamForm] = useState({
        code: '', label: '', unit: '', unitId: '', valueType: 'number',
        normalMin: '', normalMax: '', warningMin: '', warningMax: '', hardMin: '', hardMax: '',
        isHydricInput: false, isHydricOutput: false
    });

    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [groupForm, setGroupForm] = useState({ code: '', label: '', sortOrder: 0, parameterIds: [] as string[] });
    const [groupSortError, setGroupSortError] = useState('');

    const [isCreatingFlowsheet, setIsCreatingFlowsheet] = useState(false);
    const [editingFsId, setEditingFsId] = useState<string | null>(null);
    const [fsForm, setFsForm] = useState({ code: '', label: '', sortOrder: 0, groupIds: [] as string[] });
    const [fsSortError, setFsSortError] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [paramsData, groupsData, fsData, unitsData] = await Promise.all([
                api.getGlobalObservationParameters(),
                api.getGlobalObservationGroups(),
                api.getGlobalObservationFlowsheets(),
                api.getGlobalUnits()
            ]);
            setParameters(paramsData);
            setGroups(groupsData);
            setFlowsheets(fsData);
            setUnits(unitsData);
        } catch (e) {
            console.error('Failed to load observation catalog', e);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveParameter = async () => {
        try {
            const payload = { ...paramForm };
            if (!payload.normalMin) delete (payload as any).normalMin;
            if (!payload.normalMax) delete (payload as any).normalMax;
            if (!payload.warningMin) delete (payload as any).warningMin;
            if (!payload.warningMax) delete (payload as any).warningMax;
            if (!payload.hardMin) delete (payload as any).hardMin;
            if (!payload.hardMax) delete (payload as any).hardMax;
            
            if (editingParamId) {
                await api.updateGlobalObservationParameter(editingParamId, payload);
            } else {
                await api.createGlobalObservationParameter(payload);
            }
            setIsCreatingParam(false);
            setEditingParamId(null);
            setParamForm({ code: '', label: '', unit: '', unitId: '', valueType: 'number', normalMin: '', normalMax: '', warningMin: '', warningMax: '', hardMin: '', hardMax: '', isHydricInput: false, isHydricOutput: false });
            loadData();
        } catch (e) {
            alert('Error saving parameter');
        }
    };

    const handleEditParameter = (p: any) => {
        setParamForm({
            code: p.code,
            label: p.label,
            unit: p.unit || '',
            unitId: p.unitId || '',
            valueType: p.valueType,
            normalMin: p.normalMin || '',
            normalMax: p.normalMax || '',
            warningMin: p.warningMin || '',
            warningMax: p.warningMax || '',
            hardMin: p.hardMin || '',
            hardMax: p.hardMax || '',
            isHydricInput: p.isHydricInput || false,
            isHydricOutput: p.isHydricOutput || false
        });
        setEditingParamId(p.id);
        setIsCreatingParam(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelParam = () => {
        setIsCreatingParam(false);
        setEditingParamId(null);
        setParamForm({ code: '', label: '', unit: '', unitId: '', valueType: 'number', normalMin: '', normalMax: '', warningMin: '', warningMax: '', hardMin: '', hardMax: '', isHydricInput: false, isHydricOutput: false });
    };

    const handleCreateGroup = async () => {
        try {
            setGroupSortError('');
            await api.createGlobalObservationGroup({ group: { code: groupForm.code, label: groupForm.label, sortOrder: groupForm.sortOrder }, parameterIds: groupForm.parameterIds });
            setIsCreatingGroup(false);
            setGroupForm({ code: '', label: '', sortOrder: 0, parameterIds: [] });
            loadData();
        } catch (e: any) {
            if (e.message?.includes("déja attribué")) {
                setGroupSortError(e.message);
            } else {
                alert(e.message || 'Error creating group');
            }
        }
    };

    const handleEditFlowsheet = (fs: any) => {
        setFsForm({
            code: fs.code,
            label: fs.label,
            sortOrder: fs.sortOrder || 0,
            groupIds: fs.groups ? fs.groups.map((g: any) => g.id) : []
        });
        setEditingFsId(fs.id);
        setIsCreatingFlowsheet(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSaveFlowsheet = async () => {
        try {
            setFsSortError('');
            if (editingFsId) {
                await api.updateGlobalObservationFlowsheet(editingFsId, { flowsheet: { code: fsForm.code, label: fsForm.label, sortOrder: fsForm.sortOrder }, groupIds: fsForm.groupIds });
            } else {
                await api.createGlobalObservationFlowsheet({ flowsheet: { code: fsForm.code, label: fsForm.label, sortOrder: fsForm.sortOrder }, groupIds: fsForm.groupIds });
            }
            setIsCreatingFlowsheet(false);
            setEditingFsId(null);
            setFsForm({ code: '', label: '', sortOrder: 0, groupIds: [] });
            loadData();
        } catch (e: any) {
            if (e.message?.includes("déja attribué")) {
                setFsSortError(e.message);
            } else {
                alert(e.message || 'Error saving flowsheet');
            }
        }
    };

    if (loading) return <div className="p-8">Chargement du référentiel...</div>;

    return (
        <div className="p-8 h-full flex flex-col bg-slate-50">
            <div className="mb-6 flex space-x-4 border-b border-slate-200">
                <button 
                    onClick={() => setActiveTab('parameters')}
                    className={`pb-4 px-2 font-medium flex items-center space-x-2 ${activeTab === 'parameters' ? 'border-b-2 border-indigo-600 text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Activity size={18} />
                    <span>Paramètres</span>
                </button>
                <button 
                    onClick={() => setActiveTab('groups')}
                    className={`pb-4 px-2 font-medium flex items-center space-x-2 ${activeTab === 'groups' ? 'border-b-2 border-indigo-600 text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <FolderTree size={18} />
                    <span>Groupes UI</span>
                </button>
                <button 
                    onClick={() => setActiveTab('flowsheets')}
                    className={`pb-4 px-2 font-medium flex items-center space-x-2 ${activeTab === 'flowsheets' ? 'border-b-2 border-indigo-600 text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Layers size={18} />
                    <span>Fiches (Flowsheets)</span>
                </button>
            </div>

            <div className="flex-1 overflow-auto">
                {activeTab === 'parameters' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-700 to-indigo-600">Référentiel des Paramètres</h2>
                            <button onClick={() => { setIsCreatingParam(true); setEditingParamId(null); setParamForm({ code: '', label: '', unit: '', unitId: '', valueType: 'number', normalMin: '', normalMax: '', warningMin: '', warningMax: '', hardMin: '', hardMax: '', isHydricInput: false, isHydricOutput: false }); }} className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm transition-colors">
                                <Plus size={18} />
                                <span>Nouveau Paramètre</span>
                            </button>
                        </div>
                        
                        {isCreatingParam && (
                            <div className="bg-white p-6 rounded-xl shadow-md border border-slate-100 flex flex-col space-y-4 animate-in fade-in slide-in-from-top-4">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="text-lg font-bold text-slate-800">{editingParamId ? "Modifier le Paramètre" : "Nouveau Paramètre"}</h3>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Code</label>
                                        <input className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none" placeholder="Code (ex: HR)" value={paramForm.code} onChange={e => setParamForm({...paramForm, code: e.target.value})} disabled={!!editingParamId} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Label</label>
                                        <input className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none" placeholder="Label (ex: Fréquence Cardiaque)" value={paramForm.label} onChange={e => setParamForm({...paramForm, label: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Unité</label>
                                        <select 
                                            className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none" 
                                            value={paramForm.unitId} 
                                            onChange={e => {
                                                const selectedUnit = units.find(u => u.id === e.target.value);
                                                setParamForm({...paramForm, unitId: e.target.value, unit: selectedUnit ? selectedUnit.code : ''});
                                            }} 
                                        >
                                            <option value="">Sélectionner une unité...</option>
                                            {units.map(u => <option key={u.id} value={u.id}>{u.display} ({u.code})</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Type</label>
                                        <select className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none" value={paramForm.valueType} onChange={e => setParamForm({...paramForm, valueType: e.target.value})} disabled={!!editingParamId}>
                                            <option value="number">Numérique</option>
                                            <option value="text">Texte List</option>
                                            <option value="boolean">Oui/Non</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Normal Min</label>
                                        <input type="number" className="w-full border border-emerald-200 bg-emerald-50 rounded-lg p-3 text-sm focus:ring-2 focus:ring-emerald-200 outline-none" placeholder="Normal Min" value={paramForm.normalMin} onChange={e => setParamForm({...paramForm, normalMin: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Normal Max</label>
                                        <input type="number" className="w-full border border-emerald-200 bg-emerald-50 rounded-lg p-3 text-sm focus:ring-2 focus:ring-emerald-200 outline-none" placeholder="Normal Max" value={paramForm.normalMax} onChange={e => setParamForm({...paramForm, normalMax: e.target.value})} />
                                    </div>
                                    
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Warning Min</label>
                                        <input type="number" className="w-full border border-orange-200 bg-orange-50 rounded-lg p-3 text-sm focus:ring-2 focus:ring-orange-200 outline-none" placeholder="Warning Min" value={paramForm.warningMin} onChange={e => setParamForm({...paramForm, warningMin: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Warning Max</label>
                                        <input type="number" className="w-full border border-orange-200 bg-orange-50 rounded-lg p-3 text-sm focus:ring-2 focus:ring-orange-200 outline-none" placeholder="Warning Max" value={paramForm.warningMax} onChange={e => setParamForm({...paramForm, warningMax: e.target.value})} />
                                    </div>
                                    
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Hard Min</label>
                                        <input type="number" className="w-full border border-red-200 bg-red-50 rounded-lg p-3 text-sm focus:ring-2 focus:ring-red-200 outline-none" placeholder="Hard Min" value={paramForm.hardMin} onChange={e => setParamForm({...paramForm, hardMin: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Hard Max</label>
                                        <input type="number" className="w-full border border-red-200 bg-red-50 rounded-lg p-3 text-sm focus:ring-2 focus:ring-red-200 outline-none" placeholder="Hard Max" value={paramForm.hardMax} onChange={e => setParamForm({...paramForm, hardMax: e.target.value})} />
                                    </div>
                                </div>
                                <div className="flex space-x-4 items-center">
                                    <label className="flex items-center space-x-2 text-sm text-slate-700"><input type="checkbox" checked={paramForm.isHydricInput} onChange={e => setParamForm({...paramForm, isHydricInput: e.target.checked})} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" /><span>Entrée Hydrique</span></label>
                                    <label className="flex items-center space-x-2 text-sm text-slate-700"><input type="checkbox" checked={paramForm.isHydricOutput} onChange={e => setParamForm({...paramForm, isHydricOutput: e.target.checked})} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" /><span>Sortie Hydrique</span></label>
                                </div>
                                <div className="flex justify-end space-x-3 pt-2">
                                    <button onClick={handleCancelParam} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Annuler</button>
                                    <button onClick={handleSaveParameter} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm transition-colors">Enregistrer</button>
                                </div>
                            </div>
                        )}

                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                                    <tr>
                                        <th className="p-4 font-semibold">Code</th>
                                        <th className="p-4 font-semibold">Label</th>
                                        <th className="p-4 font-semibold">Type</th>
                                        <th className="p-4 font-semibold">Unité</th>
                                        <th className="p-4 font-semibold">Limites</th>
                                        <th className="p-4 font-semibold text-center">Bilan H.</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {parameters.map(p => (
                                        <tr key={p.id} onClick={() => handleEditParameter(p)} className="border-b border-slate-100 last:border-none hover:bg-slate-50 transition-colors cursor-pointer">
                                            <td className="p-4 font-mono text-xs font-semibold text-indigo-600 flex items-center space-x-2">
                                                <Edit2 size={14} className="text-slate-400 group-hover:text-indigo-500" />
                                                <span>{p.code}</span>
                                            </td>
                                            <td className="p-4 font-medium text-slate-800">{p.label}</td>
                                            <td className="p-4 text-slate-600">{p.valueType === 'number' ? 'Numérique' : p.valueType}</td>
                                            <td className="p-4 text-slate-600">{p.unit || '-'}</td>
                                            <td className="p-4 text-slate-600">
                                                <div className="flex flex-col space-y-1">
                                                    {(p.normalMin !== undefined || p.normalMax !== undefined) ? <span className="text-emerald-600 font-medium">Norm: [{p.normalMin ?? '-'} - {p.normalMax ?? '-'}]</span> : null}
                                                    {(p.warningMin !== undefined || p.warningMax !== undefined) ? <span className="text-orange-600 font-medium">Warn: [{p.warningMin ?? '-'} - {p.warningMax ?? '-'}]</span> : null}
                                                    {(p.hardMin !== undefined || p.hardMax !== undefined) ? <span className="text-red-600 font-medium">Hard: [{p.hardMin ?? '-'} - {p.hardMax ?? '-'}]</span> : null}
                                                    {p.normalMin === undefined && p.normalMax === undefined && p.warningMin === undefined && p.warningMax === undefined && p.hardMin === undefined && p.hardMax === undefined ? '-' : null}
                                                </div>
                                            </td>
                                            <td className="p-4 text-center">
                                                {p.isHydricInput ? <span className="inline-block px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold mr-1">IN</span> : null}
                                                {p.isHydricOutput ? <span className="inline-block px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-bold">OUT</span> : null}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'groups' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-700 to-indigo-600">Groupes d'Observation</h2>
                            <button onClick={() => setIsCreatingGroup(true)} className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm transition-colors">
                                <Plus size={18} />
                                <span>Nouveau Groupe</span>
                            </button>
                        </div>
                        
                        {isCreatingGroup && (
                            <div className="bg-white p-6 rounded-xl shadow-md border border-slate-100 flex flex-col space-y-4 animate-in fade-in slide-in-from-top-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Code</label>
                                        <input className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none" placeholder="Code (ex: VITALS)" value={groupForm.code} onChange={e => setGroupForm({...groupForm, code: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Label</label>
                                        <input className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none" placeholder="Label (ex: Constantes Vitales)" value={groupForm.label} onChange={e => setGroupForm({...groupForm, label: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className={`block text-xs font-semibold mb-1 ${groupSortError ? 'text-red-600' : 'text-slate-700'}`}>N° d'Ordre</label>
                                        <input 
                                            type="number" 
                                            className={`w-full border rounded-lg p-3 text-sm focus:ring-2 outline-none ${groupSortError ? 'border-red-500 bg-red-50 focus:ring-red-200' : 'border-slate-200 focus:ring-indigo-100'}`} 
                                            value={groupForm.sortOrder} 
                                            onChange={e => { setGroupSortError(''); setGroupForm({...groupForm, sortOrder: Number(e.target.value)}); }} 
                                        />
                                        {groupSortError && <p className="text-red-500 text-xs mt-1">{groupSortError}</p>}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-sm font-semibold mb-2 text-slate-700">Sélectionner les paramètres:</p>
                                    <div className="max-h-48 overflow-auto border border-slate-200 rounded-lg grid grid-cols-2 md:grid-cols-3 p-3 gap-2 bg-slate-50">
                                        {parameters.map(p => (
                                            <label key={p.id} className="flex items-center space-x-2 text-sm bg-white p-2 rounded-md border border-slate-100 shadow-sm hover:border-indigo-200 cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                    checked={groupForm.parameterIds.includes(p.id)}
                                                    onChange={(e) => {
                                                        const newIds = e.target.checked 
                                                            ? [...groupForm.parameterIds, p.id]
                                                            : groupForm.parameterIds.filter(id => id !== p.id);
                                                        setGroupForm({...groupForm, parameterIds: newIds});
                                                    }}
                                                />
                                                <span className="truncate flex-1">{p.label} <span className="text-slate-400 text-xs">({p.code})</span></span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex justify-end space-x-3 pt-2">
                                    <button onClick={() => { setIsCreatingGroup(false); setGroupSortError(''); }} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Annuler</button>
                                    <button onClick={handleCreateGroup} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm transition-colors">Enregistrer</button>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {groups.map(g => {
                                // Find parameter counts (a quick mapping for display since structure isn't strictly nested here yet)
                                // In a real app we'd fetch the group detailed structure. For now, it's just a view.
                                return (
                                    <div key={g.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:border-indigo-300 transition-colors relative">
                                        <div className="absolute top-4 right-4 bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold border border-slate-200 shadow-sm">
                                            #{g.sortOrder}
                                        </div>
                                        <div className="flex justify-between items-start mb-3 pr-8">
                                            <div>
                                                <h3 className="font-bold text-slate-800 text-lg">{g.label}</h3>
                                                <p className="font-mono text-xs text-indigo-600 font-semibold">{g.code}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {activeTab === 'flowsheets' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-700 to-indigo-600">Configurations de Fiches</h2>
                            <button onClick={() => { setIsCreatingFlowsheet(true); setEditingFsId(null); setFsForm({ code: '', label: '', sortOrder: 0, groupIds: [] }); }} className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm transition-colors">
                                <Plus size={18} />
                                <span>Nouvelle Fiche</span>
                            </button>
                        </div>

                         {isCreatingFlowsheet && (
                            <div className="bg-white p-6 rounded-xl shadow-md border border-slate-100 flex flex-col space-y-4 animate-in fade-in slide-in-from-top-4">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="text-lg font-bold text-slate-800">{editingFsId ? "Modifier la Fiche" : "Nouvelle Fiche"}</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Code</label>
                                        <input className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none" placeholder="Code (ex: ICU)" value={fsForm.code} onChange={e => setFsForm({...fsForm, code: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Label</label>
                                        <input className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none" placeholder="Label (ex: Réanimation)" value={fsForm.label} onChange={e => setFsForm({...fsForm, label: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className={`block text-xs font-semibold mb-1 ${fsSortError ? 'text-red-600' : 'text-slate-700'}`}>N° d'Ordre</label>
                                        <input 
                                            type="number" 
                                            className={`w-full border rounded-lg p-3 text-sm focus:ring-2 outline-none ${fsSortError ? 'border-red-500 bg-red-50 focus:ring-red-200' : 'border-slate-200 focus:ring-indigo-100'}`} 
                                            value={fsForm.sortOrder} 
                                            onChange={e => { setFsSortError(''); setFsForm({...fsForm, sortOrder: Number(e.target.value)}); }} 
                                        />
                                        {fsSortError && <p className="text-red-500 text-xs mt-1">{fsSortError}</p>}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-sm font-semibold mb-2 text-slate-700">Sélectionner les groupes:</p>
                                    <div className="max-h-48 overflow-auto border border-slate-200 rounded-lg grid grid-cols-2 md:grid-cols-3 p-3 gap-2 bg-slate-50">
                                        {groups.map(g => (
                                            <label key={g.id} className="flex items-center space-x-2 text-sm bg-white p-2 rounded-md border border-slate-100 shadow-sm hover:border-indigo-200 cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                    checked={fsForm.groupIds.includes(g.id)}
                                                    onChange={(e) => {
                                                        const newIds = e.target.checked 
                                                            ? [...fsForm.groupIds, g.id]
                                                            : fsForm.groupIds.filter(id => id !== g.id);
                                                        setFsForm({...fsForm, groupIds: newIds});
                                                    }}
                                                />
                                                <span className="truncate flex-1">{g.label} <span className="text-slate-400 text-xs">({g.code})</span></span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex justify-end space-x-3 pt-2">
                                    <button onClick={() => { setIsCreatingFlowsheet(false); setEditingFsId(null); setFsSortError(''); }} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Annuler</button>
                                    <button onClick={handleSaveFlowsheet} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm transition-colors">{editingFsId ? 'Mettre à jour la fiche' : 'Créer la fiche'}</button>
                                </div>
                            </div>
                        )}

                        <div className="space-y-4">
                            {flowsheets.map(fs => (
                                <div key={fs.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col space-y-3 relative">
                                    <div className="absolute top-4 right-4 bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold border border-slate-200 shadow-sm">
                                        #{fs.sortOrder}
                                    </div>
                                    <div className="flex justify-between items-center border-b border-slate-100 pb-3 pr-8">
                                        <div>
                                            <h3 className="font-bold text-slate-800 text-xl flex items-center space-x-3">
                                                <Layers className="text-indigo-500" size={24} />
                                                <span>{fs.label}</span>
                                            </h3>
                                            <p className="font-mono text-xs font-semibold text-slate-500 mt-1">{fs.code}</p>
                                        </div>
                                        <button 
                                            onClick={() => handleEditFlowsheet(fs)} 
                                            className="text-slate-400 hover:text-indigo-600 transition-colors p-2 rounded-lg hover:bg-slate-50"
                                            title="Modifier la fiche"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                    </div>
                                    <div className="flex space-x-2 overflow-x-auto pb-2">
                                        {fs.groups && fs.groups.length > 0 ? fs.groups.map((g: any) => (
                                            <div key={g.id} className="flex-shrink-0 bg-slate-50 border border-slate-200 rounded-lg p-3 w-48 shadow-sm">
                                                <h4 className="font-semibold text-sm text-slate-700 mb-2 truncate" title={g.label}>{g.label}</h4>
                                                <div className="flex flex-wrap gap-1">
                                                    {g.parameters && g.parameters.map((p: any) => (
                                                        <span key={p.id} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-xs text-slate-600 truncate max-w-full" title={p.label}>
                                                            {p.label}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )) : <p className="text-sm text-slate-400 italic">Aucun groupe assigné</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
