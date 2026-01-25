
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft, RefreshCw, ShoppingCart, AlertCircle, FileText, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';

import DemandLineBlock from './DemandLineBlock';

const TransferManager: React.FC = () => {
    const { demandId } = useParams<{ demandId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    
    // State
    const [demand, setDemand] = useState<any>(null);
    const [sessionId, setSessionId] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    
    // Global Cart State (Map of demandLineId -> Reservations)
    const [cart, setCart] = useState<Map<string, any[]>>(new Map());
    
    // Session Init
    useEffect(() => {
        // Generate or recover session (TODO: Recover from localStorage?)
        const sid = uuidv4();
        setSessionId(sid);
        loadDemand();
        
        // Heartbeat
        const interval = setInterval(() => {
            if(sid) api.refreshStockReservationSession(sid).catch(console.error);
        }, 60000); // 1 min

        return () => clearInterval(interval);
    }, [demandId]);

    const loadDemand = async () => {
        try {
            if (!demandId) return;
            const data = await api.getStockDemandDetails(demandId);
            setDemand(data);
        } catch (error) {
            console.error(error);
            toast.error("Erreur chargement demande");
        } finally {
            setLoading(false);
        }
    };

    // Cart Actions (passed to children)
    const refreshCart = async () => {
        try {
            const items = await api.getStockReservationCart(sessionId);
            // Group by demand_line_id
            const newCart = new Map();
            items.forEach((item: any) => {
                // If ad-hoc line (no demand_line_id), handle separately? 
                // For now assuming linked to demand lines. 
                // Wait, if item.demand_line_id is null? (AdHoc)
                // Use a special key or just list them.
                const key = item.demand_line_id || 'ADHOC';
                const list = newCart.get(key) || [];
                list.push(item);
                newCart.set(key, list);
            });
            setCart(newCart);
        } catch (error) {
            console.error("Cart sync error", error);
        }
    };
    
    // Initial Cart Sync
    useEffect(() => {
        if(sessionId) refreshCart();
    }, [sessionId]);


    const handleCommit = async () => {
        if (!confirm("Confirmer le transfert de stock ? Cette action est irréversible.")) return;
        
        setSubmitting(true);
        try {
           const res = await api.commitStockReservationSession(sessionId, demandId!);
           if (res.success) {
               toast.success("Transfert validé avec succès !");
               navigate('/pharmacy/requests');
           }
        } catch (error: any) {
            toast.error(error.message || "Erreur lors du transfert");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Chargement...</div>;
    if (!demand) return <div className="p-8 text-center text-red-500">Demande introuvable</div>;

    // Calculations
    const totalLines = demand.items?.length || 0;
    const totalReady = Array.from(cart.values()).flat().length; // Simplistic count of batches
    
    // Check coverage
    // const completelyFilled = ... logic

    return (
        <div className="min-h-screen bg-slate-50 pb-24"> 
            
            {/* Sticky Header */}
            <div className="sticky top-0 z-20 bg-white border-b shadow-sm px-6 py-4 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full">
                        <ArrowLeft className="w-5 h-5 text-slate-600" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            Demande {demand.id.slice(0,8)}...
                            <span className={`px-2 py-0.5 rounded text-xs ${
                                demand.priority === 'URGENT' ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-700'
                            }`}>
                                {demand.priority}
                            </span>
                        </h1>
                        <div className="text-sm text-slate-500">
                             Service: <span className="font-medium text-slate-700">{demand.service_id}</span> • 
                             Par: {demand.requested_by} • 
                             {new Date(demand.created_at).toLocaleString()}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <div className="text-xs text-slate-400">Statut</div>
                        <div className="font-medium">{demand.status}</div>
                    </div>
                </div>
            </div>

            {/* Content Scroller */}
            <div className="max-w-5xl mx-auto p-6 space-y-6">
                
                {demand.items?.map((line: any) => (
                    <DemandLineBlock 
                        key={line.product_id} // Should be unique per demand, or use demand_line_id logic if available?
                        // Actually in `stock_demand_lines`, PK is (request_id, product_id). So product_id is unique per demand.
                        demandId={demand.id}
                        line={line}
                        sessionId={sessionId}
                        cartItems={cart.get(line.product_id) || []} // We used product_id as key in cart logic? No, we used demand_line_id.
                        // My schema update for `stock_demand_lines` didn't add a dedicated UUID line ID.
                        // So `demand_line_id` in reservations MUST be the `product_id` (from the demand line).
                        // Let's verify: In createDemand, I inserted product_id.
                        // So `demand_line_id` === `line.product_id`.
                        refreshCart={refreshCart}
                    />
                ))}

            </div>

            {/* Sticky Footer */}
            <div className="fixed bottom-0 left-0 right-0 bg-indigo-900 text-white p-4 shadow-lg z-30">
                <div className="max-w-5xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-8">
                        <div>
                           <div className="text-indigo-300 text-xs uppercase font-bold">Lignes Préparées</div>
                           <div className="text-2xl font-bold">{cart.size} / {totalLines}</div>
                        </div>
                        <div>
                           <div className="text-indigo-300 text-xs uppercase font-bold">Total Lots</div>
                           <div className="text-2xl font-bold">{totalReady}</div>
                        </div>
                    </div>

                    <button 
                        onClick={handleCommit}
                        disabled={submitting || totalReady === 0}
                        className="bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-lg font-bold flex items-center gap-2 transition-transform active:scale-95"
                    >
                        {submitting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                        TRANSFÉRER LE STOCK
                    </button>
                </div>
            </div>

        </div>
    );
};

export default TransferManager;
