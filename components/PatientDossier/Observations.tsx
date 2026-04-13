import React, { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Info, FileText, FilePlus, ShieldAlert, AlertTriangle } from 'lucide-react';
import { api } from '../../services/api';



export interface ObservationRecord {
    id: string;
    note_type: 'ADMISSION' | 'PROGRESS' | 'DISCHARGE' | 'CONSULT' | 'GENERAL' | 'INTERP_ECG' | 'INTERP_ECHO';
    privacy_level: 'NORMAL' | 'SENSITIVE' | 'RESTRICTED';
    author_role: 'DOCTOR' | 'NURSE';
    status: 'DRAFT' | 'SIGNED' | 'ENTERED_IN_ERROR';
    declared_time: string;
    created_at: string;
    author_first_name?: string;
    author_last_name?: string;
    created_by: string;
    parent_observation_id?: string;
    body_html: string;
    body_plain: string;
    entered_in_error_by?: string;
    entered_in_error_at?: string;
    entered_in_error_reason?: string;
}

interface ObservationsProps {
    patientId: string;
    isActiveWorkspace?: boolean;
    isActiveTab?: boolean;
    openObservationEditor?: (config: { mode: 'CREATE' | 'EDIT' | 'VIEW' | 'ADDENDUM', note?: Partial<ObservationRecord>, parentNote?: ObservationRecord }) => void;
    refreshTrigger?: number;
}

