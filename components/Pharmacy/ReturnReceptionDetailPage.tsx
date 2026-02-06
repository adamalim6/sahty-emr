import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { 
  ArrowLeft, Calendar, FileText, User, Package, Box, CheckCircle, 
  MapPin, AlertTriangle, Loader, Save, List, PlusCircle, Eye
} from 'lucide-react';

interface ReturnLine {
    id: string; // return_line_id
    product_id: string;
    product_name: string;
    dci: string;
    lot: string;
    expiry: string;
    qty_declared_units: number;
    qty_received_units: number; // NEW: Already received
    destination_location_id?: string;
}

interface StockReturn {
    id: string;
    return_reference: string;
    service_id: string;
    created_by: string;
    status: string;
    created_at: string;
    lines: ReturnLine[];
    service_name?: string; 
}

interface ReturnReception {
    id: string;
    reception_reference: string;
    received_at: string;
    username: string;
    nom: string;
    prenom: string;
    total_received: number;
}

export const ReturnReceptionDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    
    const [returnDetail, setReturnDetail] = useState<StockReturn | null>(null);
    const [receptions, setReceptions] = useState<ReturnReception[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    
    // Tab State
    const [activeTab, setActiveTab] = useState<'NEW' | 'MANAGEMENT'>('NEW');

    // State for received quantities: { [lineId]: number }
    const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number>>({});

    useEffect(() => {
        if (id) {
            loadReturnDetails(id);
            loadReceptions(id);
        }
    }, [id]);

    const loadReturnDetails = async (returnId: string) => {
        setLoading(true);
        try {
            const data = await api.getPharmacyReturnDetails(returnId);
            setReturnDetail(data);

            // Initialize received quantities with remaining quantities (rest à réceptionner)
            const initialQty: Record<string, number> = {};
            data.lines.forEach((line: ReturnLine) => {
                const remaining = line.qty_declared_units - (line.qty_received_units || 0);
                initialQty[line.id] = Math.max(0, remaining); // Default to remaining
            });
            setReceivedQuantities(initialQty);

        } catch (err: any) {
            console.error("Failed to load return details:", err);
            setError("Impossible de charger les détails du retour.");
        } finally {
            setLoading(false);
        }
    };

    const loadReceptions = async (returnId: string) => {
        try {
            const list = await api.getReturnReceptions(returnId);
            setReceptions(list);
            
            // If we have receptions and initially loading, maybe we want to default to Management?
            // For now, adhere to "Nouvelle réception (default active)" rule unless changed.
        } catch (err) {
            console.error("Failed to load receptions list", err);
        }
    };

    const handleQuantityChange = (lineId: string, value: string) => {
        const qty = parseInt(value) || 0;
        setReceivedQuantities(prev => ({
            ...prev,
            [lineId]: qty
        }));
    };

    const handleSubmit = async () => {
        if (!returnDetail) return;
        setSubmitting(true);
        try {
            // Transform state to API payload
            const linesPayload = Object.keys(receivedQuantities).map(lineId => ({
                returnLineId: lineId,
                qtyReceived: receivedQuantities[lineId]
            }));

            await api.createReception({
                returnId: returnDetail.id,
                lines: linesPayload
            });

            // Success
            // 1. Refresh Receptions List
            await loadReceptions(returnDetail.id);
            // 2. Switch to Management Tab
            setActiveTab('MANAGEMENT');
            // 3. Reset Form (Optional? user said "The newly created reception must appear there immediately")
            
        } catch (err: any) {
            console.error("Reception failed:", err);
            alert("Erreur lors de la réception: " + (err.message || "Unknown error"));
        } finally {
            setSubmitting(false);
        }
    };

    // Grouping Logic: Group by Product ID + Lot
    const groupedLines = returnDetail?.lines.reduce((acc, line) => {
        const key = `${line.product_id}-${line.lot}`;
        if (!acc[key]) {
            acc[key] = {
                product_name: line.product_name,
                dci: line.dci,
                lot: line.lot,
                expiry: line.expiry,
                lines: []
            };
        }
        acc[key].lines.push(line);
        return acc;
    }, {} as Record<string, { product_name: string, dci: string, lot: string, expiry: string, lines: ReturnLine[] }>);

    if (loading) return (
        <div className="flex justify-center items-center h-64">
            <Loader className="animate-spin text-blue-600" size={32} />
        </div>
    );

    if (error || !returnDetail) return (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center space-x-2">
            <AlertTriangle size={20} />
            <span>{error || "Retour non trouvé."}</span>
            <button onClick={() => navigate('/pharmacy/return-receptions')} className="underline ml-4">
                Retour à la liste
            </button>
        </div>
    );

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-20">
            {/* Header / Nav */}
            <div className="flex items-center space-x-4 mb-2">
                <button onClick={() => navigate('/pharmacy/return-receptions')} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <ArrowLeft size={20} className="text-slate-600" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Réception du Retour</h1>
                    <div className="flex items-center space-x-2 text-slate-500 text-sm">
                        <span className="font-mono bg-slate-100 px-1 rounded">{returnDetail.return_reference}</span>
                    </div>
                </div>
            </div>

            {/* Info Card */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex flex-col">
                    <span className="text-xs font-semibold text-slate-400 uppercase">Service Source</span>
                    <div className="flex items-center space-x-2 mt-1">
                        <MapPin size={18} className="text-blue-500" />
                        <span className="font-medium text-slate-800">{returnDetail.service_name || returnDetail.service_id || 'Service'}</span>
                    </div>
                </div>
                <div className="flex flex-col">
                    <span className="text-xs font-semibold text-slate-400 uppercase">Statut</span>
                    <div className="flex items-center space-x-2 mt-1">
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-xs font-bold border border-blue-200">
                            {returnDetail.status}
                        </span>
                    </div>
                </div>
                <div className="flex flex-col">
                     <span className="text-xs font-semibold text-slate-400 uppercase">Date de Création</span>
                     <div className="flex items-center space-x-2 mt-1">
                        <Calendar size={18} className="text-slate-400" />
                        <span className="font-medium text-slate-800">{new Date(returnDetail.created_at).toLocaleString('fr-FR')}</span>
                     </div>
                </div>
            </div>

            {/* TABS */}
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg w-fit">
                <button 
                    onClick={() => setActiveTab('NEW')}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'NEW' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <PlusCircle size={16} />
                    <span>Nouvelle Réception</span>
                </button>
                <button 
                    onClick={() => setActiveTab('MANAGEMENT')}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'MANAGEMENT' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <List size={16} />
                    <span>Gestion des Réceptions</span>
                </button>
            </div>

            {/* TAB CONTENT: NEW RECEPTION */}
            {activeTab === 'NEW' && (
                <div className="space-y-4 animate-fadeIn">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center">
                        <Package className="mr-2" size={20} />
                        Produits à Réceptionner ({returnDetail.lines.length})
                    </h2>

                    {groupedLines && Object.values(groupedLines).map((group, idx) => (
                        <div key={idx} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                            {/* Group Header */}
                            <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex justify-between items-center">
                                <div>
                                    <h3 className="font-bold text-slate-800">{group.product_name}</h3>
                                    <p className="text-xs text-slate-500">{group.dci}</p>
                                </div>
                                <div className="flex items-center space-x-4 text-sm">
                                    <span className="flex items-center text-slate-600 bg-white px-2 py-1 rounded border border-slate-200">
                                        <Box size={14} className="mr-1 text-slate-400" />
                                        Lot: <strong className="ml-1 text-slate-800">{group.lot}</strong>
                                    </span>
                                    <span className="flex items-center text-slate-600">
                                        <Calendar size={14} className="mr-1 text-slate-400" />
                                        Exp: {new Date(group.expiry).toLocaleDateString('fr-FR')}
                                    </span>
                                </div>
                            </div>

                            {/* Lines in Group */}
                            <div className="divide-y divide-slate-100">
                                {group.lines.map(line => {
                                    const remaining = line.qty_declared_units - (line.qty_received_units || 0);
                                    const isFullyReceived = remaining <= 0;
                                    
                                    return (
                                        <div key={line.id} className={`p-4 flex items-center justify-between transition-colors ${isFullyReceived ? 'bg-green-50' : 'hover:bg-slate-50'}`}>
                                            {/* Déclarée */}
                                            <div className="flex-1">
                                                <div className="text-sm text-slate-500">
                                                    Quantité Déclarée
                                                </div>
                                                <div className="text-lg font-semibold text-slate-800">
                                                    {line.qty_declared_units} <span className="text-xs font-normal text-slate-400">unités</span>
                                                </div>
                                            </div>

                                            {/* Déjà Reçue */}
                                            <div className="flex-1 text-center">
                                                <div className="text-sm text-slate-500">
                                                    Déjà Reçue
                                                </div>
                                                <div className="text-lg font-semibold text-green-600">
                                                    {line.qty_received_units || 0} <span className="text-xs font-normal text-green-500">unités</span>
                                                </div>
                                            </div>

                                            {/* Reste à Réceptionner */}
                                            <div className="flex-1 text-center">
                                                <div className="text-sm text-slate-500">
                                                    Reste à Réceptionner
                                                </div>
                                                <div className={`text-lg font-semibold ${isFullyReceived ? 'text-green-600' : 'text-amber-600'}`}>
                                                    {remaining} <span className="text-xs font-normal">{isFullyReceived ? '✓ Complet' : 'unités'}</span>
                                                </div>
                                            </div>

                                            {/* Input Quantité Reçue */}
                                            <div className="flex-1 flex flex-col items-end">
                                                <label className="text-xs font-semibold text-slate-500 mb-1">
                                                    Qté à Réceptionner
                                                </label>
                                                {isFullyReceived ? (
                                                    <span className="text-green-600 font-medium text-sm">Terminé</span>
                                                ) : (
                                                    <div className="flex items-center space-x-2">
                                                        <input 
                                                            type="number" 
                                                            min="0"
                                                            max={remaining}
                                                            className="w-24 text-right border border-slate-300 rounded-lg px-3 py-2 font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                                                            value={receivedQuantities[line.id] ?? ''}
                                                            onChange={(e) => {
                                                                const val = Math.min(parseInt(e.target.value) || 0, remaining);
                                                                handleQuantityChange(line.id, String(val));
                                                            }}
                                                        />
                                                        <span className="text-sm text-slate-500">Unités</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    {/* Footer Action */}
                    <div className="fixed bottom-6 right-6 z-10">
                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className={`
                                flex items-center space-x-2 px-6 py-4 rounded-xl shadow-lg font-bold text-white transition-all
                                ${submitting ? 'bg-slate-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 hover:scale-105 active:scale-95'}
                            `}
                        >
                            {submitting ? <Loader className="animate-spin" size={24} /> : <CheckCircle size={24} />}
                            <span className="text-lg">Réceptionner Retour</span>
                        </button>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: MANAGEMENT */}
            {activeTab === 'MANAGEMENT' && (
                <div className="space-y-4 animate-fadeIn">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center">
                        <List className="mr-2" size={20} />
                        Historique des Réceptions ({receptions.length})
                    </h2>

                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Référence</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Reçu Par</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Qté Reçue</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {receptions.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                            Aucune réception effectuée pour le moment.
                                        </td>
                                    </tr>
                                ) : (
                                    receptions.map((rcp) => (
                                        <tr 
                                            key={rcp.id} 
                                            className="hover:bg-blue-50 cursor-pointer transition-colors"
                                            onClick={() => navigate(`/pharmacy/reception-details/${rcp.id}`)}
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <Box size={16} className="text-blue-500 mr-2" />
                                                    <span className="font-medium text-slate-900">{rcp.reception_reference || 'N/A'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                                {new Date(rcp.received_at).toLocaleString('fr-FR')}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                                {rcp.username}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                    {rcp.total_received} unités
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                                <button className="text-blue-600 hover:text-blue-900">
                                                    <Eye size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};
