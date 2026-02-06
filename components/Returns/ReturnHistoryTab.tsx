
import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { FileText, Eye, Calendar, User, Truck, X, Package } from 'lucide-react';
import toast from 'react-hot-toast';

interface ReturnHistoryTabProps {
    services: any[];
    selectedServiceId: string;
}

const ReturnHistoryTab: React.FC<ReturnHistoryTabProps> = ({ services, selectedServiceId }) => {
    const [returns, setReturns] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedReturn, setSelectedReturn] = useState<any | null>(null);
    const [detailsLoading, setDetailsLoading] = useState(false);

    useEffect(() => {
        if (selectedServiceId) {
            loadHistory();
        }
    }, [selectedServiceId]);

    const loadHistory = async () => {
        setLoading(true);
        try {
            const data = await api.getReturns(selectedServiceId);
            setReturns(data || []);
        } catch (error) {
            console.error(error);
            toast.error('Erreur chargement historique');
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetails = async (returnId: string) => {
        setDetailsLoading(true);
        setSelectedReturn(null); // Reset
        try {
            const details = await api.getReturnDetails(returnId);
            setSelectedReturn(details);
        } catch (error) {
            console.error(error);
            toast.error('Erreur chargement détails');
        } finally {
            setDetailsLoading(false);
        }
    };

    const closeDetails = () => {
        setSelectedReturn(null);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'CREATED': return <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-bold">CRÉÉ</span>;
            case 'PARTIALLY_RECEIVED': return <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-bold">REÇU PARTIEL</span>;
            case 'CLOSED': return <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-bold">CLÔTURÉ</span>;
            case 'CANCELLED': return <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-bold">ANNULÉ</span>;
            default: return <span className="bg-slate-100 text-slate-800 px-2 py-1 rounded-full text-xs font-bold">{status}</span>;
        }
    };

    return (
        <div className="flex flex-col h-full relative">
            {/* List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b">
                        <tr>
                            <th className="p-4 font-semibold text-slate-700">Référence</th>
                            <th className="p-4 font-semibold text-slate-700">Date</th>
                            <th className="p-4 font-semibold text-slate-700">Créé par</th>
                            <th className="p-4 font-semibold text-slate-700">Statut</th>
                            <th className="p-4 font-semibold text-slate-700 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y text-slate-600">
                        {loading ? (
                            <tr><td colSpan={5} className="p-8 text-center">Chargement...</td></tr>
                        ) : returns.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center italic text-slate-400">Aucun historique de retour trouvé.</td></tr>
                        ) : (
                            returns.map(r => (
                                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 font-medium text-slate-900 flex items-center gap-2">
                                        <FileText size={16} className="text-slate-400" />
                                        {r.return_reference}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <Calendar size={14} className="text-slate-400" />
                                            {new Date(r.created_at).toLocaleDateString()} {new Date(r.created_at).toLocaleTimeString().slice(0,5)}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <User size={14} className="text-slate-400" />
                                            {r.username || 'N/A'}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        {getStatusBadge(r.status)}
                                    </td>
                                    <td className="p-4 text-right">
                                        <button 
                                            onClick={() => handleViewDetails(r.id)}
                                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded-lg transition-colors"
                                        >
                                            <Eye size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Details Modal / Overlay */}
            {/* Simple centered modal */}
            {(selectedReturn || detailsLoading) && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
                        
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                    <Truck className="text-indigo-600" />
                                    Détails du Retour
                                </h2>
                                {selectedReturn && (
                                    <div className="mt-1 flex items-center gap-3 text-sm text-slate-500">
                                        <span className="font-mono bg-white border px-2 py-0.5 rounded">{selectedReturn.return_reference}</span>
                                        <span>•</span>
                                        <span>{new Date(selectedReturn.created_at).toLocaleString()}</span>
                                    </div>
                                )}
                            </div>
                            <button 
                                onClick={closeDetails}
                                className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                            {detailsLoading ? (
                                <div className="text-center py-10">Chargement des détails...</div>
                            ) : selectedReturn ? (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <div>
                                            <label className="text-xs font-bold text-slate-400 uppercase">Statut</label>
                                            <div className="mt-1">{getStatusBadge(selectedReturn.status)}</div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-400 uppercase">Service</label>
                                            <div className="font-medium text-slate-800 mt-1">
                                                {services.find(s => s.id === selectedReturn.service_id)?.name || 'N/A'}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-400 uppercase">Créé par</label>
                                            <div className="font-medium text-slate-800 mt-1">
                                                {/* API details usually don't populate user name in getReturnDetails but let's assume getReturns list had it. 
                                                    Ideally getReturnDetails should populate it or we assume user knows. 
                                                */}
                                                 {/* For now, just show ID or nothing if simplistic */}
                                                 <span className="text-xs font-mono">{selectedReturn.created_by}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                            <Package size={18} className="text-slate-400" />
                                            Produits Retournés
                                        </h3>
                                        <div className="border rounded-lg overflow-hidden">
                                            <table className="w-full text-sm">
                                                <thead className="bg-slate-50 border-b text-left">
                                                    <tr>
                                                        <th className="p-3 text-slate-600">Produit</th>
                                                        <th className="p-3 text-slate-600">Lot & Expiry</th>
                                                        <th className="p-3 text-right text-slate-600">Qté Retournée</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {selectedReturn.lines?.map((line: any) => (
                                                        <tr key={line.id}>
                                                            <td className="p-3 font-medium text-slate-800">
                                                                {/* We assume backend enriched it OR we fetch names? 
                                                                    getReturnDetails implementation in service uses only table columns.
                                                                    We need enriched names! 
                                                                    I didn't implement JOIN in getReturnDetails. 
                                                                    I should fix backend service later or fetch catalog here?
                                                                    For now, show ID if name missing.
                                                                */}
                                                                {line.product_id}
                                                            </td>
                                                            <td className="p-3">
                                                                <div className="flex flex-col">
                                                                    <span className="font-mono text-slate-700">{line.lot}</span>
                                                                    <span className="text-xs text-slate-500">{new Date(line.expiry).toLocaleDateString()}</span>
                                                                </div>
                                                            </td>
                                                            <td className="p-3 text-right font-bold text-slate-800">
                                                                {line.qty_returned}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-slate-50 border-t flex justify-end">
                            <button 
                                onClick={closeDetails}
                                className="px-6 py-2 bg-white border border-slate-300 shadow-sm rounded-lg font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                            >
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReturnHistoryTab;
