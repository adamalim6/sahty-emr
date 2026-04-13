import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import {
    ArrowLeft, Package, CheckCircle2, Clock, AlertTriangle,
    XCircle, ChevronRight, Truck, FileText, User, Building2
} from 'lucide-react';

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    SUBMITTED:        { label: 'Transmis',        color: 'text-blue-700',   bg: 'bg-blue-50',   icon: <Clock size={14}/> },
    PARTIALLY_FILLED: { label: 'Partiellement Servi', color: 'text-amber-700', bg: 'bg-amber-50', icon: <ChevronRight size={14}/> },
    FILLED:           { label: 'Servi',           color: 'text-green-700',  bg: 'bg-green-50',  icon: <CheckCircle2 size={14}/> },
    CANCELLED:        { label: 'Annulé',          color: 'text-slate-500',  bg: 'bg-slate-100', icon: <XCircle size={14}/> },
    REJECTED:         { label: 'Rejeté',          color: 'text-red-700',    bg: 'bg-red-50',    icon: <XCircle size={14}/> },
    DRAFT:            { label: 'Brouillon',       color: 'text-slate-500',  bg: 'bg-slate-100', icon: <Clock size={14}/> },
};

const DemandDetailView: React.FC = () => {
    const { demandId } = useParams<{ demandId: string }>();
    const navigate = useNavigate();
    const [demand, setDemand] = useState<any>(null);
    const [productNames, setProductNames] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!demandId) return;
        Promise.all([
            api.getStockDemandDetails(demandId),
            api.getStockDemandCatalog({ limit: 500, status: 'ALL' })
        ]).then(([d, catalog]) => {
            setDemand(d);
            // Build product name map from catalog (response shape: { data: [...] })
            const catalogItems = catalog?.data || catalog?.items || (Array.isArray(catalog) ? catalog : []);
            const nameMap: Record<string, string> = {};
            catalogItems.forEach((p: any) => {
                const key = p.id || p.product_id;
                if (key) nameMap[key] = p.name || p.product_name || p.label;
            });
            setProductNames(nameMap);
        }).catch(err => {
            console.error(err);
        }).finally(() => setLoading(false));
    }, [demandId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-slate-400 animate-pulse">Chargement...</div>
            </div>
        );
    }

    if (!demand) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-red-400">Demande introuvable.</div>
            </div>
        );
    }

    const statusInfo = STATUS_MAP[demand.status] || { label: demand.status, color: 'text-slate-600', bg: 'bg-slate-100', icon: null };

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Sticky Header */}
            <div className="sticky top-0 z-20 bg-white border-b shadow-sm px-6 py-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/replenishment', { state: { tab: 'history' } })}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-slate-600" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-slate-400" />
                            {demand.demand_ref || demand.id.slice(0, 8)}
                            {demand.priority === 'URGENT' && (
                                <span className="flex items-center gap-1 bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-bold">
                                    <AlertTriangle size={11} /> URGENT
                                </span>
                            )}
                        </h1>
                        <div className="text-xs text-slate-400 mt-0.5">
                            Créée le {new Date(demand.created_at).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                </div>
                {/* Status Badge */}
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${statusInfo.bg} ${statusInfo.color}`}>
                    {statusInfo.icon}
                    {statusInfo.label}
                </div>
            </div>

            <div className="px-8 py-6 max-w-5xl mx-auto space-y-6">

                {/* Info Cards Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-lg">
                            <Building2 className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <div className="text-xs text-slate-400 uppercase font-semibold tracking-wide">Service</div>
                            <div className="font-bold text-slate-800">{demand.service_name || demand.service_id}</div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
                        <div className="p-2 bg-purple-50 rounded-lg">
                            <User className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                            <div className="text-xs text-slate-400 uppercase font-semibold tracking-wide">Demandeur</div>
                            <div className="font-bold text-slate-800">{demand.requested_by || '—'}</div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
                        <div className="p-2 bg-amber-50 rounded-lg">
                            <Truck className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <div className="text-xs text-slate-400 uppercase font-semibold tracking-wide">Priorité</div>
                            <div className={`font-bold ${demand.priority === 'URGENT' ? 'text-red-600' : 'text-slate-800'}`}>
                                {demand.priority === 'URGENT' ? 'URGENT' : 'Normale'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Requested Items */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="px-5 py-3 border-b bg-slate-50 flex items-center gap-2">
                        <Package className="w-4 h-4 text-slate-500" />
                        <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Produits Demandés</h2>
                    </div>
                    <div className="divide-y">
                        {demand.items?.length === 0 ? (
                            <div className="p-6 text-center text-slate-400 italic text-sm">Aucun produit demandé.</div>
                        ) : (
                            demand.items?.map((item: any, idx: number) => (
                                <DemandItemRow
                                    key={idx}
                                    item={item}
                                    demandId={demand.id}
                                    productNames={productNames}
                                />
                            ))
                        )}
                    </div>
                </div>

                {(demand.status === 'SUBMITTED') && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700 flex items-center gap-2">
                        <Clock size={16} />
                        Cette demande est en attente de traitement par la pharmacie.
                    </div>
                )}

            </div>
        </div>
    );
};

// Sub-component: one requested item row with its own fulfilled qty
const DemandItemRow: React.FC<{ item: any; demandId: string; productNames: Record<string, string> }> = ({ item, demandId, productNames }) => {
    const [itemHistory, setItemHistory] = useState<any[]>([]);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        api.getTransferHistory(demandId, item.product_id)
            .then(setItemHistory)
            .catch(console.error);
    }, [demandId, item.product_id]);

    const totalFulfilled = itemHistory.reduce((sum, h) => sum + (h.qty_transferred || 0), 0);
    const isComplete = totalFulfilled >= item.qty_requested;
    const isPartial = totalFulfilled > 0 && !isComplete;

    // Resolve product name from catalog map, fallback to truncated UUID
    const productLabel = productNames[item.product_id] || item.product_name || item.product_id?.slice(0, 8) + '...';

    let progressColor = 'bg-slate-200';
    let textColor = 'text-slate-500';
    if (isComplete) { progressColor = 'bg-green-500'; textColor = 'text-green-700'; }
    else if (isPartial) { progressColor = 'bg-amber-400'; textColor = 'text-amber-700'; }

    const progressPct = Math.min(100, (totalFulfilled / Math.max(item.qty_requested, 1)) * 100);

    return (
        <div className="px-5 py-4">
            <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => itemHistory.length > 0 && setExpanded(!expanded)}
            >
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        isComplete ? 'bg-green-100' : isPartial ? 'bg-amber-100' : 'bg-slate-100'
                    }`}>
                        {isComplete
                            ? <CheckCircle2 size={16} className="text-green-600" />
                            : isPartial
                            ? <ChevronRight size={16} className="text-amber-600" />
                            : <Package size={16} className="text-slate-400" />
                        }
                    </div>
                    <div>
                        <div className="font-semibold text-slate-800 text-sm">{productLabel}</div>
                        {item.target_location_name && (
                            <div className="text-xs text-blue-600 mt-0.5">
                                → {item.target_location_name}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    {/* Progress Bar */}
                    <div className="w-32 hidden md:block">
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all ${progressColor}`}
                                style={{ width: `${progressPct}%` }}
                            />
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-slate-400">Demandé</div>
                        <div className="font-bold text-slate-700">{item.qty_requested} U</div>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-slate-400">Fourni</div>
                        <div className={`font-bold text-lg ${textColor}`}>{totalFulfilled} U</div>
                    </div>
                    {itemHistory.length > 0 && (
                        <ChevronRight
                            size={16}
                            className={`text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
                        />
                    )}
                </div>
            </div>

            {/* Expanded fulfillment details for this product */}
            {expanded && itemHistory.length > 0 && (
                <div className="mt-3 ml-11 space-y-2">
                    {itemHistory.map((h, i) => (
                        <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-xs text-slate-600">
                            <div className="flex items-center gap-3">
                                <span className="font-mono font-bold text-slate-700">Lot #{h.lot}</span>
                                {h.expiry && <span className="text-slate-400">Exp: {new Date(h.expiry).toLocaleDateString('fr-FR')}</span>}
                                <span className="text-slate-400">{h.source_location_name} → {h.destination_location_name}</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="font-bold text-green-700">{h.qty_transferred} U</span>
                                <span className="text-slate-400">{h.date ? new Date(h.date).toLocaleDateString('fr-FR') : ''}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default DemandDetailView;
