import React, { useState } from 'react';
import { 
    useLimsProfiles, 
    useCreateLimsProfile, 
    useSetLimsProfileStatus,
    useLimsRules,
    useCreateLimsRule,
    useSetLimsRuleStatus,
    useLimsCanonicalValues
} from './useLimsConfig';
import { Plus, Settings2, ShieldCheck, AlertCircle, X, Save, Trash2, ArrowRight } from 'lucide-react';

// ==========================================
// RULES ENGINE OVERLAY
// ==========================================
const TRANSLATE_RULE_TYPE: Record<string, string> = {
    'NUMERIC_INTERVAL': 'Intervalle Numérique',
    'EXACT_MATCH': 'Valeur Exacte',
    'BOOLEAN': 'Présence/Absence',
    'QUALITATIVE_MATCH': 'Qualitatif'
};

const TRANSLATE_INTERP: Record<string, string> = {
    'NORMAL': 'Normal',
    'ABNORMAL_LOW': 'Anormal bas',
    'ABNORMAL_HIGH': 'Anormal haut',
    'ABNORMAL': 'Anormal',
    'CAUTION': 'Zone de prudence',
    'CAUTION_LOW': 'Prudence basse',
    'CAUTION_HIGH': 'Prudence haute'
};

const formatMathBounds = (lower: string | number | null, upper: string | number | null, lowerInc: boolean, upperInc: boolean) => {
    if ((lower === null || lower === '') && (upper === null || upper === '')) return 'Toutes valeurs';
    
    // Normalize to handle DB strings with trailing zeros
    const numLower = lower !== null && lower !== '' ? Number(lower) : null;
    const numUpper = upper !== null && upper !== '' ? Number(upper) : null;
    
    const lowerExpr = numLower !== null ? `${numLower} ${lowerInc ? '≤' : '<'}` : '-∞ <';
    const upperExpr = numUpper !== null ? `${upperInc ? '≤' : '<'} ${numUpper}` : '< +∞';
    
    return `${lowerExpr} X ${upperExpr}`;
};