export const Observations: React.FC<ObservationsProps> = ({ patientId, isActiveWorkspace = true, isActiveTab = true, openObservationEditor, refreshTrigger = 0 }) => {
    const [observations, setObservations] = useState<ObservationRecord[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Filters
    const [filterAuthor, setFilterAuthor] = useState<'ALL' | 'DOCTOR' | 'NURSE' | 'MINE'>('ALL');
    const [filterStatus, setFilterStatus] = useState<'ALL' | 'DRAFT' | 'SIGNED'>('ALL');
    const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

    // In a real app we'd get the actual user ID from a context provider, assuming here it's accessible or we omit 'MINE' filter logic for now if unavailable locally.
    const currentUserId = ""; // TODO: If user UUID is needed for 'MINE' filter, pass it as prop or fetch from auth context.

    const loadObservations = async () => {
        setLoading(true);
        try {
            const data = await api.getPatientObservations(patientId);
            setObservations(data);
        } catch (err: any) {
            console.error("Failed to load observations", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (patientId) loadObservations();
    }, [patientId, refreshTrigger]);

    const openCreateForm = () => {
        if (openObservationEditor) {
            openObservationEditor({ mode: 'CREATE' });
        }
    };

    const openEditDraft = (obs: ObservationRecord) => {
        if (openObservationEditor) {
            openObservationEditor({ mode: 'EDIT', note: obs });
        }
    };

    const openAddendum = (parent: ObservationRecord) => {
        if (openObservationEditor) {
            openObservationEditor({ mode: 'ADDENDUM', parentNote: parent });
        }
    };

    const openViewOnly = (obs: ObservationRecord) => {
        if (openObservationEditor) {
            openObservationEditor({ mode: 'VIEW', note: obs });
        }
    };

    const toggleExpansion = (id: string) => {
        setExpandedNotes(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Filter Logic
    const DisplayedObservations = observations.filter(obs => {
        if (filterAuthor === 'DOCTOR' && obs.author_role !== 'DOCTOR') return false;
        if (filterAuthor === 'NURSE' && obs.author_role !== 'NURSE') return false;
        if (filterStatus !== 'ALL' && obs.status !== filterStatus) return false;
        // if (filterAuthor === 'MINE' && obs.created_by !== currentUserId) return false; // Enable if currentUserId is known globally
        return true;
    });

    // Structure for parent/child hierarchy
    const primaryNotes = DisplayedObservations.filter(o => !o.parent_observation_id);
    const addendums = DisplayedObservations.filter(o => o.parent_observation_id);

    // Date formatter
    const formatDateTime = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString("fr-FR") + " " + d.toLocaleTimeString("fr-FR", { hour: '2-digit', minute:'2-digit' });
    };

    return (
        <div className="flex h-full min-h-0 w-full overflow-hidden bg-white shadow-sm border border-gray-200 rounded-xl">
            {/* LEFT SIDE: NOTE LIST */}
            <div className={`p-6 transition-all duration-300 ease-in-out w-full overflow-y-auto`}>
                
                {/* Filters Toolbar */}
                <div className="flex flex-wrap gap-3 mb-6 bg-white p-3 rounded-xl border border-gray-200 shadow-sm justify-between items-center relative">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center space-x-1 border-r border-gray-200 pr-3">
                            <span className="text-xs font-bold text-gray-400 mr-2 uppercase">Auteur:</span>
                            {['ALL', 'DOCTOR', 'NURSE'].map(role => (
                                <button 
                                    key={role}
                                    onClick={() => setFilterAuthor(role as any)}
                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${filterAuthor === role ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'}`}
                                >
                                    {role === 'ALL' ? 'Tous' : role === 'DOCTOR' ? 'Médecins' : 'Infirmiers'}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center space-x-1 pl-1">
                            <span className="text-xs font-bold text-gray-400 mr-2 uppercase">Statut:</span>
                            {['ALL', 'SIGNED', 'DRAFT'].map(stat => (
                                <button 
                                    key={stat}
                                    onClick={() => setFilterStatus(stat as any)}
                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${filterStatus === stat ? 'bg-emerald-100 text-emerald-700' : 'text-gray-500 hover:bg-gray-100'}`}
                                >
                                    {stat === 'ALL' ? 'Tous' : stat === 'SIGNED' ? 'Signées' : 'Brouillons'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button 
                        onClick={openCreateForm}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-xs rounded-lg font-bold shadow-sm transition-colors flex items-center gap-1.5 ml-auto"
                    >
                        <Plus size={14} strokeWidth={3} />
                        Nouvelle Observation
                    </button>
                </div>

                {loading ? (
                    <div className="text-center py-12"><div className="animate-pulse flex flex-col items-center"><div className="h-10 w-10 bg-gray-200 rounded-full mb-4"></div><div className="h-4 w-32 bg-gray-200 rounded"></div></div></div>
                ) : primaryNotes.length === 0 ? (
                    <div className="text-center py-20 bg-white border border-gray-200 border-dashed rounded-xl">
                        <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                        <h3 className="text-gray-900 font-medium">Aucune observation trouvée</h3>
                        <p className="text-gray-500 text-sm mt-1">Modifiez les filtres ou créez une nouvelle note.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {primaryNotes.map(note => {
                            const isDraft = note.status === 'DRAFT';
                            const isEnteredInError = note.status === 'ENTERED_IN_ERROR';
                            const noteAddendums = addendums.filter(a => a.parent_observation_id === note.id);
                            const isExpanded = expandedNotes.has(note.id);
                            const previewText = note.body_plain.slice(0, 300) + (note.body_plain.length > 300 ? '...' : '');
                            const needsExpansion = note.body_plain.length > 300 || noteAddendums.length > 0;

                            return (
                                <div key={note.id} className={`bg-white border rounded-xl shadow-sm overflow-hidden transition-all ${
                                    isEnteredInError ? 'border-red-300 opacity-60' 
                                    : isDraft ? 'border-amber-300' 
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}>
                                    {/* Entered in Error Banner */}
                                    {isEnteredInError && (
                                        <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center gap-2">
                                            <ShieldAlert size={13} className="text-red-500 shrink-0" />
                                            <span className="text-xs font-bold text-red-700 uppercase tracking-wide">Saisi par erreur</span>
                                            {note.entered_in_error_reason && (
                                                <span className="text-xs text-red-600 ml-1">— {note.entered_in_error_reason}</span>
                                            )}
                                        </div>
                                    )}
                                    {/* Header */}
                                    <div className="px-4 py-3 bg-gray-50/50 border-b border-gray-100 flex justify-between items-start">
                                        <div className="flex items-start gap-3">
                                            <div className="pt-1">
                                                {note.author_role === 'DOCTOR' ? (
                                                    <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs" title="Médecin">MD</div>
                                                ) : (
                                                    <div className="h-8 w-8 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center font-bold text-xs" title="Infirmier">IDE</div>
                                                )}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold text-gray-900 text-sm">
                                                        {note.author_role === 'DOCTOR' ? 'Dr.' : 'Inf.'} {note.author_last_name} {note.author_first_name?.charAt(0)}.
                                                    </span>
                                                    <span className="text-xs text-gray-400">&bull;</span>
                                                    <span className="text-xs font-medium text-gray-500">{formatDateTime(note.declared_time)}</span>
                                                    {isDraft && <span className="text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Brouillon</span>}
                                                    {isEnteredInError && <span className="text-[10px] font-bold uppercase tracking-wide bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Erreur</span>}
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600 border border-gray-200 px-1.5 py-0.5 rounded-sm">
                                                        {note.note_type === 'INTERP_ECG' ? 'Interp. ECG'
                                                          : note.note_type === 'INTERP_ECHO' ? 'Interp. Écho'
                                                          : note.note_type}
                                                    </span>
                                                    {note.privacy_level !== 'NORMAL' && <span className="text-[10px] uppercase font-bold text-rose-600 border border-rose-200 bg-rose-50 px-1.5 py-0.5 rounded-sm"><ShieldAlert size={10} className="inline mr-1 pb-[1px]"/>{note.privacy_level}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {isDraft ? (
                                                <button onClick={() => openEditDraft(note)} className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors flex items-center border border-blue-200">
                                                    <Edit2 size={12} className="mr-1.5"/> Reprendre
                                                </button>
                                            ) : isEnteredInError ? null : (
                                                <>
                                                    <button onClick={() => openViewOnly(note)} className="text-gray-400 hover:text-gray-700 bg-white border border-gray-200 px-2.5 py-1.5 rounded-md hover:bg-gray-50 transition-colors" title="Détails">
                                                        <Info size={14} />
                                                    </button>
                                                    {/* Only offer addendum on non-auto notes */}
                                                    {note.note_type !== 'INTERP_ECG' && note.note_type !== 'INTERP_ECHO' && (
                                                        <button onClick={() => openAddendum(note)} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-md transition-colors flex items-center border border-indigo-200">
                                                            <FilePlus size={12} className="mr-1.5"/> Addendum
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={async () => {
                                                            const reason = window.prompt('Raison de la saisie par erreur (optionnel):') ?? undefined;
                                                            if (reason === null) return; // cancelled
                                                            try {
                                                                await api.enterObservationInError(note.id, reason || undefined);
                                                                loadObservations();
                                                            } catch(e: any) { alert(e.message); }
                                                        }}
                                                        className="text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-md transition-colors flex items-center border border-red-200"
                                                        title="Marquer comme saisi par erreur"
                                                    >
                                                        <AlertTriangle size={12} className="mr-1"/> Erreur
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Body content */}
                                    <div className="p-4">
                                        {isExpanded ? (
                                            <div className="prose prose-sm max-w-none text-gray-800" dangerouslySetInnerHTML={{__html: note.body_html}} />
                                        ) : (
                                            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{previewText}</div>
                                        )}

                                        {/* Toggle Expand Button */}
                                        {needsExpansion && (
                                            <button onClick={() => toggleExpansion(note.id)} className="text-xs font-bold text-blue-600 hover:text-blue-800 mt-3 pt-3 border-t border-gray-100 w-full text-left flex items-center justify-center">
                                                {isExpanded ? 'Réduire' : `Afficher la suite (${noteAddendums.length > 0 ? noteAddendums.length + ' Addendums' : 'Note complète'})`}
                                            </button>
                                        )}

                                        {/* Nested Addendums Rendering inside expanding block */}
                                        {isExpanded && noteAddendums.length > 0 && (
                                            <div className="mt-5 space-y-3 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px before:h-full before:w-0.5 before:bg-indigo-100 ml-4">
                                                {noteAddendums.reverse().map(add => (
                                                    <div key={add.id} className="relative flex items-start group">
                                                        <div className="flex items-center justify-center w-5 h-5 rounded-full border-2 border-white bg-indigo-200 text-indigo-700 shadow shrink-0 z-10">
                                                            <Plus size={10} strokeWidth={3}/>
                                                        </div>
                                                        <div className="ml-3 w-full bg-slate-50 border border-indigo-100 p-3 rounded-lg shadow-sm">
                                                            <div className="flex justify-between items-center mb-2">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="font-bold text-indigo-900 text-xs uppercase tracking-wide">Addendum</span>
                                                                    <span className="text-[10px] text-gray-500 font-medium bg-gray-200 px-1 rounded">{formatDateTime(add.declared_time)}</span>
                                                                </div>
                                                                <span className="text-[10px] font-bold text-gray-500">
                                                                    Par {add.author_role === 'DOCTOR' ? 'Dr.' : 'Inf.'} {add.author_last_name}
                                                                </span>
                                                            </div>
                                                            <div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{__html: add.body_html}} />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

        </div>
    );
};
