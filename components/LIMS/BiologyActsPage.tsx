import React, { useState } from 'react';
import { 
    useLimsBiologyActs, 
    useLimsBiologyActDetails,
    useLimsContexts,
    useLimsConfigDictionaries,
    useAssignActContext,
    useUnassignActContext,
    useAssignActSpecimenContainer,
    useUnassignActSpecimenContainer,
    useAssignActTaxonomy
} from './useLimsConfig';
import { Beaker, Search, ChevronDown, ChevronRight, CheckCircle2, Link as LinkIcon, Save, Settings2 } from 'lucide-react';

import { SearchableSelect } from '../ui/SearchableSelect';

// ==========================================
// ACT EDITOR ROW-EXPANSION
// ==========================================
const BiologyActEditor = ({ actId, onClose }: { actId: string, onClose: () => void }) => {
    const { data: actDetails, isLoading: isActLoading } = useLimsBiologyActDetails(actId);
    const { data: allContexts = [], isLoading: isCtxLoading } = useLimsContexts();
    const { sousFamilles, sections, subSections, specimens, containers, specimenContainerTypes, isLoading: isDictLoading } = useLimsConfigDictionaries();

    const taxonomyMutation = useAssignActTaxonomy(actId);
    const assignCtxMutation = useAssignActContext(actId);
    const unassignCtxMutation = useUnassignActContext(actId);
    const assignSpecMutation = useAssignActSpecimenContainer(actId);
    const unassignSpecMutation = useUnassignActSpecimenContainer(actId);

    const [taxData, setTaxData] = useState({ sous_famille_id: '', section_id: '', sub_section_id: '' });
    const [pendingContextId, setPendingContextId] = useState('');
    const [pendingSpecimenId, setPendingSpecimenId] = useState('');
    const [pendingContainerId, setPendingContainerId] = useState('');

    // Prepopulate default container when specimen changes
    React.useEffect(() => {
        if (pendingSpecimenId) {
            const defaults = specimenContainerTypes.filter((sct: any) => sct.specimen_type_id === pendingSpecimenId);
            const defaultType = defaults.find((d: any) => d.is_default) || defaults[0];
            if (defaultType) {
                setPendingContainerId(defaultType.container_type_id);
            } else {
                setPendingContainerId('');
            }
        } else {
            setPendingContainerId('');
        }
    }, [pendingSpecimenId, specimenContainerTypes]);

    // Sync taxonomic data on load
    React.useEffect(() => {
        if (actDetails) {
            setTaxData({
                sous_famille_id: actDetails.sous_famille_id || '',
                section_id: actDetails.section_id || '',
                sub_section_id: actDetails.sub_section_id || ''
            });
        }
    }, [actDetails]);

    if (isActLoading || isCtxLoading || isDictLoading) {
        return <div className="p-6 text-center text-sm text-slate-400">Synchronisation des détails de l'acte...</div>;
    }

    const { contexts = [], specimens: specimenTypes = [] } = actDetails || {};
    const unassignedContexts = allContexts.filter(c => !contexts.some((assigned: any) => assigned.analyte_context_id === c.id));
    // Now we can assign multiple combinations, but generally let's allow all specimens. 
    // Just map specimenOptions.
    const specimenOptions = specimens.map((s: any) => ({
        value: s.id,
        label: s.libelle,
        searchValue: s.libelle
    }));

    const allowedContainerOptions = pendingSpecimenId 
        ? specimenContainerTypes.filter((sct: any) => sct.specimen_type_id === pendingSpecimenId)
            .map((sct: any) => {
                const c = containers.find(cont => cont.id === sct.container_type_id);
                return {
                    value: sct.container_type_id,
                    label: c ? c.libelle : 'Inconnu',
                    searchValue: c ? c.libelle : 'Inconnu'
                };
            })
        : [];

    const handleSaveTaxonomy = async () => {
        await taxonomyMutation.mutateAsync({
            sous_famille_id: taxData.sous_famille_id || null,
            section_id: taxData.section_id || null,
            sub_section_id: taxData.sub_section_id || null
        });
    };

    const contextOptions = unassignedContexts.map((c: any) => ({
        value: c.id,
        label: `${c.analyte_label} (${c.method_label || 'Std'} | ${c.unit_label || 'Sans Unité'})`,
        searchValue: `${c.analyte_label} ${c.method_label || 'Std'} ${c.unit_label || ''}`
    }));

    return (
        <div className="bg-slate-50/80 p-6 border-b border-slate-200 grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* TOP/FULL WIDTH: Taxonomy Settings */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h4 className="font-bold text-slate-800 text-sm mb-4 border-b pb-2 flex items-center justify-between">
                    <div className="flex items-center">
                        <Settings2 className="w-4 h-4 mr-2 text-blue-500" /> Taxonomie Clinique
                    </div>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Discipline (Sous-famille)</label>
                        <SearchableSelect 
                            options={[{ label: 'Non assignée', value: '' }, ...sousFamilles.map(sf => ({ label: sf.libelle, value: sf.id }))]}
                            value={taxData.sous_famille_id}
                            onChange={v => setTaxData({...taxData, sous_famille_id: v})}
                            placeholder="Choisir une discipline..."
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Chapitre (Section)</label>
                        <SearchableSelect 
                            options={[{ label: 'Non assigné', value: '' }, ...sections.map(s => ({ label: s.libelle, value: s.id }))]}
                            value={taxData.section_id}
                            onChange={v => setTaxData({...taxData, section_id: v})}
                            placeholder="Choisir un chapitre..."
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Sous-chapitre</label>
                        <SearchableSelect 
                            options={[{ label: 'Non assigné', value: '' }, ...subSections.map(ss => ({ label: ss.libelle, value: ss.id }))]}
                            value={taxData.sub_section_id}
                            onChange={v => setTaxData({...taxData, sub_section_id: v})}
                            placeholder="Choisir un sous-chapitre..."
                        />
                    </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                    <button 
                        onClick={handleSaveTaxonomy}
                        disabled={taxonomyMutation.isPending}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-4 py-2 rounded flex items-center shadow-sm disabled:opacity-50 transition-colors"
                    >
                        <Save className="w-4 h-4 mr-1"/> Enregistrer Taxonomie
                    </button>
                </div>
            </div>

            {/* LEFT BOTTOM: Contexts */}
            <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h4 className="font-bold text-slate-800 text-sm mb-4 border-b pb-2 flex items-center justify-between">
                    <span className="flex items-center"><Beaker className="w-4 h-4 mr-2 text-indigo-500" /> Contextes (Paramètres Calculés)</span>
                    <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full text-slate-600 font-medium">{contexts.length} assignés</span>
                </h4>
                
                <div className="max-h-64 overflow-y-auto mb-4 border rounded border-slate-100">
                    <table className="w-full text-xs text-left">
                        <tbody className="divide-y divide-slate-100">
                            {contexts.map((c: any) => (
                                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-3 py-2 font-medium text-slate-700">{c.analyte_label}</td>
                                    <td className="px-3 py-2 text-slate-500">{c.method_label || 'Std'} | {c.unit_label || 'Sans Unité'}</td>
                                    <td className="px-3 py-2 text-right">
                                        <button onClick={() => unassignCtxMutation.mutate(c.id)} className="text-rose-600 hover:bg-rose-50 px-2 py-1 rounded transition-colors">Retirer</button>
                                    </td>
                                </tr>
                            ))}
                            {contexts.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-slate-400">Aucun contexte lié.</td></tr>}
                        </tbody>
                    </table>
                </div>

                <div className="pt-2 border-t border-slate-100">
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Ajouter un Contexte Disponible</label>
                    <div className="flex space-x-2 w-full overflow-visible">
                        <div className="flex-1 min-w-0">
                            <SearchableSelect 
                                options={contextOptions}
                                value={pendingContextId}
                                onChange={setPendingContextId}
                                placeholder="Sélectionner un contexte configuré..."
                            />
                        </div>
                        <button 
                            onClick={() => {
                                if (pendingContextId) {
                                    assignCtxMutation.mutate({ analyte_context_id: pendingContextId, is_required: true, is_reportable: true });
                                    setPendingContextId('');
                                }
                            }}
                            className="bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors text-xs font-medium px-3 rounded whitespace-nowrap shrink-0 h-[34px]"
                        >
                            Associer
                        </button>
                    </div>
                </div>
            </div>

            {/* RIGHT BOTTOM: Specimen Types */}
            <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h4 className="font-bold text-slate-800 text-sm mb-4 border-b pb-2 flex items-center justify-between">
                    <span className="flex items-center"><LinkIcon className="w-4 h-4 mr-2 text-amber-500" /> Types de Prélèvement</span>
                    <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full text-slate-600 font-medium">{specimenTypes.length} liés</span>
                </h4>
                
                <div className="max-h-64 overflow-y-auto mb-4 border rounded border-slate-100">
                    <table className="w-full text-xs text-left">
                        <tbody className="divide-y divide-slate-100">
                            {specimenTypes.map((st: any) => (
                                <tr key={st.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-3 py-2">
                                        <div className="font-medium text-slate-700">{st.specimen_label}</div>
                                        {st.container_label && (
                                            <div className="flex items-center text-[11px] text-slate-500 mt-0.5">
                                                <div 
                                                    className="w-2.5 h-2.5 rounded-full mr-1.5 border border-slate-300 shadow-sm"
                                                    style={{ backgroundColor: st.container_color !== 'AUCUNE' ? st.container_color : '#ffffff' }}
                                                />
                                                {st.container_label}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-right align-middle">
                                        <button onClick={() => unassignSpecMutation.mutate(st.id)} className="text-rose-600 hover:bg-rose-50 px-2 py-1 rounded transition-colors">Retirer</button>
                                    </td>
                                </tr>
                            ))}
                            {specimenTypes.length === 0 && <tr><td colSpan={2} className="p-4 text-center text-slate-400">Aucun tube imposé.</td></tr>}
                        </tbody>
                    </table>
                </div>

                <div className="pt-2 border-t border-slate-100">
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Imposer un Nouveau Prélèvement</label>
                    <div className="flex flex-col space-y-2 w-full overflow-visible">
                        <div className="flex space-x-2">
                            <div className="flex-1 min-w-0">
                                <SearchableSelect 
                                    options={specimenOptions}
                                    value={pendingSpecimenId}
                                    onChange={setPendingSpecimenId}
                                    placeholder="Sélectionner un type de prélèvement..."
                                />
                            </div>
                            <div className="flex-1 min-w-0">
                                <SearchableSelect 
                                    options={allowedContainerOptions}
                                    value={pendingContainerId}
                                    onChange={setPendingContainerId}
                                    placeholder={pendingSpecimenId ? "Sélectionner un récipient..." : "Choisissez d'abord un prélèvement"}
                                    disabled={!pendingSpecimenId || allowedContainerOptions.length === 0}
                                />
                            </div>
                            <button 
                                onClick={() => {
                                    if (pendingSpecimenId && pendingContainerId) {
                                        assignSpecMutation.mutate({ specimen_type_id: pendingSpecimenId, container_type_id: pendingContainerId, is_required: true });
                                        setPendingSpecimenId('');
                                        setPendingContainerId('');
                                    }
                                }}
                                disabled={!pendingSpecimenId || !pendingContainerId || assignSpecMutation.isPending}
                                className="bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors text-xs font-medium px-3 rounded whitespace-nowrap shrink-0 h-[34px] disabled:opacity-50"
                            >
                                Associer
                            </button>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};


// ==========================================
// MAIN DASHBOARD
// ==========================================
export const BiologyActsPage = () => {
    const { data: acts = [], isLoading } = useLimsBiologyActs();
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedActId, setExpandedActId] = useState<string | null>(null);

    const filteredActs = acts.filter(a => 
        (a.titre || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.code_acte || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-slate-50/50">
            {/* Header */}
            <div className="bg-white px-8 py-5 border-b border-slate-200 flex justify-between items-center shrink-0 shadow-sm z-10">
                <div>
                    <h1 className="text-xl font-bold text-slate-800 flex items-center">
                        <Beaker className="w-6 h-6 mr-2 text-blue-600" />
                        Actes Biologiques
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">Gérer la composition des actes facturables par le Laboratoire</p>
                </div>
            </div>

            {/* List Engine */}
            <div className="flex-1 overflow-auto p-8">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                        <div className="relative w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Rechercher un acte (nom, code NGAP)..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            />
                        </div>
                        <div className="text-sm text-slate-500 font-medium bg-white px-3 py-1 rounded-full border border-slate-200">
                            {filteredActs.length} Actes répertoriés
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                                    <th className="px-6 py-4">Acte Financier / Code</th>
                                    <th className="px-6 py-4">Taxonomie LIMS</th>
                                    <th className="px-6 py-4">Composition Contextuelle</th>
                                    <th className="px-6 py-4">Tubes Imposés</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm divide-y divide-slate-100">
                                {isLoading ? (
                                    <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">Chargement du catalogue...</td></tr>
                                ) : filteredActs.length === 0 ? (
                                    <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">Aucun acte biologique ne correspond.</td></tr>
                                ) : filteredActs.map((act) => (
                                    <React.Fragment key={act.id}>
                                        <tr className={`transition-colors group ${expandedActId === act.id ? 'bg-blue-50/40' : 'hover:bg-slate-50'}`}>
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-slate-800 flex items-center">
                                                    <button 
                                                        onClick={() => setExpandedActId(expandedActId === act.id ? null : act.id)}
                                                        className="mr-2 text-slate-400 hover:text-blue-600 transition-colors focus:outline-none"
                                                    >
                                                        {expandedActId === act.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                    </button>
                                                    <span className="cursor-pointer hover:text-blue-600 transition-colors" onClick={() => setExpandedActId(expandedActId === act.id ? null : act.id)}>
                                                        {act.titre}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-slate-500 font-mono mt-0.5 ml-8">{act.code}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {act.sous_famille_label ? (
                                                    <div className="flex items-center text-xs">
                                                        <span className="font-medium text-slate-700">{act.sous_famille_label}</span>
                                                        {act.section_label && <><span className="mx-1.5 text-slate-300">/</span><span className="text-slate-600">{act.section_label}</span></>}
                                                    </div>
                                                ) : <span className="text-slate-400 italic text-xs">A classer</span>}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold border ${act.context_count > 0 ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                                                    {act.context_count} Contextes de restitution
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold border ${act.specimen_count > 0 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                                                    {act.specimen_count} Récipients requis
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => setExpandedActId(expandedActId === act.id ? null : act.id)}
                                                    className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${expandedActId === act.id ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700' : 'border-blue-200 text-blue-700 hover:bg-blue-50'}`}
                                                >
                                                    {expandedActId === act.id ? 'Fermer' : 'Éditer Composition'}
                                                </button>
                                            </td>
                                        </tr>
                                        {expandedActId === act.id && (
                                            <tr>
                                                <td colSpan={5} className="p-0 border-b border-slate-200">
                                                    <BiologyActEditor actId={act.id} onClose={() => setExpandedActId(null)} />
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