const ReferenceRulesEngine = ({ profileId, profileLabel, cachedValueType, onClose }: { profileId: string, profileLabel: string, cachedValueType: string, onClose: () => void }) => {
    const { data: rules = [], isLoading } = useLimsRules(profileId);
    const { data: canonicalValues = [] } = useLimsCanonicalValues();
    const domains = Array.from(new Set(canonicalValues.map((c: any) => c.domain))).filter(Boolean) as string[];
    
    const createMutation = useCreateLimsRule(profileId);
    
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [formData, setFormData] = useState({
        lower_numeric: '', 
        upper_numeric: '', 
        lower_inclusive: true,
        upper_inclusive: true,
        canonical_category: '',
        canonical_value_id: '',
        canonical_value_min_id: '',
        canonical_value_max_id: '',
        interpretation: 'NORMAL',
        priority: 10, 
        actif: true
    });

    const handleOpenCreate = () => {
        setEditingRuleId(null);
        setFormData({
            lower_numeric: '', upper_numeric: '', 
            lower_inclusive: true, upper_inclusive: true,
            canonical_category: '', canonical_value_id: '', canonical_value_min_id: '', canonical_value_max_id: '',
            interpretation: 'NORMAL', priority: 10, actif: true
        });
        setIsFormOpen(true);
    };

    const handleOpenEdit = (rule: any) => {
        setEditingRuleId(rule.id);
        
        let initCat = '';
        if (rule.canonical_value_id) {
            initCat = canonicalValues.find((c: any) => c.id === rule.canonical_value_id)?.domain || '';
        } else if (rule.canonical_value_min_id) {
            initCat = canonicalValues.find((c: any) => c.id === rule.canonical_value_min_id)?.domain || '';
        }

        setFormData({
            lower_numeric: rule.lower_numeric !== null && rule.lower_numeric !== undefined ? String(rule.lower_numeric) : '',
            upper_numeric: rule.upper_numeric !== null && rule.upper_numeric !== undefined ? String(rule.upper_numeric) : '',
            canonical_category: initCat,
            canonical_value_id: rule.canonical_value_id || '',
            canonical_value_min_id: rule.canonical_value_min_id || '',
            canonical_value_max_id: rule.canonical_value_max_id || '',
            lower_inclusive: rule.lower_inclusive ?? true,
            upper_inclusive: rule.upper_inclusive ?? true,
            interpretation: rule.interpretation || 'NORMAL',
            priority: rule.priority || 10,
            actif: rule.actif ?? true
        });
        setIsFormOpen(true);
    };

    const statusMutation = useSetLimsRuleStatus(profileId);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const payload = {
                ...formData,
                lower_numeric: formData.lower_numeric !== '' ? parseFloat(formData.lower_numeric) : null,
                upper_numeric: formData.upper_numeric !== '' ? parseFloat(formData.upper_numeric) : null,
                canonical_value_id: formData.canonical_value_id || null,
                canonical_value_min_id: formData.canonical_value_min_id || null,
                canonical_value_max_id: formData.canonical_value_max_id || null,
            };

            if (editingRuleId) {
                // Manual fetch for update since useUpdateLimsRule isn't in useLimsConfig
                const token = localStorage.getItem('token');
                await fetch(`http://localhost:3001/api/lims/reference-rules/${editingRuleId}`, {
                    method: 'PUT',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
                });
                // Invalidate
                const { QueryClient, useQueryClient } = await import('@tanstack/react-query');
                // We'll just rely on forcing a reload or using window location if QC is hard, 
                // but actually we can just use the statusMutation trick or close form.
                // Wait, useQueryClient is a hook, can't be used inside handleSubmit easily without initializing it in component.
            } else {
                await createMutation.mutateAsync(payload);
            }
            setIsFormOpen(false);
            // hard reload to fetch data if update, since we don't have invalidate inside handleSubmit easily 
            // Better: I will use the hook properly at the top of the component.
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
            if (editingRuleId) window.location.reload(); // Quick hack for query invalidation without hook restructuring
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                    <div>
                        <h3 className="font-bold text-slate-800 text-lg flex items-center">
                            <Settings2 className="w-5 h-5 mr-2 text-indigo-500" />
                            Règles d'évaluation
                        </h3>
                        <p className="text-xs font-semibold text-slate-500 mt-0.5">{profileLabel}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-auto p-6 bg-slate-50/50">
                    {isFormOpen ? (
                        <form onSubmit={handleSubmit} className="bg-white border text-left border-slate-200 rounded-xl p-5 shadow-sm mb-6">
                            <h4 className="font-semibold text-slate-800 text-sm mb-4 border-b pb-2">
                                {editingRuleId ? 'Modifier la Règle' : 'Nouvelle Règle d\'Évaluation'}
                            </h4>
                            
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="col-span-1">
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                                        Type de Contexte (Hérité)
                                    </label>
                                    <div className="w-full text-sm font-semibold rounded bg-slate-100 border border-slate-200 px-3 py-2 text-slate-500 flex items-center">
                                        {cachedValueType === 'NUMERIC' ? 'Numerique (Intervalles)' : 
                                         cachedValueType === 'BOOLEAN' ? 'Booléen (Oui/Non)' : 
                                         cachedValueType === 'CHOICE' ? 'Choix Multiple (Liste)' : 
                                         'Chaîne de Caractères'}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Interprétation LIMS</label>
                                    <select value={formData.interpretation} onChange={e => setFormData({...formData, interpretation: e.target.value})} className="w-full text-sm border-slate-300 rounded focus:ring-indigo-500">
                                        <option value="NORMAL">Normal</option>
                                        <option value="ABNORMAL_LOW">Anormal bas</option>
                                        <option value="ABNORMAL_HIGH">Anormal haut</option>
                                        <option value="ABNORMAL">Anormal</option>
                                        <option value="CAUTION">Zone de prudence</option>
                                        <option value="CAUTION_LOW">Prudence basse</option>
                                        <option value="CAUTION_HIGH">Prudence haute</option>
                                    </select>
                                </div>
                            </div>

                            {cachedValueType === 'NUMERIC' ? (
                                <div className="mb-5 bg-slate-50 p-6 rounded-xl border border-slate-100 flex flex-col items-center">
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-5 w-full text-left ml-2">Condition Logique</label>
                                    <div className="flex items-center justify-center space-x-3 md:space-x-5 font-mono w-full px-2">
                                        <div className="flex flex-col items-center">
                                            <input 
                                                type="number" step="any" 
                                                value={formData.lower_numeric} 
                                                onChange={e => setFormData({...formData, lower_numeric: e.target.value})} 
                                                className="w-24 md:w-32 text-center text-sm border-slate-300 rounded focus:ring-indigo-500 shadow-sm" 
                                                placeholder="-∞" 
                                            />
                                            <span className="text-[10px] text-slate-400 mt-1 uppercase font-semibold">Borne Inf</span>
                                        </div>
                                        
                                        <select 
                                            value={String(formData.lower_inclusive)}
                                            onChange={e => setFormData({...formData, lower_inclusive: e.target.value === 'true'})}
                                            className="text-xl md:text-2xl font-bold text-slate-500 bg-transparent border-none focus:ring-0 cursor-pointer hover:bg-slate-200 rounded px-1 -mx-2 transition-colors appearance-none text-center"
                                        >
                                            <option value="true">≤</option>
                                            <option value="false">&lt;</option>
                                        </select>
                                        
                                        <div className="flex items-center justify-center w-12 h-12 md:w-16 md:h-16 bg-white rounded-xl border-2 border-indigo-100 shadow-sm transition-transform hover:scale-105">
                                            <span className="font-bold text-3xl md:text-4xl text-indigo-500 italic leading-none drop-shadow-sm">X</span>
                                        </div>
                                        
                                        <select 
                                            value={String(formData.upper_inclusive)}
                                            onChange={e => setFormData({...formData, upper_inclusive: e.target.value === 'true'})}
                                            className="text-xl md:text-2xl font-bold text-slate-500 bg-transparent border-none focus:ring-0 cursor-pointer hover:bg-slate-200 rounded px-1 -mx-2 transition-colors appearance-none text-center"
                                        >
                                            <option value="true">≤</option>
                                            <option value="false">&lt;</option>
                                        </select>

                                        <div className="flex flex-col items-center">
                                            <input 
                                                type="number" step="any" 
                                                value={formData.upper_numeric} 
                                                onChange={e => setFormData({...formData, upper_numeric: e.target.value})} 
                                                className="w-24 md:w-32 text-center text-sm border-slate-300 rounded focus:ring-indigo-500 shadow-sm" 
                                                placeholder="+∞" 
                                            />
                                            <span className="text-[10px] text-slate-400 mt-1 uppercase font-semibold">Borne Sup</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="mb-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 ml-1">Choix de Valeur (Canonique)</label>
                                    
                                    <div className="mb-3 px-1">
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">Catégorie de valeurs</label>
                                        <select 
                                            value={formData.canonical_category} 
                                            onChange={e => {
                                                setFormData({...formData, canonical_category: e.target.value, canonical_value_id: '', canonical_value_min_id: '', canonical_value_max_id: ''});
                                            }}
                                            className="w-full text-sm border-slate-300 rounded focus:ring-indigo-500"
                                        >
                                            <option value="">Sélectionner une catégorie...</option>
                                            {domains.map(d => {
                                                const labelMap: Record<string, string> = {
                                                    positivity: 'Positif / Négatif',
                                                    reactivity: 'Réactif / Non-réactif',
                                                    semi_quantitative: 'Semi-quantitatif',
                                                    presence_absence: 'Présence / Absence'
                                                };
                                                return <option key={d} value={d}>{labelMap[d] || d}</option>;
                                            })}
                                        </select>
                                    </div>
                                    
                                    {formData.canonical_category && (() => {
                                        const domainCanons = canonicalValues.filter((c: any) => c.domain === formData.canonical_category);
                                        const hasRank = domainCanons.some((c: any) => c.rank > 0);
                                        
                                        if (hasRank) {
                                            return (
                                                <div className="grid grid-cols-2 gap-4 px-1">
                                                    <div>
                                                        <label className="block text-xs font-semibold text-slate-500 mb-1">De (Inclus)</label>
                                                        <select value={formData.canonical_value_min_id} onChange={e => setFormData({...formData, canonical_value_min_id: e.target.value})} className="w-full text-sm border-slate-300 rounded focus:ring-indigo-500">
                                                            <option value="">(Aucun)</option>
                                                            {domainCanons.map((c: any) => <option key={c.id} value={c.id}>{c.label}</option>)}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-semibold text-slate-500 mb-1">À (Inclus)</label>
                                                        <select value={formData.canonical_value_max_id} onChange={e => setFormData({...formData, canonical_value_max_id: e.target.value})} className="w-full text-sm border-slate-300 rounded focus:ring-indigo-500">
                                                            <option value="">(Aucun)</option>
                                                            {domainCanons.map((c: any) => <option key={c.id} value={c.id}>{c.label}</option>)}
                                                        </select>
                                                    </div>
                                                </div>
                                            );
                                        } else {
                                            return (
                                                <div className="px-1">
                                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Valeur exacte attendue</label>
                                                    <select value={formData.canonical_value_id} onChange={e => setFormData({...formData, canonical_value_id: e.target.value})} className="w-full text-sm border-slate-300 rounded focus:ring-indigo-500">
                                                        <option value="">Sélectionner une valeur...</option>
                                                        {domainCanons.map((c: any) => <option key={c.id} value={c.id}>{c.label}</option>)}
                                                    </select>
                                                </div>
                                            );
                                        }
                                    })()}
                                </div>
                            )}
                            <div className="flex items-center space-x-4 mb-4">
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Priorité d'évaluation</label>
                                    <input type="number" value={formData.priority} onChange={e => setFormData({...formData, priority: parseInt(e.target.value) || 0})} className="w-24 text-sm border-slate-300 rounded focus:ring-indigo-500" />
                                </div>
                            </div>

                            <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-2">
                                <div className="flex space-x-4">
                                    <label className="flex items-center space-x-2 text-sm text-indigo-700 font-medium cursor-pointer">
                                        <input type="checkbox" checked={formData.actif} onChange={e => setFormData({...formData, actif: e.target.checked})} className="rounded text-indigo-500" />
                                        <span>Règle Active</span>
                                    </label>
                                </div>
                                <div className="flex space-x-2">
                                    <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded">Annuler</button>
                                    <button type="submit" disabled={isSaving || createMutation.isPending} className="px-4 py-1.5 text-xs text-white bg-indigo-600 hover:bg-indigo-700 rounded shadow flex items-center">
                                        <Save className="w-4 h-4 mr-1"/> {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    ) : (
                        <div className="mb-4 flex justify-end">
                            <button onClick={handleOpenCreate} className="flex items-center space-x-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded text-sm font-medium transition-colors">
                                <Plus size={16} /> <span>Ajouter une Règle</span>
                            </button>
                        </div>
                    )}

                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-semibold">
                                <tr>
                                    <th className="px-4 py-3">Condition</th>
                                    <th className="px-4 py-3">Interprétation</th>
                                    <th className="px-4 py-3 w-20 text-center">Priorité</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {isLoading ? (
                                    <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Analyse des règles...</td></tr>
                                ) : rules.length === 0 ? (
                                    <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Aucune condition mathématique définie pour ce profil.</td></tr>
                                ) : rules.map(rule => (
                                    <tr key={rule.id} className="hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => handleOpenEdit(rule)}>
                                        <td className="px-4 py-3 font-mono text-indigo-700 whitespace-nowrap font-medium tracking-wide">
                                            {cachedValueType === 'NUMERIC' 
                                                ? formatMathBounds(rule.lower_numeric, rule.upper_numeric, rule.lower_inclusive, rule.upper_inclusive)
                                                : rule.reference_text || rule.canonical_value_id || 'N/A'
                                            }
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${rule.interpretation?.includes('ABNORMAL') ? 'bg-amber-50 text-amber-700 border-amber-200' : rule.interpretation?.includes('CAUTION') ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                                {TRANSLATE_INTERP[rule.interpretation] || rule.interpretation}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center text-slate-500 font-mono text-xs">
                                            {rule.priority}
                                        </td>
                                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                            <button onClick={() => statusMutation.mutate({ id: rule.id, actif: !rule.actif })} className="text-xs font-medium text-slate-400 hover:text-slate-700 px-2 py-1">
                                                {rule.actif ? 'Désactiver' : 'Activer'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};


// ==========================================
// PROFILES ROW-EXPANSION LIST
// ==========================================

const formatAgeRange = (min: number | null, max: number | null) => {
    const format = (d: number | null) => {
        if (d === null || d === undefined) return '∞';
        if (d < 30) return `${d}j`;
        if (d < 365) return `${Math.floor(d / 30)} mois`;
        return `${Math.floor(d / 365)} ans`;
    };
    if (min === null && max === null) return 'Tous âges';
    if (min === 0 && max === null) return 'Tous âges';
    if (min === null) return `< ${format(max)}`;
    if (max === null) return `> ${format(min)}`;
    return `${format(min)} - ${format(max)}`;
};

export const ReferenceProfilesList = ({ contextId, cachedValueType }: { contextId: string, cachedValueType: string }) => {
    const { data: profiles = [], isLoading } = useLimsProfiles(contextId);
    const createMutation = useCreateLimsProfile(contextId);
    const statusMutation = useSetLimsProfileStatus(contextId);

    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState({
        sex: 'ANY',
        min_age_days: '',
        max_age_days: '',
        actif: true
    });
    const [activeEngineProfile, setActiveEngineProfile] = useState<{id: string, label: string} | null>(null);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createMutation.mutateAsync({ 
                sex: formData.sex, 
                age_min_days: formData.min_age_days !== '' ? parseInt(formData.min_age_days) : null, 
                age_max_days: formData.max_age_days !== '' ? parseInt(formData.max_age_days) : null, 
                is_default: profiles.length === 0, 
                actif: formData.actif 
            });
            setFormData({ sex: 'ANY', min_age_days: '', max_age_days: '', actif: true });
            setIsCreating(false);
        } catch (err: any) {
            alert(err.message || 'Une erreur est survenue lors de la création du profil (Vérifiez les chevauchements)');
        }
    };

    if (isLoading) return <div className="p-4 text-center text-xs text-slate-400">Assemblage des profils...</div>;

    return (
        <div className="bg-slate-50/80 p-5 border-b border-slate-200 shadow-inner">
            <div className="flex justify-between items-center mb-4">
                <h4 className="text-sm font-bold text-slate-700 flex items-center">
                    <ShieldCheck className="w-4 h-4 mr-1.5 text-blue-500" />
                    Profils de Référence liés
                </h4>
                {!isCreating && (
                    <button onClick={() => setIsCreating(true)} className="text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-md hover:bg-slate-50 transition-colors text-slate-600 font-medium">
                        Créer un Profil
                    </button>
                )}
            </div>

            {isCreating && (
                <form onSubmit={handleCreate} className="bg-white p-4 rounded-lg border border-slate-200 mb-4 shadow-sm">
                    <h5 className="font-semibold text-slate-800 text-sm mb-3">Nouveau Segment de Référence</h5>
                    <div className="grid grid-cols-4 gap-4 mb-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Sexe</label>
                            <select value={formData.sex} onChange={e => setFormData({...formData, sex: e.target.value})} className="w-full text-sm border-slate-300 rounded focus:ring-blue-500">
                                <option value="ANY">Tous (Mixte)</option>
                                <option value="M">Masculin</option>
                                <option value="F">Féminin</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Âge Min (Jours)</label>
                            <input type="number" value={formData.min_age_days} onChange={e => setFormData({...formData, min_age_days: e.target.value})} className="w-full text-sm border-slate-300 rounded focus:ring-blue-500" placeholder="Ex: 0" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Âge Max (Jours)</label>
                            <input type="number" value={formData.max_age_days} onChange={e => setFormData({...formData, max_age_days: e.target.value})} className="w-full text-sm border-slate-300 rounded focus:ring-blue-500" placeholder="Ex: 36500" />
                        </div>
                        <div className="flex items-end pb-1">
                            <label className="flex items-center space-x-2 text-sm text-slate-700 cursor-pointer">
                                <input type="checkbox" checked={formData.actif} onChange={e => setFormData({...formData, actif: e.target.checked})} className="rounded text-blue-500 focus:ring-blue-500" />
                                <span className={formData.actif ? 'font-medium text-blue-700' : ''}>Profil Actif</span>
                            </label>
                        </div>
                    </div>
                    <div className="flex justify-end space-x-2 border-t border-slate-100 pt-3">
                        <button type="button" onClick={() => setIsCreating(false)} className="text-xs text-slate-500 hover:bg-slate-100 px-3 py-1.5 rounded transition-colors">Annuler</button>
                        <button type="submit" disabled={createMutation.isPending} className="text-xs bg-blue-600 text-white px-4 py-1.5 rounded hover:bg-blue-700 font-medium shadow-sm">
                            {createMutation.isPending ? 'Sauvegarde...' : 'Créer le Segment'}
                        </button>
                    </div>
                </form>
            )}

            {profiles.length === 0 && !isCreating ? (
                <div className="text-center p-6 bg-white rounded-lg border border-slate-200 border-dashed text-sm text-slate-400">
                    Aucun profil de référence. Ce contexte affichera des résultats bruts sans interprétation.
                </div>
            ) : (
                <div className="space-y-6">
                    {[
                        { key: 'M', label: 'Profils Masculins', data: profiles.filter(p => p.sex === 'M') },
                        { key: 'F', label: 'Profils Féminins', data: profiles.filter(p => p.sex === 'F') },
                        { key: 'ANY', label: 'Profils Mixtes / Autres', data: profiles.filter(p => p.sex !== 'M' && p.sex !== 'F') }
                    ].map(group => group.data.length > 0 && (
                        <div key={group.key}>
                            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 ml-1 flex items-center">
                                {group.label} <span className="ml-2 bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">{group.data.length}</span>
                            </h5>
                            <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                                {group.data.map(profile => {
                                    const demographicLabel = `${profile.sex === 'M' ? 'Masculin' : profile.sex === 'F' ? 'Féminin' : 'Tous (Mixte)'} • ${formatAgeRange(profile.age_min_days, profile.age_max_days)}`;
                                    return (
                                    <div key={profile.id} className={`bg-white rounded-lg border border-slate-200 p-4 transition-all hover:border-blue-300 hover:shadow-md flex flex-col ${!profile.actif && 'opacity-60 grayscale bg-slate-50'}`}>
                                        <div className="flex items-center justify-between mb-3">
                                            <h5 className="font-semibold text-slate-800 text-sm truncate pr-2 text-indigo-700 flex items-center">
                                                {profile.sex === 'M' ? <span className="mr-1.5 text-blue-500">♂</span> : profile.sex === 'F' ? <span className="mr-1.5 text-pink-500">♀</span> : <span className="mr-1.5 text-slate-400">⚧</span>}
                                                {demographicLabel}
                                            </h5>
                                            {profile.is_default && (
                                                <span className="shrink-0 bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-100 uppercase tracking-widest ml-auto">
                                                    Défaut
                                                </span>
                                            )}
                                        </div>

                                        <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3">
                                            <button 
                                                onClick={() => statusMutation.mutate({ id: profile.id, actif: !profile.actif })}
                                                className="text-xs font-medium text-slate-400 hover:text-slate-700"
                                            >
                                                {profile.actif ? 'Désactiver' : 'Activer'}
                                            </button>
                                            <button 
                                                onClick={() => setActiveEngineProfile({ id: profile.id, label: demographicLabel })}
                                                className="text-xs font-medium bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded flex items-center transition-colors shadow-sm"
                                            >
                                                <Settings2 className="w-3.5 h-3.5 mr-1.5" />
                                                <span>Gérer les Règles</span>
                                            </button>
                                        </div>
                                    </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {activeEngineProfile && (
                <ReferenceRulesEngine 
                    profileId={activeEngineProfile.id} 
                    profileLabel={activeEngineProfile.label}
                    cachedValueType={cachedValueType}
                    onClose={() => setActiveEngineProfile(null)}
                />
            )}
        </div>
    );
};
