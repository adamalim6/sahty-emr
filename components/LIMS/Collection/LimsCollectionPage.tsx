import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../services/api';
import { calculateAge } from '../../../constants';
import toast from 'react-hot-toast';
import { 
    Search, UserSearch, Fingerprint, Calendar, Activity, 
    ArrowRight, User, Stethoscope, Droplet, Archive, 
    CheckCircle2, Printer, AlertTriangle 
} from 'lucide-react';
import JsBarcode from 'jsbarcode';

export const LimsCollectionPage: React.FC = () => {
    const navigate = useNavigate();

    // Left Panel State
    const [query, setQuery] = useState('');
    const [searchParamsFlag, setSearchParamsFlag] = useState(false);
    const [patients, setPatients] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    
    // Right Panel State
    const [selectedPatient, setSelectedPatient] = useState<any>(null);
    const [admission, setAdmission] = useState<any>(null);
    const [requirements, setRequirements] = useState<any[]>([]);
    const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(false);
    const [showAll, setShowAll] = useState(false);
    const [expandedDetail, setExpandedDetail] = useState<string | null>(null);
    const [detailData, setDetailData] = useState<any[]>([]);

    // Print State
    const [printSpecimenData, setPrintSpecimenData] = useState<any>(null);

    const printSpecimenLabel = (specimen: any, mode: "HTML" | "ZPL" = "HTML") => {
        if (mode === "HTML") {
            setPrintSpecimenData(specimen);
            setTimeout(() => {
                window.print();
                setPrintSpecimenData(null);
            }, 300);
        } else {
            console.warn("ZPL mode not implemented yet");
        }
    };

    // Render Barcode dynamically when printSpecimenData changes
    useEffect(() => {
        if (printSpecimenData) {
            JsBarcode("#print-barcode-svg", printSpecimenData.barcode, {
                format: "CODE128",
                displayValue: false, // We render the text separately manually
                margin: 0,
                height: 40,
                width: 1.5,
            });
        }
    }, [printSpecimenData]);

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!query || query.length < 2) return;

        setIsSearching(true);
        try {
            const data = await api.limsConfig.execution.searchUniversalPatient(query);
            setPatients(data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsSearching(false);
        }
    };

    const loadWorkspace = async (patient: any, filterOverride?: boolean) => {
        const useFilter = filterOverride ?? showAll;
        if (!patient) return;
        setSelectedPatient(patient);
        setIsLoadingWorkspace(true);
        setAdmission(null);
        setRequirements([]);
        setExpandedDetail(null);

        try {
            const activeAdmission = await api.limsConfig.execution.getActiveWalkinAdmission(patient.id);
            if (!activeAdmission) {
                toast.error("Aucune admission laboratoire 'En cours' trouvée.");
                setIsLoadingWorkspace(false);
                return;
            }
            setAdmission(activeAdmission);

            const reqs = await api.limsConfig.execution.getCollectionRequirements(activeAdmission.id, useFilter ? 'all' : 'pending');
            setRequirements(reqs);
        } catch (err) {
            console.error(err);
            toast.error("Erreur de chargement du dossier");
        } finally {
            setIsLoadingWorkspace(false);
        }
    };

    const handleToggleFilter = () => {
        const next = !showAll;
        setShowAll(next);
        if (selectedPatient) loadWorkspace(selectedPatient, next);
    };

    const loadRequestDetail = async (labRequestId: string) => {
        if (expandedDetail === labRequestId) {
            setExpandedDetail(null);
            setDetailData([]);
            return;
        }
        try {
            const data = await api.limsConfig.execution.getLabRequestCollectionDetail(labRequestId);
            setDetailData(data);
            setExpandedDetail(labRequestId);
        } catch (err) {
            console.error(err);
            toast.error("Erreur de chargement du détail");
        }
    };

    // Auto-remove completed patient
    useEffect(() => {
        if (requirements.length > 0) {
            const allCollected = requirements.every(r => r.is_collected);
            if (allCollected) {
                toast.success("Dossier complet ! Le patient a été retiré de la file.");
                // Remove from left list
                setPatients(prev => prev.filter(p => p.id !== selectedPatient.id));
                // Clear right workspace
                setTimeout(() => {
                    setSelectedPatient(null);
                    setAdmission(null);
                    setRequirements([]);
                }, 1500);
            }
        }
    }, [requirements]);

    const handlePrelever = async (group: any) => {
        const loadingToast = toast.loading("Enregistrement du prélèvement...");
        try {
            // STEP 1, 2, 3: Execute DB transaction
            const result = await api.limsConfig.execution.executePrelevement({
                patientId: selectedPatient.id,
                admissionId: admission.id,
                targetLsctId: group.target_lsct_id,
                labRequestIds: group.lab_requests.map((lr: any) => lr.id)
            });

            // STEP 4: Immediately trigger Print (Hardware/HTML delegation)
            const specimenData = {
                patientName: `${selectedPatient.lastName} ${selectedPatient.firstName}`,
                ipp: selectedPatient.ipp,
                specimenLabel: group.specimen_label,
                containerLabel: group.container_label,
                barcode: result.barcode
            };
            printSpecimenLabel(specimenData, "HTML");

            // STEP 5: UI Update
            setRequirements(prev => prev.map(req => {
                if (req.target_lsct_id === group.target_lsct_id) {
                    return { ...req, is_collected: true, lab_requests: req.lab_requests.map((lr:any) => ({...lr, is_collected: true})) };
                }
                return req;
            }));

            toast.success("Prélèvement réussi", { id: loadingToast });
        } catch (err) {
            console.error(err);
            toast.error("Erreur lors du prélèvement", { id: loadingToast });
        }
    };

    const getCompletedCount = () => requirements.filter(r => r.is_collected).length;

    return (
        <>
            {/* INVISIBLE PRINT LAYER (Only shows up in standard browser print dialog) */}
            {printSpecimenData && (
                <div className="hidden print:block fixed inset-0 bg-white z-[9999]">
                    <div 
                        className="bg-white text-black leading-tight" 
                        style={{ width: '60mm', height: '40mm', padding: '2mm', fontSize: '10px', boxSizing: 'border-box' }}
                    >
                        <div className="font-bold truncate text-[11px] mb-0.5">{printSpecimenData.patientName}</div>
                        <div className="text-[9px] mb-1">IPP: {printSpecimenData.ipp}</div>
                        
                        <div className="truncate text-[9px] font-semibold">{printSpecimenData.specimenLabel}</div>
                        <div className="truncate text-[9px] italic mb-1 text-slate-700">{printSpecimenData.containerLabel}</div>
                        <div className="text-[8px] mb-1.5">{new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</div>
                        
                        <div className="flex flex-col items-center">
                            <svg id="print-barcode-svg" className="w-full h-8 max-w-[50mm]"></svg>
                            <div className="text-[8px] font-mono tracking-widest font-bold mt-0.5">{printSpecimenData.barcode}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* MAIN APP WRAPPER (Hidden when printing HTML mode) */}
            <div className={`flex h-screen w-full bg-slate-50 overflow-hidden ${printSpecimenData ? 'print:hidden' : ''}`}>
            {/* LEFT PANEL: PATIENT SEARCH */}
            <div className="w-1/3 min-w-[350px] max-w-md bg-white border-r border-slate-200 flex flex-col z-10 shrink-0">
                <div className="p-6 border-b border-slate-200 shrink-0">
                    <h1 className="text-xl font-black text-slate-800 mb-6 flex items-center tracking-tight">
                        <Droplet className="mr-3 text-rose-500 fill-rose-100" size={24} />
                        Prélèvement / Saisie
                    </h1>
                    
                    <form onSubmit={handleSearch} className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="block w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all font-medium"
                            placeholder="IPP, CIN, Nom..."
                        />
                    </form>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 relative">
                    {patients.length > 0 ? (
                        patients.map((patient) => {
                            const isSelected = selectedPatient?.id === patient.id;
                            return (
                                <button
                                    key={patient.id}
                                    onClick={() => loadWorkspace(patient)}
                                    className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-center justify-between group ${
                                        isSelected 
                                        ? 'bg-rose-50 border-rose-300 shadow-sm ring-1 ring-rose-300' 
                                        : 'bg-white border-slate-200 shadow-sm hover:border-rose-300 hover:shadow-md'
                                    }`}
                                >
                                    <div className="flex flex-col overflow-hidden">
                                        <h3 className={`text-sm font-black uppercase tracking-tight truncate ${isSelected ? 'text-rose-900' : 'text-slate-800'}`}>
                                            {patient.lastName} {patient.firstName}
                                        </h3>
                                        <div className="flex items-center space-x-3 mt-1.5 text-xs font-semibold text-slate-500">
                                            <span className="flex items-center"><Fingerprint size={12} className="mr-1"/>{patient.ipp}</span>
                                            {patient.dob && <span className="flex items-center"><Calendar size={12} className="mr-1"/>{calculateAge(patient.dob)}a</span>}
                                        </div>
                                    </div>
                                    <div className={`h-8 w-8 rounded-full flex items-center justify-center transition-colors shrink-0 ${isSelected ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-rose-100 group-hover:text-rose-600'}`}>
                                        <ArrowRight size={16} />
                                    </div>
                                </button>
                            );
                        })
                    ) : (
                        query.length >= 2 && !isSearching && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                                <UserSearch size={48} className="text-slate-300 mb-4" />
                                <p className="text-sm font-bold text-slate-500">Aucun patient trouvé</p>
                            </div>
                        )
                    )}
                </div>
            </div>

            {/* RIGHT PANEL: WORKSPACE */}
            <div className="flex-1 flex flex-col bg-slate-50 relative overflow-hidden">
                {!selectedPatient ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                        <Droplet size={64} className="mb-6 opacity-20" />
                        <h2 className="text-xl font-bold tracking-tight">Sélectionnez un patient</h2>
                        <p className="text-sm font-medium mt-2">Recherchez à gauche pour démarrer le workflow</p>
                    </div>
                ) : isLoadingWorkspace ? (
                    <div className="h-full flex items-center justify-center uppercase font-black text-xs tracking-widest text-slate-400 animate-pulse">
                        Chargement de l'admission...
                    </div>
                ) : !admission ? (
                    <div className="h-full flex flex-col items-center justify-center text-rose-500">
                        <AlertTriangle size={64} className="mb-6 opacity-80" />
                        <h2 className="text-xl font-bold tracking-tight">Aucune admission active</h2>
                        <p className="text-sm font-medium mt-2 text-slate-500">Ce patient n'a pas d'admission LABORATOIRE 'En cours'.</p>
                        <button onClick={() => navigate(`/lims/registration?patientId=${selectedPatient.id}`)} className="mt-6 px-6 py-2 bg-rose-600 text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-rose-700 transition">
                            Créer admission Labo
                        </button>
                    </div>
                ) : (
                    <>
                        {/* RIGHT HEADER */}
                        <div className="bg-white border-b border-slate-200 px-8 py-6 shrink-0 z-10 shadow-sm flex items-center justify-between">
                            <div className="flex items-center space-x-6">
                                <div className="h-14 w-14 bg-gradient-to-br from-rose-50 to-orange-50 text-rose-600 rounded-2xl flex items-center justify-center border border-rose-100 shrink-0">
                                    <User size={28} />
                                </div>
                                <div className="flex flex-col">
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                                        {selectedPatient.lastName} {selectedPatient.firstName}
                                    </h2>
                                    <div className="flex items-center space-x-3 mt-1.5 text-xs font-bold text-slate-500 uppercase tracking-widest">
                                        <span className="flex items-center bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200"><Fingerprint size={12} className="mr-1"/>{selectedPatient.ipp}</span>
                                        <span>•</span>
                                        <span className="flex items-center"><Activity size={12} className="mr-1"/>{selectedPatient.sex || 'Inconnu'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center space-x-6">
                                {/* Filter Toggle */}
                                <div className="flex rounded-lg border border-slate-300 overflow-hidden text-xs font-bold uppercase tracking-wider">
                                    <button
                                        onClick={() => { if (showAll) handleToggleFilter(); }}
                                        className={`px-3 py-1.5 transition-colors ${!showAll ? 'bg-rose-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                                    >
                                        Non prélevés
                                    </button>
                                    <button
                                        onClick={() => { if (!showAll) handleToggleFilter(); }}
                                        className={`px-3 py-1.5 transition-colors border-l border-slate-300 ${showAll ? 'bg-rose-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                                    >
                                        Tous
                                    </button>
                                </div>

                                {/* Progress */}
                                <div className="flex flex-col items-end">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Progression</span>
                                    <div className="flex items-center space-x-2">
                                        <span className="text-2xl font-black text-slate-800">{getCompletedCount()}</span>
                                        <span className="text-lg font-bold text-slate-400">/ {requirements.length}</span>
                                        <span className="text-sm font-semibold text-slate-500 mt-1 ml-1">Tubes</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT BODY: SPECIMEN ENGINE */}
                        <div className="flex-1 p-8 overflow-y-auto w-full custom-scrollbar">
                            <div className="max-w-4xl mx-auto">
                                {/* Group requirements by admission_id */}
                                {(() => {
                                    const admissionGroups = new Map<string, any[]>();
                                    requirements.forEach(req => {
                                        const key = req.admission_id || 'unknown';
                                        if (!admissionGroups.has(key)) admissionGroups.set(key, []);
                                        admissionGroups.get(key)!.push(req);
                                    });
                                    return Array.from(admissionGroups.entries()).map(([admId, reqs], gi) => (
                                        <div key={admId} className={gi > 0 ? 'mt-8' : ''}>
                                            {admissionGroups.size > 1 && (
                                                <div className="flex items-center gap-3 mb-4">
                                                    <div className="h-px flex-1 bg-slate-200" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
                                                        Admission {admId.slice(0, 8)}
                                                    </span>
                                                    <div className="h-px flex-1 bg-slate-200" />
                                                </div>
                                            )}
                                            <div className="grid grid-cols-1 gap-6">
                                    {reqs.map((req, i) => {
                                        const isCollected = req.is_collected;
                                        const isMisconfigured = !req.specimen_type_id || !req.container_type_id;
                                        const hexColor = req.container_color || '#cbd5e1';

                                        return (
                                            <div
                                                key={i}
                                                className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden flex flex-col ${
                                                    isMisconfigured
                                                    ? 'border-amber-300 shadow-sm'
                                                    : isCollected
                                                    ? 'border-emerald-200 shadow-sm opacity-70 scale-[0.99] pointer-events-none'
                                                    : 'border-slate-200 shadow-md hover:shadow-lg hover:border-slate-300'
                                                }`}
                                            >
                                                {/* Card Header */}
                                                <div className={`px-6 py-4 border-b flex items-center justify-between ${isMisconfigured ? 'bg-amber-50 border-amber-200' : isCollected ? 'bg-emerald-50/50 border-emerald-100' : 'bg-slate-50/50 border-slate-100'}`}>
                                                    <div className="flex items-center space-x-4">
                                                        {isMisconfigured ? (
                                                            <div className="h-10 w-10 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center">
                                                                <AlertTriangle size={20} className="text-amber-600" />
                                                            </div>
                                                        ) : (
                                                            <div
                                                                className="h-10 w-4 rounded-sm shadow-inner overflow-hidden border border-black/10 flex items-end justify-center pb-1"
                                                                style={{ backgroundColor: hexColor }}
                                                                title={req.container_label}
                                                            />
                                                        )}
                                                        <div className="flex flex-col">
                                                            {isMisconfigured ? (
                                                                <>
                                                                    <h3 className="font-black text-amber-800 text-sm">Configuration incomplète</h3>
                                                                    <p className="text-xs text-amber-600 mt-0.5">Spécimen ou récipient non configuré. Veuillez contacter l'administrateur du laboratoire.</p>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <h3 className="font-black text-slate-800 text-lg flex items-center">
                                                                        <Archive size={18} className="mr-2 text-slate-400"/>
                                                                        {req.specimen_label}
                                                                    </h3>
                                                                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mt-0.5">{req.container_label}</p>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {!isMisconfigured && (
                                                        <button
                                                            onClick={() => !isCollected && handlePrelever(req)}
                                                            disabled={isCollected}
                                                            className={`flex items-center px-6 py-2.5 rounded-xl font-bold uppercase tracking-widest text-xs transition-all pointer-events-auto ${
                                                                isCollected
                                                                ? 'bg-emerald-100 text-emerald-700'
                                                                : 'bg-rose-600 text-white hover:bg-rose-700 active:scale-95 shadow-lg shadow-rose-600/30'
                                                            }`}
                                                        >
                                                            {isCollected ? (
                                                                <><CheckCircle2 size={16} className="mr-2"/> Prélevé</>
                                                            ) : (
                                                                <><Printer size={16} className="mr-2"/> Prélever & Imprimer</>
                                                            )}
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Card Body: Lab Requests linked */}
                                                <div className="p-4 px-6 bg-white">
                                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 border-b border-slate-100 pb-2">
                                                        Actes couverts par ce tube ({req.lab_requests.length})
                                                    </div>
                                                    <div className="flex flex-col gap-1.5">
                                                        {req.lab_requests.map((lr: any, j: number) => (
                                                            <div key={j} className="flex flex-col">
                                                                <div className="flex items-center justify-between">
                                                                    <span
                                                                        className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center ${
                                                                            lr.is_collected
                                                                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                                                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                                                                        }`}
                                                                    >
                                                                        {lr.is_collected && <CheckCircle2 size={12} className="mr-1.5"/>}
                                                                        {lr.name}
                                                                        {lr.requested_at && (
                                                                            <span className="ml-2 text-[10px] font-medium text-slate-400">
                                                                                {new Date(lr.requested_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                                            </span>
                                                                        )}
                                                                    </span>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); loadRequestDetail(lr.id); }}
                                                                        className="text-[10px] font-semibold text-blue-500 hover:text-blue-700 hover:underline ml-2 pointer-events-auto"
                                                                    >
                                                                        {expandedDetail === lr.id ? 'Masquer' : 'Détail'}
                                                                    </button>
                                                                </div>
                                                                {expandedDetail === lr.id && detailData.length > 0 && (
                                                                    <div className="ml-4 mt-1 mb-1 p-2 bg-slate-50 rounded border border-slate-200 text-[11px] text-slate-600 pointer-events-auto">
                                                                        {detailData.map((d: any, k: number) => (
                                                                            <div key={k} className="flex items-center gap-3 py-0.5">
                                                                                <span className="font-mono text-slate-500">{d.barcode || '—'}</span>
                                                                                <span className={`font-semibold ${d.specimen_status === 'COLLECTED' ? 'text-amber-600' : d.specimen_status === 'RECEIVED' ? 'text-emerald-600' : d.specimen_status === 'REJECTED' ? 'text-rose-600' : 'text-slate-400'}`}>
                                                                                    {d.specimen_status || 'Non prélevé'}
                                                                                </span>
                                                                                {d.collected_at && <span className="text-slate-400">{new Date(d.collected_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>}
                                                                                {d.collected_by && <span className="text-slate-400">par {d.collected_by}</span>}
                                                                                {d.rejected_reason && <span className="text-rose-500 italic">{d.rejected_reason}</span>}
                                                                            </div>
                                                                        ))}
                                                                        {detailData.every((d: any) => !d.specimen_id) && <span className="text-slate-400 italic">Aucun prélèvement enregistré</span>}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                            </div>
                                        </div>
                                    ));
                                })()}

                                {requirements.length === 0 && (
                                    <div className="flex items-center justify-center p-12 text-slate-400">
                                        <p className="font-bold uppercase tracking-widest text-xs">Aucun spécimen trouvé pour cette admission</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
        </>
    );
};
