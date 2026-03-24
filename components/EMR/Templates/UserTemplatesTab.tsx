import React, { useState, useEffect, useContext, useRef } from 'react';
import { FileText, Plus, Search, Edit2, Copy, Save, Shield, Compass, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { TemplateEditor } from '../../ui/TemplateEditor/TemplateEditor';
import { useWorkspace } from '../../../context/WorkspaceContext';
import { api } from '../../../services/api';

export const UserTemplatesTab: React.FC = () => {
    const [phrases, setPhrases] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPhrase, setSelectedPhrase] = useState<any | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    
    // Form State
    const [formData, setFormData] = useState({
        trigger: '',
        label: '',
        description: '',
        body_html: '',
        scope: 'user'
    });

    const [isDraftFromImport, setIsDraftFromImport] = useState(false);

    const workspaceContext = useWorkspace();
    
    const isEditingRef = useRef(isEditing);
    const formDataRef = useRef(formData);
    useEffect(() => { isEditingRef.current = isEditing; }, [isEditing]);
    useEffect(() => { formDataRef.current = formData; }, [formData]);

    useEffect(() => {
        const myTab = workspaceContext?.workspaceTabs.find(t => t.workspaceId === 'ws-utility-templates');
        const payload = myTab?.initialPayload;
        
        if (payload?.staticImportSnapshot && payload.source === 'clinical_editor') {
            if (workspaceContext?.clearTabPayload) {
                workspaceContext.clearTabPayload('ws-utility-templates');
            }

            const initializeDraft = () => {
                setSelectedPhrase(null);
                setFormData({
                    trigger: '',
                    label: '',
                    description: '',
                    body_html: payload.staticImportSnapshot,
                    scope: 'user'
                });
                setIsEditing(true);
                setIsDraftFromImport(true);
            };

            const currentIsEditing = isEditingRef.current;
            const currentData = formDataRef.current;
            const hasUnsavedContent = currentIsEditing && !selectedPhrase && (currentData.trigger || currentData.label || currentData.body_html);

            if (hasUnsavedContent) {
                if (window.confirm("Un brouillon non enregistré est ouvert. Voulez-vous le remplacer par le contenu importé de l'éditeur clinique ?")) {
                    initializeDraft();
                }
            } else {
                initializeDraft();
            }
        }
    }, [workspaceContext?.workspaceTabs, workspaceContext?.clearTabPayload, selectedPhrase]);

    const fetchPhrases = async () => {
        setIsLoading(true);
        try {
            const data = await api.getSmartPhrases();
            // User level manager sees all: system, tenant, user
            setPhrases(data);
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPhrases();
    }, []);

    const handleSelectPhrase = (phrase: any) => {
        setSelectedPhrase(phrase);
        setFormData({
            trigger: phrase.trigger || '',
            label: phrase.label || '',
            description: phrase.description || '',
            body_html: phrase.body_html || '',
            scope: phrase.scope || 'user'
        });
        setIsEditing(false);
        setIsDraftFromImport(false);
    };

    const handleCreateNew = () => {
        setSelectedPhrase(null);
        setFormData({ trigger: '', label: '', description: '', body_html: '', scope: 'user' });
        setIsEditing(true);
        setIsDraftFromImport(false);
    };

    const handleDuplicate = () => {
        if (!selectedPhrase) return;
        // Duplicate creates a new user-scoped phrase. Trigger must be changed by user, but we prefix it to avoid conflict.
        setSelectedPhrase(null);
        setFormData({
            trigger: `${selectedPhrase.trigger}_copy`,
            label: `${selectedPhrase.label || 'Copie'} (Copie)`,
            description: selectedPhrase.description || '',
            body_html: selectedPhrase.body_html || '',
            scope: 'user'
        });
        setIsEditing(true);
        setIsDraftFromImport(false);
        toast('Duplication en cours: veuillez définir un nouveau trigger', { icon: '📝' });
    };

    const handleSave = async () => {
        if (!formData.trigger || !formData.body_html) {
            toast.error('Trigger and content are required');
            return;
        }

        const isNew = !selectedPhrase;

        try {
            const payload = {...formData, scope: 'user'};
            let savedPhrase;
            if (isNew) {
                savedPhrase = await api.createSmartPhrase(payload);
                toast.success('Smart Phrase personnelle créée!');
            } else {
                savedPhrase = await api.updateSmartPhrase(selectedPhrase.id, payload);
                toast.success('Smart Phrase personnelle mise à jour!');
            }

            fetchPhrases();
            setIsEditing(false);
            
            handleSelectPhrase(savedPhrase);

        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const filteredPhrases = phrases.filter(p => 
        p.trigger?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.label?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-slate-50 relative rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 p-6 z-10 shrink-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-[1600px] w-full">
                    <div>
                        <h1 className="text-xl font-black text-slate-800 flex items-center gap-3">
                            <div className="bg-emerald-100 p-2 rounded-lg">
                                <FileText className="text-emerald-600 w-5 h-5" />
                            </div>
                            Mes Templates Personnels
                        </h1>
                        <p className="text-slate-500 text-sm mt-1">Gérez vos textes standards et phrases rapides pour ce patient (et tous vos autres patients).</p>
                    </div>
                    <button 
                        onClick={handleCreateNew}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-bold text-sm tracking-wide rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Nouvelle Phrase Perso
                    </button>
                </div>
            </div>

            {/* Main Content: Two Columns */}
            <div className="flex-1 overflow-hidden flex w-full p-6 gap-6">
                
                {/* Left Column: List */}
                <div className="w-1/3 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Rechercher (trigger, label)..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                            />
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-2">
                        {isLoading ? (
                            <div className="p-4 text-center text-slate-400 text-sm">Chargement...</div>
                        ) : filteredPhrases.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-sm">
                                <FileText className="w-8 h-8 mx-auto mb-3 opacity-20" />
                                Aucune phrase trouvée
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {filteredPhrases.map(phrase => (
                                    <button
                                        key={phrase.id}
                                        onClick={() => handleSelectPhrase(phrase)}
                                        className={`w-full text-left p-3 rounded-lg flex items-start gap-3 transition-colors ${
                                            selectedPhrase?.id === phrase.id 
                                                ? 'bg-emerald-50 border border-emerald-100' 
                                                : 'hover:bg-slate-50 border border-transparent'
                                        }`}
                                    >
                                        <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                                            phrase.is_active 
                                                ? (phrase.scope === 'system' ? 'bg-indigo-400' : phrase.scope === 'tenant' ? 'bg-sky-400' : 'bg-emerald-500') 
                                                : 'bg-slate-300'
                                        }`} />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-1">
                                                <span className={`font-semibold text-sm truncate ${selectedPhrase?.id === phrase.id ? 'text-emerald-900' : 'text-slate-900'}`}>
                                                    /{phrase.trigger}
                                                </span>
                                                <span className={`text-[9px] uppercase font-bold tracking-wider px-1 py-0.5 rounded shrink-0 ${
                                                    phrase.scope === 'system' ? 'text-indigo-600 bg-indigo-100' 
                                                    : phrase.scope === 'tenant' ? 'text-sky-700 bg-sky-100'
                                                    : 'text-emerald-700 bg-emerald-100 border border-emerald-200'
                                                }`}>
                                                    {phrase.scope}
                                                </span>
                                            </div>
                                            <p className={`text-xs truncate mt-0.5 ${selectedPhrase?.id === phrase.id ? 'text-emerald-600/80' : 'text-slate-500'}`}>
                                                {phrase.label || phrase.description || 'Sans description'}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Editor */}
                <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                    {(!selectedPhrase && !isEditing) ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                <FileText className="w-8 h-8 text-slate-300" />
                            </div>
                            <h3 className="text-slate-600 font-medium mb-1">Aucune phrase sélectionnée</h3>
                            <p className="text-sm max-w-sm">Sélectionnez une template dans la liste pour la voir ou créez une nouvelle template spécifique pour vous.</p>
                        </div>
                    ) : (
                        <>
                            {/* Editor Header */}
                            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
                                <div className="max-w-[70%]">
                                    <h2 className="font-semibold text-slate-900 flex items-center gap-2 truncate">
                                        {!selectedPhrase ? 'Nouvelle Phrase Personnelle' : (isEditing ? 'Édition de votre phrase' : formData.label || 'Détails de la phrase')}
                                        {selectedPhrase && selectedPhrase.scope !== 'user' && !isEditing && (
                                            <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full uppercase font-bold shrink-0 ${
                                                selectedPhrase.scope === 'system' ? 'border border-indigo-200 bg-indigo-50 text-indigo-700' : 'border border-sky-200 bg-sky-50 text-sky-700'
                                            }`}>
                                                <Shield className="w-3 h-3" />
                                                Verrouillé ({selectedPhrase.scope})
                                            </span>
                                        )}
                                    </h2>
                                    {selectedPhrase && <p className="text-xs text-slate-500 mt-0.5">/{formData.trigger}</p>}
                                </div>
                                <div className="flex items-center gap-2">
                                    {isEditing ? (
                                        <>
                                            <button 
                                                onClick={() => {
                                                    if(selectedPhrase) handleSelectPhrase(selectedPhrase);
                                                    else { setSelectedPhrase(null); setIsEditing(false); }
                                                }}
                                                className="px-3 py-1.5 text-sm font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                                            >
                                                Annuler
                                            </button>
                                            <button 
                                                onClick={handleSave}
                                                className="px-3 py-1.5 text-sm font-bold text-white bg-emerald-600 border border-transparent rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm shadow-emerald-600/20"
                                            >
                                                <Save className="w-4 h-4" />
                                                Enregistrer
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button 
                                                onClick={handleDuplicate}
                                                className="px-3 py-1.5 text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
                                            >
                                                <Copy className="w-4 h-4" />
                                                Dupliquer pr Moi
                                            </button>
                                            
                                            {selectedPhrase.scope === 'user' && (
                                                <button 
                                                    onClick={() => setIsEditing(true)}
                                                    className="px-3 py-1.5 text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-2"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                    Modifier
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                            
                            {/* Editor Body */}
                            <div className={`flex-1 overflow-y-auto p-6 ${selectedPhrase?.scope !== 'user' && !isEditing ? 'bg-slate-50/50' : ''}`}>
                                <div className="max-w-2xl space-y-6">
                                    {selectedPhrase?.scope !== 'user' && !isEditing ? (
                                        <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900 flex gap-3">
                                            <Shield className="w-5 h-5 text-amber-500 shrink-0" />
                                            <div>
                                                Cette phrase est gérée au niveau <strong>{selectedPhrase.scope.toUpperCase()}</strong> et ne peut pas être modifiée directement. 
                                                <br/>
                                                <button onClick={handleDuplicate} className="text-amber-700 font-bold hover:underline mt-1">Dupliquez-la</button> pour créer une version personnelle modifiable.
                                            </div>
                                        </div>
                                    ) : null}

                                    {isDraftFromImport && (
                                        <div className="bg-sky-50/50 border border-sky-200 rounded-lg p-3 text-sm text-sky-800 flex items-center gap-3 shadow-sm">
                                            <Info className="w-5 h-5 text-sky-500 shrink-0" />
                                            <div>Contenu importé depuis l’éditeur clinique. Vous pouvez maintenant définir un trigger et l'ajuster.</div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="col-span-2 sm:col-span-1">
                                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                                Trigger <span className="text-red-500">*</span>
                                            </label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono">/</span>
                                                <input
                                                    type="text"
                                                    value={formData.trigger}
                                                    onChange={(e) => setFormData({...formData, trigger: e.target.value})}
                                                    disabled={!isEditing}
                                                    className="w-full pl-7 pr-3 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 disabled:opacity-70 disabled:bg-slate-100 transition-all"
                                                    placeholder="exam"
                                                />
                                            </div>
                                            <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-widest shadow-none">Idéal: sans espace</p>
                                        </div>
                                        
                                        <div className="col-span-2 sm:col-span-1">
                                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Label court</label>
                                            <input
                                                type="text"
                                                value={formData.label}
                                                onChange={(e) => setFormData({...formData, label: e.target.value})}
                                                disabled={!isEditing}
                                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 disabled:opacity-70 disabled:bg-slate-100 transition-all"
                                                placeholder="Ex: Examen Physique"
                                            />
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Description (Optionnelle)</label>
                                        <input
                                            type="text"
                                            value={formData.description}
                                            onChange={(e) => setFormData({...formData, description: e.target.value})}
                                            disabled={!isEditing}
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 disabled:opacity-70 disabled:bg-slate-100 transition-all"
                                            placeholder="Mémo pour vous-même..."
                                        />
                                    </div>
                                    
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                            Contenu <span className="text-red-500">*</span>
                                        </label>
                                        <TemplateEditor 
                                            value={formData.body_html} 
                                            onChange={(val) => setFormData({...formData, body_html: val})} 
                                            disabled={!isEditing}
                                            availablePhrases={phrases}
                                            currentTrigger={formData.trigger}
                                        />
                                        <div className="flex items-start gap-2 mt-3 p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                                            <Compass className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                            <p className="text-[11px] text-emerald-800 leading-relaxed">
                                                <strong>Tokens intelligents :</strong> Vous pouvez insérer des tokens tels que <code>{`{{vitals}}`}</code>, <code>{`{{allergies}}`}</code>, ou <code>{`{{cursor}}`}</code> via la barre d'outils de l'éditeur pour pré-remplir les données ou positionner le curseur.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
