import React, { useEffect, useState, useRef } from 'react';
import * as ECT from '@whoicd/icd11ect';
import '@whoicd/icd11ect/style.css';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface props {
    patientId: string;
    isActiveWorkspace?: boolean;
    isActiveTab?: boolean;
}

interface Diagnosis {
    id: string;
    tenant_patient: string;
    status: 'ACTIVE' | 'RESOLVED' | 'VOIDED';
    icd_code: string | null;
    icd_title: string | null;
    icd_selected_text: string;
    icd_foundation_uri: string;
    entered_at: string;
    clinician_user_id?: string;
    clinician_name?: string;
    resolved_at?: string;
    resolved_by_user_id?: string;
    resolved_by_name?: string;
    resolution_note?: string;
    voided_at?: string;
    voided_by_user_id?: string;
    voided_by_name?: string;
    void_reason?: string;
}

type FilterType = 'ALL' | 'ACTIVE' | 'RESOLVED' | 'VOIDED' | 'MINE';

export const Diagnostic: React.FC<props> = ({ patientId, isActiveWorkspace = true, isActiveTab = true }) => {
    const { user } = useAuth();
    const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedEntity, setSelectedEntity] = useState<any>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [filter, setFilter] = useState<FilterType>('ALL');
    const [searchText, setSearchText] = useState("");

    // Toast state
    const [toast, setToast] = useState<{message: string, type: 'success'|'error'} | null>(null);

    // Modal states
    const [resolveModal, setResolveModal] = useState<Diagnosis | null>(null);
    const [resolveNote, setResolveNote] = useState('');
    
    const [voidModal, setVoidModal] = useState<Diagnosis | null>(null);
    const [voidReason, setVoidReason] = useState('');
    
    const [reactivateModal, setReactivateModal] = useState<Diagnosis | null>(null);

    // Track initialization
    const ectInitialized = useRef(false);

    useEffect(() => {
        if (!ectInitialized.current) {
            const mySettings = {
                apiServerUrl: "http://localhost:3001/api/icd",
                apiSecured: false,
                icdLinearization: "mms",
                language: "fr",
                // Enable rich search functions
                searchByCodeOrURI: true,
                wordsAvailable: true,
                chaptersAvailable: true,
                otherPostcoordination: true,
                autoBind: false,
            };

            const callbacks = {
                selectedEntityFunction: (entity: any) => {
                    setSelectedEntity(entity);
                    // Clear the search input UI after selection
                    ECT.Handler.clear("1");
                    setSearchText("");
                },
                getNewCodeFunction: () => {} // satisfy callback requirements
            };

            ECT.Handler.configure(mySettings, callbacks);
            
            // Wait for the DOM to be fully resolved, then bind
            setTimeout(() => {
                try {
                    ECT.Handler.bind("1");
                } catch(e) { console.error("Could not bind ECT", e);}
            }, 100);
            
            ectInitialized.current = true;
        }

        fetchDiagnoses();
    }, [patientId]);

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const fetchDiagnoses = async () => {
        setLoading(true);
        try {
            const data = await api.getPatientDiagnoses(patientId);
            setDiagnoses(data || []);
        } catch (error) {
            console.error("Failed to load diagnoses", error);
            showToast("Erreur lors du chargement des diagnostics", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveDiagnosis = async () => {
        if (!selectedEntity) return;

        setIsSaving(true);
        try {
            const payload = {
                icd_linearization: 'mms',
                icd_language: 'fr',
                icd_code: selectedEntity.code,
                icd_title: selectedEntity.title,
                icd_selected_text: selectedEntity.selectedText,
                icd_foundation_uri: selectedEntity.foundationUri,
                icd_linearization_uri: selectedEntity.linearizationUri,
                source_query: selectedEntity.searchQuery,
                ect_instance_no: selectedEntity.iNo,
            };

            await api.createDiagnosis(patientId, payload);
            setSelectedEntity(null);
            fetchDiagnoses();
            showToast("Diagnostic enregistré avec succès", "success");
        } catch (e) {
            console.error("Error creating diagnosis", e);
            showToast("Erreur lors de l'enregistrement", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleResolve = async () => {
        if (!resolveModal) return;
        try {
            await api.resolveDiagnosis(resolveModal.id, resolveNote);
            setResolveModal(null);
            setResolveNote('');
            fetchDiagnoses();
            showToast("Diagnostic clôturé", "success");
        } catch (e) {
            showToast("Erreur lors de la clôture", "error");
        }
    };

    const handleVoid = async () => {
        if (!voidModal || !voidReason.trim()) return;
        try {
            await api.voidDiagnosis(voidModal.id, voidReason);
            setVoidModal(null);
            setVoidReason('');
            fetchDiagnoses();
            showToast("Diagnostic annulé", "success");
        } catch (e) {
            showToast("Erreur lors de l'annulation", "error");
        }
    };

    const handleReactivate = async () => {
        if (!reactivateModal) return;
        try {
            await api.reactivateDiagnosis(reactivateModal.id);
            setReactivateModal(null);
            fetchDiagnoses();
            showToast("Diagnostic réactivé", "success");
        } catch (e) {
            showToast("Erreur lors de la réactivation", "error");
        }
    };

    const filteredDiagnoses = diagnoses.filter(d => {
        if (filter === 'ACTIVE') return d.status === 'ACTIVE';
        if (filter === 'RESOLVED') return d.status === 'RESOLVED';
        if (filter === 'VOIDED') return d.status === 'VOIDED';
        if (filter === 'MINE') return d.clinician_user_id === user?.id;
        return true;
    });

    const getStatusBadge = (status: string) => {
        switch(status) {
            case 'ACTIVE': return <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">ACTIF</span>;
            case 'RESOLVED': return <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">CLÔTURÉ</span>;
            case 'VOIDED': return <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">ANNULÉ</span>;
            default: return null;
        }
    };

    return (
        <div className="space-y-6 pb-20">
            <style>{`
                .ctw-window ul {
                    padding-left: 40px !important;
                }
            `}</style>
            
            {/* TOAST */}
            {toast && (
                <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded shadow-lg text-white font-medium text-sm transition-all duration-300 ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
                    {toast.message}
                </div>
            )}

            {/* ADD DIAGNOSIS CARD */}
            <div className="bg-white px-6 py-5 rounded-lg shadow-sm ring-1 ring-gray-200" style={{ overflow: 'visible' }}>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Ajouter un diagnostic</h3>
                
                <div className="relative w-full flex items-center shadow-sm">
                    <input 
                        type="text" 
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && searchText.trim()) {
                                e.preventDefault();
                                (ECT.Handler as any).search("1", searchText);
                            }
                        }}
                        className="block w-full rounded-md border-0 py-2.5 pl-4 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6" 
                        autoComplete="off" 
                        placeholder="Rechercher un diagnostic ICD-11 (Appuyez sur Entrée)..." 
                    />
                    {searchText && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearchText("");
                                ECT.Handler.clear("1");
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                            </svg>
                        </button>
                    )}
                    
                    {/* Hidden Native Input for ECT Binding */}
                    <input 
                        type="text" 
                        className="ctw-input hidden" 
                        autoComplete="off" 
                        data-ctw-ino="1" 
                    />
                </div>

                <div className="ctw-window w-full mt-4" data-ctw-ino="1" />

                {selectedEntity && (
                    <div className="mt-6 rounded-md bg-blue-50 p-4 border border-blue-200 max-w-2xl">
                        <div className="flex items-start justify-between">
                            <div>
                                <h4 className="text-sm font-medium text-blue-800">Sélection</h4>
                                <div className="mt-2 text-blue-700 font-semibold text-lg">{selectedEntity.selectedText}</div>
                                {selectedEntity.code && (
                                    <div className="mt-1 flex items-center gap-2">
                                        <span className="inline-flex items-center rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                                            {selectedEntity.code}
                                        </span>
                                        <span className="text-xs text-blue-600">{selectedEntity.title}</span>
                                    </div>
                                )}
                                <div className="mt-2 text-xs text-blue-500 font-mono break-all">{selectedEntity.foundationUri}</div>
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setSelectedEntity(null)}
                                    className="px-3 py-1.5 text-sm font-medium hover:bg-blue-100 rounded text-blue-800"
                                >
                                    Annuler
                                </button>
                                <button 
                                    onClick={handleSaveDiagnosis}
                                    disabled={isSaving}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded text-sm font-medium shadow-sm transition disabled:opacity-50"
                                >
                                    {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* DIAGNOSES LIST */}
            <div className="bg-white shadow-sm ring-1 ring-gray-200 sm:rounded-lg">
                <div className="px-4 py-5 sm:px-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-gray-200">
                    <div className="flex items-center gap-4">
                        <h3 className="text-lg font-semibold leading-6 text-gray-900">Liste des diagnostics</h3>
                        <span className="inline-flex items-center rounded-full bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-500 ring-1 ring-inset ring-gray-600/20">
                            {filteredDiagnoses.length}
                        </span>
                    </div>
                    {/* Filter Pills */}
                    <div className="flex flex-wrap gap-2">
                        {[
                            { id: 'ALL', label: 'Tous' },
                            { id: 'ACTIVE', label: 'Actifs' },
                            { id: 'RESOLVED', label: 'Clôturés' },
                            { id: 'VOIDED', label: 'Annulés' },
                            { id: 'MINE', label: 'Mes diagnostics' },
                        ].map((btn) => (
                            <button
                                key={btn.id}
                                onClick={() => setFilter(btn.id as FilterType)}
                                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                                    filter === btn.id
                                        ? 'bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-700/10'
                                        : 'bg-white text-gray-600 hover:bg-gray-50 ring-1 ring-inset ring-gray-300'
                                }`}
                            >
                                {btn.label}
                            </button>
                        ))}
                    </div>
                </div>
                
                <ul role="list" className="divide-y divide-gray-100">
                    {filteredDiagnoses.map((diag) => (
                        <li key={diag.id} className={`flex items-start justify-between gap-x-6 py-5 px-6 transition ${diag.status === 'VOIDED' ? 'bg-red-50/30' : 'hover:bg-gray-50'}`}>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-start gap-x-3 mb-1">
                                    {getStatusBadge(diag.status)}
                                    <p className={`text-base font-semibold leading-6 ${diag.status === 'VOIDED' ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                                        {diag.icd_selected_text}
                                    </p>
                                    {diag.icd_code && (
                                        <p className="rounded-md whitespace-nowrap px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset text-gray-600 bg-gray-50 ring-gray-500/10">
                                            {diag.icd_code}
                                        </p>
                                    )}
                                </div>
                                <div className="mt-2 space-y-1">
                                    <p className="text-xs text-gray-500">
                                        Ajouté le {new Date(diag.entered_at).toLocaleString('fr-FR')} par Dr {diag.clinician_name || 'Inconnu'}
                                    </p>
                                    
                                    {diag.status === 'RESOLVED' && diag.resolved_at && (
                                        <p className="text-xs text-emerald-600 font-medium">
                                            Clôturé le {new Date(diag.resolved_at).toLocaleString('fr-FR')} par Dr {diag.resolved_by_name || 'Inconnu'}
                                            {diag.resolution_note && <span className="text-gray-500 ml-1 font-normal">- Note: {diag.resolution_note}</span>}
                                        </p>
                                    )}
                                    
                                    {diag.status === 'VOIDED' && diag.voided_at && (
                                        <p className="text-xs text-red-600 font-medium">
                                            Annulé le {new Date(diag.voided_at).toLocaleString('fr-FR')} par Dr {diag.voided_by_name || 'Inconnu'}
                                            <span className="block mt-0.5 text-gray-500 font-normal">Motif : {diag.void_reason}</span>
                                        </p>
                                    )}
                                </div>
                            </div>
                            
                            <div className="flex flex-none flex-col items-end gap-y-2">
                                {diag.status === 'ACTIVE' && (
                                    <>
                                        <button
                                            onClick={() => setResolveModal(diag)}
                                            className="rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-emerald-600 shadow-sm ring-1 ring-inset ring-emerald-300 hover:bg-emerald-50"
                                        >
                                            Clôturer
                                        </button>
                                        <button
                                            onClick={() => setVoidModal(diag)}
                                            className="text-xs font-medium text-gray-400 hover:text-red-500 decoration-1 hover:underline mt-1"
                                        >
                                            Annuler
                                        </button>
                                    </>
                                )}
                                {diag.status === 'RESOLVED' && (
                                    <button
                                        onClick={() => setReactivateModal(diag)}
                                        className="rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-blue-600 shadow-sm ring-1 ring-inset ring-blue-300 hover:bg-blue-50"
                                    >
                                        Réactiver
                                    </button>
                                )}
                            </div>
                        </li>
                    ))}
                    {filteredDiagnoses.length === 0 && !loading && (
                        <div className="px-6 py-10 text-center text-sm text-gray-500 border-b border-gray-100">
                            Aucun diagnostic trouvé.
                        </div>
                    )}
                </ul>
            </div>

            {/* MODAL: CLOTURER */}
            {resolveModal && (
                <div className="relative z-50">
                    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setResolveModal(null)} />
                    <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
                        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                            <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                                <div>
                                    <h3 className="text-lg font-semibold leading-6 text-gray-900">Clôturer le diagnostic</h3>
                                    <div className="mt-2">
                                        <p className="text-sm text-gray-500">
                                            Vous êtes sur le point de clôturer <strong className="text-gray-900">{resolveModal.icd_selected_text}</strong>.
                                        </p>
                                        <textarea
                                            value={resolveNote}
                                            onChange={(e) => setResolveNote(e.target.value)}
                                            rows={3}
                                            className="mt-4 block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                                            placeholder="Commentaire (facultatif)"
                                        />
                                    </div>
                                </div>
                                <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                                    <button
                                        type="button"
                                        onClick={handleResolve}
                                        className="inline-flex w-full justify-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 sm:col-start-2"
                                    >
                                        Confirmer
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setResolveModal(null)}
                                        className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0"
                                    >
                                        Annuler
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: ANNULER */}
            {voidModal && (
                <div className="relative z-50">
                    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setVoidModal(null)} />
                    <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
                        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                            <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                                <div>
                                    <h3 className="text-lg font-semibold leading-6 text-red-600">Annuler le diagnostic</h3>
                                    <div className="mt-2">
                                        <p className="text-sm text-gray-500">
                                            L'annulation d'un diagnostic est une <strong>action définitive</strong>. Veuillez motiver cette annulation.
                                        </p>
                                        <textarea
                                            value={voidReason}
                                            onChange={(e) => setVoidReason(e.target.value)}
                                            rows={3}
                                            className="mt-4 block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-red-600 sm:text-sm sm:leading-6"
                                            placeholder="Motif d'annulation (Obligatoire)"
                                        />
                                    </div>
                                </div>
                                <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                                    <button
                                        type="button"
                                        disabled={!voidReason.trim()}
                                        onClick={handleVoid}
                                        className="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 sm:col-start-2 disabled:opacity-50"
                                    >
                                        Confirmer l'annulation
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setVoidModal(null)}
                                        className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0"
                                    >
                                        Retour
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: REACTIVER */}
            {reactivateModal && (
                <div className="relative z-50">
                    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setReactivateModal(null)} />
                    <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
                        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                            <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-md sm:p-6">
                                <div>
                                    <h3 className="text-lg font-semibold leading-6 text-gray-900 text-center">Réactiver le diagnostic ?</h3>
                                    <div className="mt-2 text-center">
                                        <p className="text-sm text-gray-500">
                                            Le diagnostic <strong className="text-gray-900">{reactivateModal.icd_selected_text}</strong> repassera au statut "Actif".
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-5 sm:mt-6 flex flex-row-reverse gap-3">
                                    <button
                                        type="button"
                                        onClick={handleReactivate}
                                        className="inline-flex flex-1 justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
                                    >
                                        Réactiver
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setReactivateModal(null)}
                                        className="inline-flex flex-1 justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                                    >
                                        Annuler
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};