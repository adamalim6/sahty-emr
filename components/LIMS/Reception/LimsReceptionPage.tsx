import React, { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../../../services/api';
import { ScanLine, CheckCircle2, XCircle, AlertTriangle, Clock, Loader2, ArrowRight, Printer } from 'lucide-react';
import toast from 'react-hot-toast';

interface SpecimenData {
    specimen_id: string;
    barcode: string;
    status: string;
    rejected_reason: string | null;
    received_at: string | null;
    rejected_at: string | null;
    specimen_created_at: string;
    last_status_changed_at: string | null;
    collected_at: string;
    collection_id: string;
    patient_id: string;
    patient_first_name: string;
    patient_last_name: string;
    patient_ipp: string;
    container_label: string;
    container_color: string;
    specimen_type_label: string;
    acts: { act_id: string; libelle: string }[];
}

interface RecentAction {
    barcode: string;
    patientName: string;
    containerLabel: string;
    specimenTypeLabel: string;
    resultingStatus: string;
    timestamp: Date;
}

const REJECTION_REASONS = [
    { value: 'Hémolysé', label: 'Hémolysé', icon: '🩸' },
    { value: 'Coagulé', label: 'Coagulé', icon: '🧬' },
    { value: 'Tube incorrect', label: 'Tube incorrect', icon: '🧪' },
    { value: 'Étiquetage incorrect', label: 'Étiquetage incorrect', icon: '🏷️' },
    { value: 'Quantité insuffisante', label: 'Quantité insuffisante', icon: '📉' },
    { value: 'Autre', label: 'Autre', icon: '❓' },
];

const statusConfig: Record<string, { label: string; color: string; bgColor: string; borderColor: string; icon: React.ReactNode }> = {
    COLLECTED: { label: 'Prélevé', color: 'text-sky-700', bgColor: 'bg-sky-50', borderColor: 'border-sky-200', icon: <Clock size={14} /> },
    RECEIVED: { label: 'Reçu', color: 'text-emerald-700', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200', icon: <CheckCircle2 size={14} /> },
    REJECTED: { label: 'Rejeté', color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-200', icon: <XCircle size={14} /> },
    INSUFFICIENT: { label: 'Insuffisant', color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-200', icon: <AlertTriangle size={14} /> },
};

export const LimsReceptionPage: React.FC = () => {
    const [barcodeInput, setBarcodeInput] = useState('');
    const [specimen, setSpecimen] = useState<SpecimenData | null>(null);
    const [lookupError, setLookupError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isActioning, setIsActioning] = useState(false);
    const [recentActions, setRecentActions] = useState<RecentAction[]>([]);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [selectedReason, setSelectedReason] = useState('');
    const [customReason, setCustomReason] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-focus on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const refocusInput = useCallback(() => {
        setTimeout(() => inputRef.current?.focus(), 100);
    }, []);

    const addRecentAction = useCallback((sp: SpecimenData, resultingStatus: string) => {
        setRecentActions(prev => [{
            barcode: sp.barcode,
            patientName: `${sp.patient_last_name} ${sp.patient_first_name}`.trim(),
            containerLabel: sp.container_label || 'Tube',
            specimenTypeLabel: sp.specimen_type_label || '-',
            resultingStatus,
            timestamp: new Date()
        }, ...prev].slice(0, 10));
    }, []);

    const handleScan = useCallback(async () => {
        const barcode = barcodeInput.trim();
        if (!barcode) return;

        setIsLoading(true);
        setLookupError(null);
        setSpecimen(null);

        try {
            const result = await api.getSpecimenByBarcode(barcode);
            setSpecimen(result);
        } catch (err: any) {
            if (err.message?.includes('introuvable') || err.message?.includes('404')) {
                setLookupError('Prélèvement introuvable');
            } else {
                setLookupError(err.message || 'Erreur de recherche');
            }
        } finally {
            setIsLoading(false);
            setBarcodeInput('');
            refocusInput();
        }
    }, [barcodeInput, refocusInput]);

    const handleReceive = useCallback(async () => {
        if (!specimen) return;
        setIsActioning(true);
        try {
            await api.receiveSpecimen(specimen.specimen_id);
            toast.success(`✅ Spécimen ${specimen.barcode} reçu`);
            addRecentAction(specimen, 'RECEIVED');
            setSpecimen({ ...specimen, status: 'RECEIVED', received_at: new Date().toISOString() });
        } catch (err: any) {
            toast.error(err.message || 'Erreur lors de la réception');
        } finally {
            setIsActioning(false);
            refocusInput();
        }
    }, [specimen, addRecentAction, refocusInput]);

    const handleReject = useCallback(async () => {
        if (!specimen) return;
        const reason = selectedReason === 'Autre' ? customReason.trim() : selectedReason;
        if (!reason) {
            toast.error('Veuillez sélectionner un motif de rejet');
            return;
        }
        setIsActioning(true);
        try {
            await api.rejectSpecimen(specimen.specimen_id, reason);
            toast.success(`❌ Spécimen ${specimen.barcode} rejeté — ${reason}`);
            addRecentAction(specimen, 'REJECTED');
            setSpecimen({ ...specimen, status: 'REJECTED', rejected_reason: reason, rejected_at: new Date().toISOString() });
        } catch (err: any) {
            toast.error(err.message || 'Erreur lors du rejet');
        } finally {
            setIsActioning(false);
            setShowRejectModal(false);
            setSelectedReason('');
            setCustomReason('');
            refocusInput();
        }
    }, [specimen, selectedReason, customReason, addRecentAction, refocusInput]);

    const handleMarkInsufficient = useCallback(async () => {
        if (!specimen) return;
        setIsActioning(true);
        try {
            await api.markSpecimenInsufficient(specimen.specimen_id);
            toast.success(`⚠️ Spécimen ${specimen.barcode} marqué insuffisant`);
            addRecentAction(specimen, 'INSUFFICIENT');
            setSpecimen({ ...specimen, status: 'INSUFFICIENT' });
        } catch (err: any) {
            toast.error(err.message || 'Erreur');
        } finally {
            setIsActioning(false);
            refocusInput();
        }
    }, [specimen, addRecentAction, refocusInput]);

    const formatDate = (iso: string | null) => {
        if (!iso) return '-';
        const d = new Date(iso);
        return `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    };

    const canReceive = specimen?.status === 'COLLECTED';
    const canReject = specimen && specimen.status !== 'REJECTED';
    const canMarkInsufficient = specimen && specimen.status !== 'INSUFFICIENT' && specimen.status !== 'REJECTED';

    return (
        <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 px-8 py-5 flex-shrink-0 shadow-lg">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
                            <div className="bg-white/15 backdrop-blur-sm p-2 rounded-xl">
                                <ScanLine size={24} className="text-white" />
                            </div>
                            Réception Laboratoire
                        </h1>
                        <p className="text-white/70 text-sm mt-1 font-medium">Scan • Vérification • Réception</p>
                    </div>
                    <div className="text-right">
                        <div className="text-white/60 text-xs font-medium uppercase tracking-widest">Spécimens traités</div>
                        <div className="text-3xl font-black text-white tabular-nums">{recentActions.length}</div>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Main Content */}
                <div className="flex-1 flex flex-col p-8 overflow-y-auto">
                    
                    {/* Scan Input */}
                    <div className="max-w-2xl w-full mx-auto mb-8">
                        <div className="bg-white rounded-2xl border-2 border-indigo-100 shadow-xl overflow-hidden transition-all focus-within:border-indigo-400 focus-within:shadow-indigo-100/50 focus-within:shadow-2xl">
                            <div className="flex items-center">
                                <div className="pl-5">
                                    <ScanLine size={22} className="text-indigo-400" />
                                </div>
                                <input
                                    ref={inputRef}
                                    id="barcode-scan-input"
                                    type="text"
                                    value={barcodeInput}
                                    onChange={(e) => setBarcodeInput(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleScan(); }}
                                    placeholder="Scanner ou saisir le code-barres..."
                                    className="flex-1 px-4 py-5 text-lg font-medium text-slate-800 placeholder-slate-400 bg-transparent border-none outline-none"
                                    autoComplete="off"
                                    autoFocus
                                />
                                <button
                                    onClick={handleScan}
                                    disabled={isLoading || !barcodeInput.trim()}
                                    className="mr-3 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold text-sm rounded-xl transition-all flex items-center gap-2 shadow-md hover:shadow-lg disabled:shadow-none"
                                >
                                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                                    Rechercher
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Error State */}
                    {lookupError && (
                        <div className="max-w-2xl w-full mx-auto mb-6">
                            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-center gap-4">
                                <div className="bg-red-100 p-3 rounded-full">
                                    <XCircle size={24} className="text-red-500" />
                                </div>
                                <div>
                                    <div className="font-bold text-red-800 text-lg">{lookupError}</div>
                                    <div className="text-red-600 text-sm mt-0.5">Vérifiez le code-barres et réessayez</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Specimen Card */}
                    {specimen && (
                        <div className="max-w-2xl w-full mx-auto">
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
                                {/* Patient Header */}
                                <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4 text-white">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="text-lg font-extrabold tracking-wide">
                                                {specimen.patient_last_name?.toUpperCase()} {specimen.patient_first_name}
                                            </div>
                                            <div className="text-white/60 text-sm font-medium mt-0.5">
                                                IPP: <span className="text-white/90 font-bold">{specimen.patient_ipp || 'N/A'}</span>
                                            </div>
                                        </div>
                                        {(() => {
                                            const cfg = statusConfig[specimen.status] || statusConfig.COLLECTED;
                                            return (
                                                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-bold text-xs ${cfg.color} ${cfg.bgColor} ${cfg.borderColor}`}>
                                                    {cfg.icon}
                                                    {cfg.label}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>

                                {/* Specimen Details */}
                                <div className="p-6 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tube</div>
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="w-4 h-4 rounded-full border border-slate-200 shadow-inner"
                                                    style={{ backgroundColor: specimen.container_color || '#e2e8f0' }}
                                                />
                                                <span className="font-bold text-slate-800 text-sm">{specimen.container_label || 'Non spécifié'}</span>
                                            </div>
                                        </div>
                                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Type Spécimen</div>
                                            <div className="font-bold text-slate-800 text-sm">{specimen.specimen_type_label || 'Non spécifié'}</div>
                                        </div>
                                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Code-Barres</div>
                                            <div className="font-mono font-extrabold text-indigo-700 text-sm tracking-wider">{specimen.barcode}</div>
                                        </div>
                                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Prélevé le</div>
                                            <div className="font-bold text-slate-800 text-sm">{formatDate(specimen.collected_at)}</div>
                                        </div>
                                    </div>

                                    {/* Acts */}
                                    {specimen.acts && specimen.acts.length > 0 && (
                                        <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100">
                                            <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2">Actes demandés ({specimen.acts.length})</div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {specimen.acts.map((act) => (
                                                    <span key={act.act_id} className="inline-flex items-center px-2.5 py-1 bg-white border border-indigo-200 rounded-lg text-xs font-semibold text-indigo-800 shadow-sm">
                                                        {act.libelle}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Rejection reason display */}
                                    {specimen.status === 'REJECTED' && specimen.rejected_reason && (
                                        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                                            <div className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1">Motif du rejet</div>
                                            <div className="font-bold text-red-700 text-sm">{specimen.rejected_reason}</div>
                                        </div>
                                    )}

                                    {/* Status Messages */}
                                    {specimen.status === 'RECEIVED' && (
                                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
                                            <CheckCircle2 size={20} className="text-emerald-500" />
                                            <div>
                                                <div className="font-bold text-emerald-700 text-sm">Ce prélèvement a déjà été reçu</div>
                                                <div className="text-emerald-600 text-xs mt-0.5">{formatDate(specimen.received_at)}</div>
                                            </div>
                                        </div>
                                    )}

                                    {specimen.status === 'REJECTED' && (
                                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                                            <XCircle size={20} className="text-red-500" />
                                            <div>
                                                <div className="font-bold text-red-700 text-sm">Ce prélèvement a déjà été rejeté</div>
                                                <div className="text-red-600 text-xs mt-0.5">{formatDate(specimen.rejected_at)}</div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Action Buttons */}
                                    <div className="flex gap-3 pt-2">
                                        {canReceive && (
                                            <button
                                                onClick={handleReceive}
                                                disabled={isActioning}
                                                className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-extrabold text-lg rounded-xl transition-all shadow-lg hover:shadow-xl disabled:shadow-none flex items-center justify-center gap-2"
                                            >
                                                {isActioning ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
                                                Recevoir
                                            </button>
                                        )}
                                        {canReject && (
                                            <button
                                                onClick={() => setShowRejectModal(true)}
                                                disabled={isActioning}
                                                className={`${canReceive ? 'flex-none px-8' : 'flex-1'} py-4 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-extrabold text-lg rounded-xl transition-all shadow-lg hover:shadow-xl disabled:shadow-none flex items-center justify-center gap-2`}
                                            >
                                                <XCircle size={20} />
                                                Rejeter
                                            </button>
                                        )}
                                        {canMarkInsufficient && (
                                            <button
                                                onClick={handleMarkInsufficient}
                                                disabled={isActioning}
                                                className="flex-none px-6 py-4 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-bold text-sm rounded-xl transition-all shadow-md hover:shadow-lg disabled:shadow-none flex items-center justify-center gap-2"
                                            >
                                                <AlertTriangle size={16} />
                                                Insuffisant
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Empty State */}
                    {!specimen && !lookupError && !isLoading && (
                        <div className="max-w-2xl w-full mx-auto text-center py-16">
                            <div className="bg-indigo-50 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <ScanLine size={36} className="text-indigo-300" />
                            </div>
                            <div className="text-slate-400 text-lg font-medium">Scannez un code-barres pour commencer</div>
                            <div className="text-slate-300 text-sm mt-1">USB scanner ou saisie manuelle</div>
                        </div>
                    )}
                </div>

                {/* Right Sidebar — Recent Actions */}
                <div className="w-80 bg-white border-l border-slate-200 flex flex-col flex-shrink-0 overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100">
                        <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                            <Clock size={14} className="text-slate-400" />
                            Actions Récentes
                        </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {recentActions.length === 0 ? (
                            <div className="p-6 text-center text-slate-300 text-sm italic">
                                Aucune action récente
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-50">
                                {recentActions.map((action, i) => {
                                    const cfg = statusConfig[action.resultingStatus] || statusConfig.COLLECTED;
                                    return (
                                        <div key={i} className="px-4 py-3 hover:bg-slate-50 transition-colors">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="font-mono text-xs font-bold text-slate-600">{action.barcode}</span>
                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${cfg.color} ${cfg.bgColor} ${cfg.borderColor}`}>
                                                    {cfg.label}
                                                </span>
                                            </div>
                                            <div className="text-xs font-semibold text-slate-700 truncate">{action.patientName}</div>
                                            <div className="text-[10px] text-slate-400 mt-0.5">
                                                {action.containerLabel} • {action.specimenTypeLabel}
                                            </div>
                                            <div className="text-[10px] text-slate-300 mt-0.5">
                                                {action.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Rejection Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
                        <div className="bg-red-600 px-6 py-4 text-white">
                            <h3 className="font-extrabold text-lg">Rejet du Spécimen</h3>
                            <p className="text-white/70 text-sm mt-0.5 font-mono">{specimen?.barcode}</p>
                        </div>
                        <div className="p-6 space-y-3">
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Motif du rejet</div>
                            {REJECTION_REASONS.map(reason => (
                                <button
                                    key={reason.value}
                                    onClick={() => setSelectedReason(reason.value)}
                                    className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                                        selectedReason === reason.value
                                            ? 'border-red-500 bg-red-50 text-red-800 shadow-sm'
                                            : 'border-slate-100 hover:border-slate-200 text-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    <span className="text-lg">{reason.icon}</span>
                                    <span className="font-semibold text-sm">{reason.label}</span>
                                </button>
                            ))}
                            {selectedReason === 'Autre' && (
                                <input
                                    type="text"
                                    value={customReason}
                                    onChange={(e) => setCustomReason(e.target.value)}
                                    placeholder="Précisez le motif..."
                                    className="w-full mt-2 px-4 py-3 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                                    autoFocus
                                    onKeyDown={(e) => { if (e.key === 'Enter' && customReason.trim()) handleReject(); }}
                                />
                            )}
                        </div>
                        <div className="flex gap-3 p-6 pt-0">
                            <button
                                onClick={() => { setShowRejectModal(false); setSelectedReason(''); setCustomReason(''); refocusInput(); }}
                                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleReject}
                                disabled={!selectedReason || (selectedReason === 'Autre' && !customReason.trim()) || isActioning}
                                className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-extrabold rounded-xl transition-all shadow-md disabled:shadow-none flex items-center justify-center gap-2"
                            >
                                {isActioning ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                                Confirmer le Rejet
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
