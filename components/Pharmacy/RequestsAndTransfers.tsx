import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { ReplenishmentRequest, ReplenishmentStatus, InventoryItem } from '../../types/pharmacy';
import { Check, X, Eye, Package, ArrowRight, AlertTriangle, Search } from 'lucide-react';

interface PreparationData {
    requestId: string;
    items: {
        productId: string;
        requestedQty: number;
        dispensedBatches: {
            batchNumber: string;
            expiryDate: string;
            quantity: number;
        }[];
        substitution?: {
            productId: string;
            reason: string;
        }
    }[];
}

interface RequestsAndTransfersProps {
    onViewDetails?: (request: ReplenishmentRequest) => void;
}

export const RequestsAndTransfers: React.FC<RequestsAndTransfersProps> = ({ onViewDetails }) => {
    const [requests, setRequests] = useState<ReplenishmentRequest[]>([]);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState<ReplenishmentRequest | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [reqs, inv] = await Promise.all([
                api.getReplenishmentRequests(),
                api.getInventory()
            ]);
            setRequests(reqs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
            setInventory(inv);
        } catch (error) {
            console.error("Failed to load data", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Chargement...</div>;

    return (
        <div className="p-6 space-y-6">
            <h1 className="text-2xl font-bold text-slate-800">Demandes de Réapprovisionnement</h1>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-semibold">
                            <th className="p-4">Date</th>
                            <th className="p-4">Service</th>
                            <th className="p-4">Demandé par</th>
                            <th className="p-4">Statut</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {requests.map(req => (
                            <tr 
                                key={req.id} 
                                className="hover:bg-indigo-50/50 transition-colors cursor-pointer group"
                                onClick={() => onViewDetails ? onViewDetails(req) : setSelectedRequest(req)}
                            >
                                <td className="p-4 text-sm text-slate-600 font-mono">
                                    {new Date(req.createdAt).toLocaleDateString()}
                                </td>
                                <td className="p-4 font-bold text-slate-900 text-base">{req.serviceName}</td>
                                <td className="p-4 text-sm text-slate-600 flex items-center">
                                    <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center mr-3 text-xs font-bold text-slate-500">
                                        {req.requesterName.charAt(0)}
                                    </div>
                                    {req.requesterName}
                                </td>
                                <td className="p-4">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                        ${req.status === ReplenishmentStatus.PENDING ? 'bg-amber-100 text-amber-800' :
                                            req.status === ReplenishmentStatus.APPROVED ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}`}>
                                        {req.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {requests.length === 0 && (
                    <div className="p-12 text-center text-slate-400">
                        Aucune demande en cours
                    </div>
                )}
            </div>

            {/* Simple Detail Modal (Fallback if onViewDetails not provided) */}
            {selectedRequest && !onViewDetails && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full m-4 max-h-[80vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold">Détails de la demande</h2>
                            <button onClick={() => setSelectedRequest(null)}><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6">
                            <div className="space-y-4">
                                {selectedRequest.items.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded border border-slate-100">
                                        <div>
                                            <div className="font-medium">{item.productName}</div>
                                            <div className="text-sm text-slate-500">Qté demandée: {item.quantityRequested}</div>
                                            {item.productDispensedName && <div className="text-xs text-amber-600 mt-1">Substitution: {item.productDispensedName}</div>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
                            <button onClick={() => setSelectedRequest(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg">Fermer</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
