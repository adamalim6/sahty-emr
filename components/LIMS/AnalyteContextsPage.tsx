import React, { useState } from 'react';
import { 
    useLimsContexts, 
    useLimsConfigDictionaries, 
    useCreateLimsContext, 
    useSetLimsContextStatus 
} from './useLimsConfig';
import { ReferenceProfilesList } from './ReferenceProfilesList';
import { Settings, Plus, CheckCircle2, XCircle, Search, Save, X, Beaker, Info, ChevronDown, ChevronRight } from 'lucide-react';

export const AnalyteContextsPage = () => {
    const { data: contexts = [], isLoading: isContextsLoading } = useLimsContexts();
    const { 
        analytes, methods, specimens, units, isLoading: isDictLoading 
    } = useLimsConfigDictionaries();
    
    const createMutation = useCreateLimsContext();
    const statusMutation = useSetLimsContextStatus();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedContextId, setExpandedContextId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        analyte_id: '',
        method_id: '',
        specimen_type_id: '',
        unit_id: '',
        decimal_precision: 2,
        analyte_label: '',
        method_label: '',
        specimen_label: '',
        unit_label: '',
        actif: true
    });

    const isLoading = isContextsLoading || isDictLoading;

    const filteredContexts = contexts.filter(c => 
        (c.analyte_libelle || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.method_libelle || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleAnalyteSelection = (analyteId: string) => {
        const analyte = analytes.find((a: any) => a.id === analyteId);
        setFormData(prev => ({
            ...prev,
            analyte_id: analyteId,
            analyte_label: analyte ? analyte.libelle : ''
        }));
    };

    const handleMethodSelection = (methodId: string) => {
        const method = methods.find((m: any) => m.id === methodId);
        setFormData(prev => ({
            ...prev,
            method_id: methodId || null as any,
            method_label: method ? method.libelle : ''
        }));
    };

    const handleSpecimenSelection = (specimenId: string) => {
        const specimen = specimens.find((s: any) => s.id === specimenId);
        setFormData(prev => ({
            ...prev,
            specimen_type_id: specimenId || null as any,
            specimen_label: specimen ? specimen.libelle : ''
        }));
    };

    const handleUnitSelection = (unitId: string) => {
        const unit = units.find((u: any) => u.id === unitId);
        setFormData(prev => ({
            ...prev,
            unit_id: unitId || null as any,
            unit_label: unit ? unit.libelle : ''
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.analyte_id) return;
        
        await createMutation.mutateAsync({
            ...formData,
            method_id: formData.method_id || undefined,
            specimen_type_id: formData.specimen_type_id || undefined,
            unit_id: formData.unit_id || undefined
        });
        
        setIsModalOpen(false);
        setFormData({ 
            analyte_id: '', method_id: '', specimen_type_id: '', unit_id: '', 
            decimal_precision: 2, analyte_label: '', method_label: '', specimen_label: '', unit_label: '', actif: true 
        });
    };

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        await statusMutation.mutateAsync({ id, actif: !currentStatus });
    };

    if (isLoading) {
        return <div className="p-8 text-center text-slate-500">Chargement...</div>;
    }

    return (
        <div className="flex flex-col h-full bg-slate-50/50">
            {/* Header */}
            <div className="bg-white px-8 py-5 border-b border-slate-200 flex justify-between items-center shrink-0 shadow-sm z-10">
                <div>
                    <h1 className="text-xl font-bold text-slate-800 flex items-center">
                        <Settings className="w-6 h-6 mr-2 text-blue-600" />
                        Paramètres (Contextes d'Analyses)
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">Définir les contextes d'exécution locaux avec unités et méthodes spécifiques</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
                >
                    <Plus size={18} />
                    <span>Nouveau Contexte</span>
                </button>
            </div>

            {/* List Engine */}
            <div className="flex-1 overflow-auto p-8">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                        <div className="relative w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Rechercher par libellé..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            />
                        </div>
                        <div className="text-sm text-slate-500 font-medium bg-white px-3 py-1 rounded-full border border-slate-200">
                            {filteredContexts.length} Contextes
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                                    <th className="px-6 py-4">Analyte (Paramètre)</th>
                                    <th className="px-6 py-4">Méthode</th>
                                    <th className="px-6 py-4">Nature</th>
                                    <th className="px-6 py-4">Unité / Précision</th>
                                    <th className="px-6 py-4">Statut</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm divide-y divide-slate-100">
                                {filteredContexts.map((ctx) => (
                                    <React.Fragment key={ctx.id}>
                                        <tr className={`transition-colors group ${expandedContextId === ctx.id ? 'bg-blue-50/40' : 'hover:bg-slate-50'}`}>
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-slate-800 flex items-center">
                                                    <button 
                                                        onClick={() => setExpandedContextId(expandedContextId === ctx.id ? null : ctx.id)}
                                                        className="mr-2 text-slate-400 hover:text-blue-600 transition-colors focus:outline-none"
                                                    >
                                                        {expandedContextId === ctx.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                    </button>
                                                    <Beaker size={14} className="text-indigo-400 mr-2" />
                                                    <span className="cursor-pointer hover:text-blue-600 transition-colors" onClick={() => setExpandedContextId(expandedContextId === ctx.id ? null : ctx.id)}>
                                                        {ctx.analyte_label || ctx.analyte_libelle}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-slate-500 font-mono mt-0.5 ml-8">{ctx.analyte_code}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {ctx.method_label || ctx.method_libelle ? (
                                                <span className="text-slate-700 bg-slate-100 px-2 py-1 rounded text-xs border border-slate-200">
                                                    {ctx.method_label || ctx.method_libelle}
                                                </span>
                                            ) : <span className="text-slate-400 italic text-xs">Par défaut</span>}
                                        </td>
                                        <td className="px-6 py-4">
                                            {ctx.specimen_label || ctx.specimen_libelle ? (
                                                <span className="text-amber-800 bg-amber-50 px-2 py-1 rounded text-xs border border-amber-200 font-medium">
                                                    {ctx.specimen_label || ctx.specimen_libelle}
                                                </span>
                                            ) : <span className="text-slate-400 italic text-xs">Toute nature</span>}
                                        </td>
                                        <td className="px-6 py-4">
                                            {ctx.unit_label || ctx.unit_libelle ? (
                                                <span className="font-mono bg-blue-50 px-2 py-1 rounded text-blue-700 text-xs border border-blue-200">
                                                    {ctx.unit_label || ctx.unit_libelle} 
                                                    {ctx.decimal_precision !== null ? ` (${ctx.decimal_precision} déc)` : ''}
                                                </span>
                                            ) : <span className="text-slate-400 italic text-xs">Sans unité</span>}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full border text-xs font-medium ${ctx.actif ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                                                {ctx.actif ? <CheckCircle2 size={14} className="mr-1" /> : <XCircle size={14} className="mr-1" />}
                                                {ctx.actif ? 'Actif' : 'Inactif'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end space-x-2">
                                                <button
                                                    onClick={() => setExpandedContextId(expandedContextId === ctx.id ? null : ctx.id)}
                                                    className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${expandedContextId === ctx.id ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700' : 'border-blue-200 text-blue-700 hover:bg-blue-50'}`}
                                                >
                                                    {expandedContextId === ctx.id ? 'Fermer' : 'Gérer Profils et Règles'}
                                                </button>
                                                <button
                                                    onClick={() => toggleStatus(ctx.id, ctx.actif)}
                                                    className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
                                                >
                                                    {ctx.actif ? 'Désactiver' : 'Activer'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    {expandedContextId === ctx.id && (
                                        <tr>
                                            <td colSpan={6} className="p-0 border-b border-slate-200">
                                                <ReferenceProfilesList contextId={ctx.id} cachedValueType={ctx.cached_value_type || 'NUMERIC'} />
                                            </td>
                                        </tr>
                                    )}
                                    </React.Fragment>
                                ))}
                                {filteredContexts.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                            Aucun contexte configuré pour l'instant.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Creation Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="font-bold text-slate-800 text-lg">Définir un Nouveau Contexte</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            
                            <div className="bg-blue-50 text-blue-800 p-4 rounded-lg flex items-start text-sm border border-blue-100">
                                <Info className="shrink-0 w-5 h-5 mr-3 mt-0.5 opacity-70" />
                                <p>Un contexte représente une façon unique de mesurer un paramètre (ex: Glucose Sérum Enzymatique mmol/L). Il peut ensuite posséder ses propres valeurs de référence.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-5">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Paramètre de Base (Analyte) *</label>
                                    <select
                                        required
                                        value={formData.analyte_id}
                                        onChange={e => handleAnalyteSelection(e.target.value)}
                                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white font-medium shadow-sm"
                                    >
                                        <option value="">Sélectionner une définition globale...</option>
                                        {analytes.map((a: any) => (
                                            <option key={a.id} value={a.id}>{a.libelle} [{a.code}]</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Méthode Analytique</label>
                                    <select
                                        value={formData.method_id}
                                        onChange={e => handleMethodSelection(e.target.value)}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-slate-50/50 hover:bg-white transition-colors"
                                    >
                                        <option value="">Toute méthode (par défaut)</option>
                                        {methods.map((m: any) => (
                                            <option key={m.id} value={m.id}>{m.libelle}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Nature de l'échantillon</label>
                                    <select
                                        value={formData.specimen_type_id}
                                        onChange={e => handleSpecimenSelection(e.target.value)}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-slate-50/50 hover:bg-white transition-colors"
                                    >
                                        <option value="">Toute nature (par défaut)</option>
                                        {specimens.map((s: any) => (
                                            <option key={s.id} value={s.id}>{s.libelle}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Unité de mesure</label>
                                    <select
                                        value={formData.unit_id}
                                        onChange={e => handleUnitSelection(e.target.value)}
                                        className="w-full px-4 py-2 border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-blue-50/20 hover:bg-white transition-colors font-mono"
                                    >
                                        <option value="">Sans unité</option>
                                        {units.map((u: any) => (
                                            <option key={u.id} value={u.id}>{u.libelle} [{u.code}]</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Précision décimale</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="6"
                                        value={formData.decimal_precision}
                                        onChange={e => setFormData({ ...formData, decimal_precision: parseInt(e.target.value) || 0 })}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="pt-6 mt-4 border-t border-slate-100 flex items-center justify-between">
                                <label className="flex items-center space-x-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.actif}
                                        onChange={e => setFormData({ ...formData, actif: e.target.checked })}
                                        className="w-5 h-5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                                    />
                                    <span className="text-sm font-semibold text-slate-700">Contexte actif</span>
                                </label>

                                <div className="flex space-x-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-transparent"
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!formData.analyte_id || createMutation.isPending}
                                        className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm disabled:bg-blue-300 flex items-center space-x-2"
                                    >
                                        {createMutation.isPending ? 'Enregistrement...' : (
                                            <>
                                                <Save size={16} />
                                                <span>Enregistrer le Contexte</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
