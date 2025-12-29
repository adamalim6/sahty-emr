
import React, { useEffect, useState } from 'react';
import { Undo2, Check, RefreshCw, X, Package, ArrowRight, AlertTriangle, Box, Search, User, FileText, Split, GripHorizontal } from 'lucide-react';
import { api } from '../../services/api';
import { ReturnRequest, ReturnDestination } from '../../backend/models/return-request';

interface ReturnRequestDTO {
    id: string;
    admissionId: string;
    admissionDisplay?: string;
    patientName?: string;
    serviceName?: string;
    senderName?: string;
    items: {
        productId: string;
        productName?: string;
        quantity: number;
        condition: 'SEALED' | 'OPENED';
        type: 'RETURNED_BOX' | 'RETURNED_UNIT_BATCH';
        containerId: string;
        lotNumber?: string;
        expiryDate?: string;
    }[];
    destination: ReturnDestination;
    status: string;
    createdAt: string;
    createdBy: string;
}

interface SplitDecision {
    containerId: string;
    approveQty: number;
    rejectQty: number;
    repackQty: number;
}

export const ReturnsReception: React.FC = () => {
    const [returns, setReturns] = useState<ReturnRequestDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'REPACKED'>('PENDING');

    // Split Modal State
    const [selectedRequest, setSelectedRequest] = useState<ReturnRequestDTO | null>(null);
    const [splitDecisions, setSplitDecisions] = useState<Record<string, SplitDecision & { max: number }>>({});

    const fetchReturns = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await api.getReturns();
            setReturns(data);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Erreur de chargement des retours');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReturns();
    }, []);

    // Initial simple process (legacy buttons)
    const handleProcessStart = (req: ReturnRequestDTO) => {
        // Initialize decisions with all to "Approve" (Validate) as default? Or all 0?
        // Let's default to 0 and user must assign.
        const initialDecisions: Record<string, SplitDecision & { max: number }> = {};
        req.items.forEach(item => {
            initialDecisions[item.containerId] = {
                containerId: item.containerId,
                approveQty: item.quantity,
                rejectQty: 0,
                repackQty: 0,
                max: item.quantity
            };
        });
        setSplitDecisions(initialDecisions);
        setSelectedRequest(req);
    };

    const handleSplitChange = (containerId: string, type: 'approve' | 'reject' | 'repack', value: number) => {
        const current = splitDecisions[containerId];
        if (!current) return;

        let validValue = Math.max(0, value);

        // Calculate remaining
        const otherTotal = (type === 'approve' ? 0 : current.approveQty) +
            (type === 'reject' ? 0 : current.rejectQty) +
            (type === 'repack' ? 0 : current.repackQty);

        if (validValue + otherTotal > current.max) {
            validValue = current.max - otherTotal;
        }

        setSplitDecisions(prev => ({
            ...prev,
            [containerId]: {
                ...prev[containerId],
                [type === 'approve' ? 'approveQty' : type === 'reject' ? 'rejectQty' : 'repackQty']: validValue
            }
        }));
    };

    const handleSubmitSplit = async () => {
        if (!selectedRequest) return;
        setProcessingId(selectedRequest.id);

        try {
            const decisionsPayload = Object.values(splitDecisions).map(d => {
                const actions = [];
                if (d.approveQty > 0) actions.push({ decision: 'APPROVE_NORMAL', quantity: d.approveQty });
                if (d.rejectQty > 0) actions.push({ decision: 'REJECT', quantity: d.rejectQty });
                if (d.repackQty > 0) actions.push({ decision: 'REPACK', quantity: d.repackQty });
                return {
                    containerId: d.containerId,
                    actions
                };
            });

            await api.processReturnSplit(selectedRequest.id, decisionsPayload, 'CURRENT_USER');
            setSelectedRequest(null);
            await fetchReturns();
        } catch (err) {
            alert('Erreur lors du traitement');
        } finally {
            setProcessingId(null);
        }
    };

    const filteredReturns = returns.filter(r => {
        if (activeTab === 'PENDING') return r.status === 'PENDING_QA';
        // Logic for other tabs remains same for now, though split requests might be effectively "Done"
        // If we map PROCESSED_MIXED to APPROVED in backend, they appear in APPROVED.
        if (activeTab === 'APPROVED') return r.status === 'APPROVED' || r.status === 'REPACKED'; // Show approved history
        if (activeTab === 'REJECTED') return r.status === 'REJECTED';
        if (activeTab === 'REPACKED') return r.status === 'REPACKED';
        return false;
    });

    return (
        <div className="p-6 bg-slate-50 min-h-screen animate-in fade-in duration-300">
            <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
                        <Undo2 className="text-indigo-600" size={32} />
                        Réception des Retours
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">
                        Gestion des retours de produits non consommés ou périmés.
                    </p>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div onClick={() => setActiveTab('PENDING')} className={`cursor-pointer p-5 rounded-2xl border transition-all ${activeTab === 'PENDING' ? 'bg-white border-indigo-500 ring-2 ring-indigo-200' : 'bg-white border-slate-200 hover:border-indigo-300'}`}>
                        <div className="flex items-center">
                            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl mr-4">
                                <Box size={24} />
                            </div>
                            <div>
                                <div className="text-2xl font-black text-slate-800">{returns.filter(r => r.status === 'PENDING_QA').length}</div>
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">En attente</div>
                            </div>
                        </div>
                    </div>
                    <div onClick={() => setActiveTab('APPROVED')} className={`cursor-pointer p-5 rounded-2xl border transition-all ${activeTab === 'APPROVED' ? 'bg-white border-emerald-500 ring-2 ring-emerald-200' : 'bg-white border-slate-200 hover:border-emerald-300'}`}>
                        <div className="flex items-center">
                            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl mr-4">
                                <Check size={24} />
                            </div>
                            <div>
                                <div className="text-2xl font-black text-slate-800">{returns.filter(r => r.status === 'APPROVED').length}</div>
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">Validés</div>
                            </div>
                        </div>
                    </div>
                    <div onClick={() => setActiveTab('REPACKED')} className={`cursor-pointer p-5 rounded-2xl border transition-all ${activeTab === 'REPACKED' ? 'bg-white border-blue-500 ring-2 ring-blue-200' : 'bg-white border-slate-200 hover:border-blue-300'}`}>
                        <div className="flex items-center">
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl mr-4">
                                <RefreshCw size={24} />
                            </div>
                            <div>
                                <div className="text-2xl font-black text-slate-800">{returns.filter(r => r.status === 'REPACKED').length}</div>
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">Reconditionnés</div>
                            </div>
                        </div>
                    </div>
                    <div onClick={() => setActiveTab('REJECTED')} className={`cursor-pointer p-5 rounded-2xl border transition-all ${activeTab === 'REJECTED' ? 'bg-white border-red-500 ring-2 ring-red-200' : 'bg-white border-slate-200 hover:border-red-300'}`}>
                        <div className="flex items-center">
                            <div className="p-3 bg-red-50 text-red-600 rounded-xl mr-4">
                                <X size={24} />
                            </div>
                            <div>
                                <div className="text-2xl font-black text-slate-800">{returns.filter(r => r.status === 'REJECTED').length}</div>
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">Rejetés</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Returns List */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <h2 className="font-bold text-lg text-slate-800 flex items-center">
                            {activeTab === 'PENDING' && 'Demandes en cours'}
                            {activeTab !== 'PENDING' && 'Historique des retours'}
                        </h2>
                        <button
                            onClick={fetchReturns}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        >
                            <RefreshCw size={18} />
                        </button>
                    </div>

                    {loading ? (
                        <div className="p-12 text-center text-slate-400">Chargement...</div>
                    ) : error ? (
                        <div className="p-12 text-center">
                            <AlertTriangle size={48} className="mx-auto text-red-400 mb-4" />
                            <p className="text-red-500 font-bold mb-2">Une erreur est survenue</p>
                            <p className="text-slate-400 mb-4">{error}</p>
                            <button onClick={fetchReturns} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors">
                                Réessayer
                            </button>
                        </div>
                    ) : filteredReturns.length === 0 ? (
                        <div className="p-16 text-center">
                            <Package size={48} className="mx-auto text-slate-200 mb-4" />
                            <p className="text-slate-400 font-medium">Aucun retour dans cette catégorie.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {filteredReturns.map((req) => (
                                <div key={req.id} className="p-6 hover:bg-slate-50/50 transition-colors">
                                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">

                                        {/* Request Info */}
                                        <div className="flex-1">
                                            {/* Header Info: Sender & Patient */}
                                            <div className="mb-4">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <User size={16} className="text-slate-400" />
                                                    <span className="text-slate-900 font-bold">
                                                        Retour de: {req.senderName || 'Inconnu'}
                                                    </span>
                                                    <span className="text-slate-500 text-sm">
                                                        ({req.serviceName || 'Service Inconnu'})
                                                    </span>
                                                    <span className="mx-2 text-slate-300">|</span>
                                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                                                        {new Date(req.createdAt).toLocaleString()}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm text-slate-600 ml-6">
                                                    <FileText size={14} className="text-slate-400" />
                                                    <span>Patient: <span className="font-medium text-slate-800">{req.patientName || 'Inconnu'}</span></span>
                                                    <span className="text-slate-400">(Adm: <span className="font-mono text-xs">{req.admissionDisplay}</span>)</span>
                                                </div>
                                            </div>

                                            {/* Items Preview */}
                                            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-3">
                                                {req.items.map((item, idx) => (
                                                    <div key={idx} className="flex flex-col text-sm border-b border-slate-100 last:border-0 pb-2 last:pb-0">
                                                        <div className="flex items-start justify-between">
                                                            <div className="flex items-center">
                                                                {item.type === 'RETURNED_BOX' ? (
                                                                    item.condition === 'SEALED' ? (
                                                                        <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg mr-3 shadow-sm border border-emerald-100" title="Boîte Scellée">
                                                                            <Box size={18} />
                                                                        </div>
                                                                    ) : (
                                                                        <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg mr-3 shadow-sm border border-amber-100" title="Boîte Entamée">
                                                                            <div className="relative">
                                                                                <Box size={18} />
                                                                                <div className="absolute -top-1 -right-1 bg-amber-500 rounded-full p-[2px] border border-white">
                                                                                    <Split size={8} className="text-white" />
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    )
                                                                ) : (
                                                                    <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg mr-3 shadow-sm border border-blue-100" title="Unités / Vrac">
                                                                        <GripHorizontal size={18} />
                                                                    </div>
                                                                )}
                                                                <div>
                                                                    <div className="flex items-center">
                                                                        <span className="font-black text-slate-800 text-base mr-2">{item.productName || 'Produit Inconnu'}</span>
                                                                        <span className="font-bold text-slate-500 bg-slate-200 px-1.5 rounded text-[10px]">
                                                                            {item.type === 'RETURNED_BOX' && item.condition === 'SEALED'
                                                                                ? `${item.quantity} Boîtes`
                                                                                : `${item.quantity} Unités`
                                                                            }
                                                                        </span>
                                                                    </div>
                                                                    <div className="mt-1 flex items-center gap-2">
                                                                        {item.type === 'RETURNED_BOX' && item.condition === 'SEALED' && (
                                                                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase rounded flex items-center border border-emerald-200">
                                                                                <Check size={10} className="mr-1" /> Boîte Scellée
                                                                            </span>
                                                                        )}
                                                                        {item.type === 'RETURNED_BOX' && item.condition === 'OPENED' && (
                                                                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold uppercase rounded flex items-center border border-amber-200">
                                                                                <Split size={10} className="mr-1" /> (1) Boîte Entamée
                                                                            </span>
                                                                        )}
                                                                        {item.type !== 'RETURNED_BOX' && (
                                                                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold uppercase rounded flex items-center border border-blue-200">
                                                                                <GripHorizontal size={10} className="mr-1" /> Unités / Vrac
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 font-mono ml-11">
                                                            <span className="flex items-center">
                                                                <span className="font-bold mr-1">Lot:</span>
                                                                {item.lotNumber || 'N/A'}
                                                            </span>
                                                            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                                            <span className="flex items-center">
                                                                <span className="font-bold mr-1">EXP:</span>
                                                                {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : 'N/A'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Actions - Only for PENDING */}
                                        {req.status === 'PENDING_QA' && (
                                            <div className="flex flex-col sm:flex-row gap-3 items-center">
                                                <button
                                                    onClick={() => handleProcessStart(req)}
                                                    className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex items-center justify-center text-sm w-full sm:w-auto"
                                                >
                                                    <GripHorizontal size={18} className="mr-2" />
                                                    Traiter / Fractionner
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Split Modal */}
            {selectedRequest && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="text-xl font-black text-slate-900">Traitement du retour</h3>
                                <p className="text-sm text-slate-500">Répartissez les quantités par action.</p>
                            </div>
                            <button onClick={() => setSelectedRequest(null)} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            {selectedRequest.items.map((item) => {
                                const decision = splitDecisions[item.containerId];
                                if (!decision) return null;

                                const currentTotal = decision.approveQty + decision.rejectQty + decision.repackQty;
                                const remaining = decision.max - currentTotal;
                                const isComplete = remaining === 0;

                                return (
                                    <div key={item.containerId} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <div className="font-bold text-slate-800 text-lg">{item.productName}</div>
                                                <div className="text-xs text-slate-500 font-mono">Lot: {item.lotNumber} • EXP: {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : 'N/A'}</div>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <div className="text-sm font-bold text-slate-600">Quantité Totale</div>
                                                <div className="text-2xl font-black text-indigo-600">{item.quantity}</div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {/* Validate */}
                                            <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-sm">
                                                <label className="block text-xs font-bold text-emerald-700 uppercase mb-2">
                                                    Valider
                                                    <span className="ml-1 opacity-70">
                                                        ({item.type === 'RETURNED_BOX' && item.condition === 'SEALED' ? 'Boîtes' : 'Unités'})
                                                    </span>
                                                </label>
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max={decision.max}
                                                        value={decision.approveQty}
                                                        onChange={(e) => handleSplitChange(item.containerId, 'approve', parseInt(e.target.value) || 0)}
                                                        className="w-full text-center font-bold text-lg p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                                    />
                                                </div>
                                            </div>

                                            {/* Repack */}
                                            <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                                                <label className="block text-xs font-bold text-blue-700 uppercase mb-2">
                                                    Reconditionner
                                                    <span className="ml-1 opacity-70">
                                                        ({item.type === 'RETURNED_BOX' && item.condition === 'SEALED' ? 'Boîtes' : 'Unités'})
                                                    </span>
                                                </label>
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max={decision.max}
                                                        value={decision.repackQty}
                                                        onChange={(e) => handleSplitChange(item.containerId, 'repack', parseInt(e.target.value) || 0)}
                                                        className="w-full text-center font-bold text-lg p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                                    />
                                                </div>
                                            </div>

                                            {/* Reject */}
                                            <div className="bg-white p-3 rounded-lg border border-red-100 shadow-sm">
                                                <label className="block text-xs font-bold text-red-700 uppercase mb-2">
                                                    Rejeter
                                                    <span className="ml-1 opacity-70">
                                                        ({item.type === 'RETURNED_BOX' && item.condition === 'SEALED' ? 'Boîtes' : 'Unités'})
                                                    </span>
                                                </label>
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max={decision.max}
                                                        value={decision.rejectQty}
                                                        onChange={(e) => handleSplitChange(item.containerId, 'reject', parseInt(e.target.value) || 0)}
                                                        className="w-full text-center font-bold text-lg p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-2 flex justify-end">
                                            {!isComplete && (
                                                <span className="text-xs font-bold text-amber-600 flex items-center">
                                                    <AlertTriangle size={12} className="mr-1" />
                                                    Il reste {remaining} {item.type === 'RETURNED_BOX' && item.condition === 'SEALED' ? 'boîtes' : 'unités'} à attribuer
                                                </span>
                                            )}
                                            {isComplete && (
                                                <span className="text-xs font-bold text-emerald-600 flex items-center">
                                                    <Check size={12} className="mr-1" /> Total attribué
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                            <button
                                onClick={() => setSelectedRequest(null)}
                                className="px-6 py-2 bg-white text-slate-700 font-bold rounded-xl hover:bg-slate-100 border border-slate-200 transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleSubmitSplit}
                                className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={processingId !== null || Object.values(splitDecisions).some(d => (d.approveQty + d.rejectQty + d.repackQty) !== d.max)}
                            >
                                {processingId ? 'Traitement...' : 'Confirmer le traitement'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
