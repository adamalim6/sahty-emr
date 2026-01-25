
import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { ChevronDown, ChevronRight, History, Package, Box, RefreshCw, Trash2, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

interface DemandLineBlockProps {
    demandId: string;
    line: {
        product_id: string; // The requested product
        qty_requested: number;
    };
    sessionId: string;
    cartItems: any[];
    refreshCart: () => void;
}

const DemandLineBlock: React.FC<DemandLineBlockProps> = ({ demandId, line, sessionId, cartItems, refreshCart }) => {
    const [expanded, setExpanded] = useState(false);
    const [productName, setProductName] = useState('Chargement...'); 
    const [selectedProduct, setSelectedProduct] = useState<any>(null); // Full object
    
    // Substitution State
    const [isSubstituting, setIsSubstituting] = useState(false);
    const [subQuery, setSubQuery] = useState('');
    const [subResults, setSubResults] = useState<any[]>([]);
    
    const [history, setHistory] = useState<any[]>([]);
    
    // Prep State
    const [selectedProductId, setSelectedProductId] = useState(line.product_id); 
    const [availableLots, setAvailableLots] = useState<any[]>([]);
    const [loadingLots, setLoadingLots] = useState(false);
    
    // Dispense & Mode State
    const [dispenseMode, setDispenseMode] = useState<'FEFO' | 'MANUAL'>('FEFO');
    const [prepMode, setPrepMode] = useState<'BOX' | 'UNIT'>('BOX');
    const [manualQty, setManualQty] = useState(1);
    
    // Helpers
    const UNITS_PER_BOX = 30; // TODO: Fetch from Product Config
    
    const getQtyInUnits = (q: number) => prepMode === 'BOX' ? q * UNITS_PER_BOX : q;
    const formatQty = (u: number) => prepMode === 'BOX' ? `${(u / UNITS_PER_BOX).toFixed(1)} Bts` : `${u} U`;

    const isLotExpired = (dateStr: string) => new Date(dateStr) < new Date();



    // Preview State
    const [previewDistribution, setPreviewDistribution] = useState<Record<string, number>>({});

    // Calculate Preview when inputs change
    useEffect(() => {
        if (dispenseMode !== 'FEFO' || availableLots.length === 0) {
            setPreviewDistribution({});
            return;
        }

        const targetUnits = getQtyInUnits(manualQty);
        let remaining = targetUnits;
        const distribution: Record<string, number> = {};

        // Sort by expiry (FEFO) - assuming availableLots is already sorted but safety first
        const sortedLots = [...availableLots].sort((a, b) => new Date(a.expiry).getTime() - new Date(b.expiry).getTime());

        for (const lot of sortedLots) {
             if (remaining <= 0) break;
             
             // Calculate truly available (Stock - InCart)
             const inCart = activeReservationsForLot(lot.lot);
             const availableReal = Math.max(0, (lot.qtyUnits || lot.qty_units) - inCart);
             
             if (availableReal <= 0) continue;

             const toTake = Math.min(remaining, availableReal);
             distribution[lot.lot] = toTake;
             remaining -= toTake;
        }
        
        setPreviewDistribution(distribution);

    }, [manualQty, prepMode, dispenseMode, availableLots, cartItems]);

    const activeReservationsForLot = (lotId: string) => {
        return cartItems
            .filter(item => item.lot === lotId)
            .reduce((sum, item) => sum + item.qty_units, 0);
    };

    const handleAutoDispense = async () => {
        if (!sessionId) {
            toast.error("Session non initialisée");
            return;
        }
        
        // If Manual, we take the *input* qty from the *first* available lot? NO.
        // If Manual, user must click the specific lot button. The main "Ajouter" should be disabled or act as FEFO?
        // Current UI has "Ajouter" disabled for Manual.
        
        if (dispenseMode === 'FEFO') {
            const distribution = previewDistribution;
            const lotsToTake = Object.entries(distribution);
            
            if (lotsToTake.length === 0) {
                 toast("Stock insuffisant ou quantité invalide", { icon: '⚠️' });
                 return;
            }
            
            let successCount = 0;
            for (const [lotId, qty] of lotsToTake) {
                 const lot = availableLots.find(l => l.lot === lotId);
                 if (lot) {
                     await handleAddReservation(lot, qty);
                     successCount++;
                 }
            }
            
            if (successCount > 0) toast.success(`${successCount} lots ajoutés (FEFO)`);
        }
    };

    // Initial Data Load
    useEffect(() => {
        loadProductInfo(line.product_id);
    }, [line.product_id]);

    const loadProductInfo = async (pid: string) => {
        try {
            const p = await api.getGlobalProduct(pid); // Or catalog
            setProductName(p.name);
            setSelectedProduct(p);
        } catch (e) {
            setProductName(pid);
        }
    };

    // Load History & Lots when expanded or product changes
    useEffect(() => {
        if (expanded) {
            loadHistory();
            loadLots();
        }
    }, [expanded, selectedProductId]);

    const loadHistory = async () => {
        try {
            const data = await api.getTransferHistory(line.product_id);
            setHistory(data.map((h: any) => ({
                date: h.date,
                qty: h.qty_transferred,
                type: 'Transfert', 
                product_name: productName // or fetch if needed
            })));
        } catch (e) {
            console.error("Failed to load history", e);
        }
    };

    const loadLots = async () => {
        setLoadingLots(true);
        try {
            const inv = await api.getInventory(); 
            // Fix: API returns CamelCase (productId, qtyUnits)
            const relevant = inv.filter((i: any) => (i.productId === selectedProductId || i.product_id === selectedProductId) && (i.qtyUnits > 0 || i.qty_units > 0));
            setAvailableLots(relevant.sort((a: any, b: any) => new Date(a.expiry).getTime() - new Date(b.expiry).getTime())); 
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingLots(false);
        }
    };

    const handleSearch = async (q: string) => {
        setSubQuery(q);
        if (q.length > 2) {
             try {
                 const res = await api.getCatalog({ q, status: 'ACTIVE' });
                 setSubResults(res.data || res); // Handle paginated vs array
             } catch (e) { console.error(e); }
        }
    };

    const handleSelectSubstitution = (product: any) => {
        setSelectedProductId(product.id);
        setSelectedProduct(product);
        setProductName(product.name); // Temporary visual override
        setIsSubstituting(false);
        setSubQuery('');
        toast.success(`Substitué par: ${product.name}`);
        // Reload lots for new product
        setTimeout(loadLots, 100);
    };


    const handleAddReservation = async (lotItem: any, qty: number) => {
        if (!sessionId) {
             toast.error("Erreur Session: Rafraéchissez la page");
             return;
        }
        try {
            await api.holdStockReservation({
                session_id: sessionId,
                demand_id: demandId,
                demand_line_id: line.product_id, 
                product_id: selectedProductId,
                lot: lotItem.lot,
                expiry: lotItem.expiry,
                location_id: lotItem.location, 
                qty_units: Math.floor(qty) // Safety: Integer
            });
            refreshCart();
            // toast.success("Lot ajouté"); // Reduce noise if FEFO adds multiple
        } catch (error: any) {
            toast.error(error.message);
        }
    };
    
    const handleRemoveReservation = async (resId: string) => {
        try {
            await api.releaseStockReservation(resId);
            refreshCart();
        } catch (error) { console.error(error); }
    };

    const requested = line.qty_requested; 
    const prepared = cartItems.reduce((acc, item) => acc + item.qty_units, 0);
    const remaining = requested - prepared;
    const isComplete = remaining <= 0;
    const isOver = remaining < 0;

    return (
        <div className={`bg-white rounded-lg shadow-sm border overflow-hidden ${isComplete ? 'border-green-200' : 'border-slate-200'}`}>
            
            {/* Header (Zone A) */}
            <div 
                className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setExpanded(!expanded)}
            >
                <div>
                    <div className="font-bold text-slate-800 text-lg flex items-center gap-2">
                        {line.product_id !== selectedProductId && <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded">SUBSTITUT</span>}
                        {productName}
                    </div>
                    <div className="text-sm text-slate-500 font-mono">
                        DCI: {selectedProduct?.dci || 'N/A'} • Demandé: {line.qty_requested}
                    </div>
                </div>
                <div className="flex items-center gap-4">
                     <span className={`font-bold ${isOver ? 'text-red-500' : isComplete ? 'text-green-500' : 'text-blue-600'}`}>
                        {prepared} / {requested}
                     </span>
                     {expanded ? <ChevronDown className="text-slate-400" /> : <ChevronRight className="text-slate-400" />}
                </div>
            </div>

            {/* Expanded Body */}
            {expanded && (
                <div className="border-t border-slate-100 bg-slate-50 p-4 space-y-4">
                    
                    {/* Zone Substitution */}
                    <div className="bg-white p-3 rounded border border-slate-200">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="text-xs font-bold uppercase text-slate-500 flex items-center gap-1">
                                <RefreshCw size={12} /> Produit à Délivrer
                            </h4>
                            <button 
                                onClick={() => setIsSubstituting(!isSubstituting)}
                                className="text-xs text-blue-600 font-medium hover:underline"
                            >
                                {isSubstituting ? 'Annuler' : 'Changer / Substituer'}
                            </button>
                        </div>
                        
                        {isSubstituting ? (
                            <div className="space-y-2">
                                <input 
                                    type="text" 
                                    placeholder="Rechercher un produit de substitution..." 
                                    className="w-full p-2 text-sm border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={subQuery}
                                    onChange={(e) => handleSearch(e.target.value)}
                                    autoFocus
                                />
                                {subResults.length > 0 && (
                                    <div className="max-h-40 overflow-y-auto border rounded bg-white shadow-sm">
                                        {subResults.map(res => (
                                            <div 
                                                key={res.id} 
                                                className="p-2 text-sm hover:bg-blue-50 cursor-pointer border-b last:border-0"
                                                onClick={() => handleSelectSubstitution(res)}
                                            >
                                                <div className="font-bold">{res.name}</div>
                                                <div className="text-xs text-slate-500">{res.dci}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-sm">
                                <span className="font-medium text-slate-800">{productName}</span>
                                {line.product_id !== selectedProductId && (
                                    <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-100">
                                        Substitue le produit original
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Zone B: History */}
                    <div className="bg-white p-3 rounded border text-sm text-slate-600">
                        <div className="font-bold text-xs uppercase text-slate-400 mb-2 flex items-center gap-1">
                            <History className="w-3 h-3" /> Historique Récent
                        </div>
                        {history.length === 0 ? (
                            <div className="text-slate-400 italic text-xs py-1">Aucun historique de transfert</div>
                        ) : (
                            history.map((h, idx) => (
                                <div key={idx} className="flex justify-between py-1 border-b last:border-0 border-slate-50">
                                    <span>{new Date(h.date).toLocaleDateString()}</span>
                                    <span>{h.type}</span>
                                    <span className="font-mono">{h.qty}</span>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        {/* Zone D: Selection */}
                        <div className="bg-white p-4 rounded-lg border shadow-sm flex flex-col gap-4">
                            <div className="flex justify-between items-center">
                                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                    <Box className="w-4 h-4" /> Sélection de Lots
                                </h3>
                                {/* Mode Toggles */}
                                <div className="flex gap-2">
                                    <div className="flex bg-slate-100 rounded p-0.5">
                                        <button 
                                            onClick={() => setPrepMode('BOX')}
                                            className={`px-2 py-0.5 text-xs font-bold rounded ${prepMode === 'BOX' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
                                        >
                                            Boîte
                                        </button>
                                        <button 
                                            onClick={() => setPrepMode('UNIT')}
                                            className={`px-2 py-0.5 text-xs font-bold rounded ${prepMode === 'UNIT' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
                                        >
                                            Unité
                                        </button>
                                    </div>
                                    <div className="flex bg-slate-100 rounded p-0.5">
                                        <button 
                                            onClick={() => setDispenseMode('FEFO')}
                                            className={`px-2 py-0.5 text-xs font-bold rounded ${dispenseMode === 'FEFO' ? 'bg-white shadow text-green-600' : 'text-slate-500'}`}
                                        >
                                            FEFO
                                        </button>
                                        <button 
                                            onClick={() => setDispenseMode('MANUAL')}
                                            className={`px-2 py-0.5 text-xs font-bold rounded ${dispenseMode === 'MANUAL' ? 'bg-white shadow text-orange-600' : 'text-slate-500'}`}
                                        >
                                            Manuel
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Quantity Input Action */}
                            <div className="flex gap-2 items-center bg-slate-50 p-2 rounded">
                                <div className="flex-1">
                                    <label className="text-xs text-slate-500 font-medium block mb-1">
                                        Quantité à préparer ({prepMode === 'BOX' ? 'Boîtes' : 'Unités'})
                                    </label>
                                    <input 
                                        type="number" 
                                        min="1"
                                        className="w-full text-sm p-1 border rounded focus:ring-2 focus:ring-blue-500 outline-none font-mono font-bold"
                                        value={manualQty}
                                        onChange={(e) => setManualQty(Number(e.target.value))}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleAutoDispense();
                                        }}
                                    />
                                </div>
                                <button 
                                    onClick={handleAutoDispense}
                                    disabled={dispenseMode === 'MANUAL'} // Disable auto-add in manual mode (user must pick lot)
                                    className={`h-10 px-4 rounded font-bold text-sm shadow-sm transition-all flex items-center gap-1 mt-auto ${dispenseMode === 'MANUAL' ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                                >
                                    {loadingLots ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                                    Ajouter
                                </button>
                            </div>
                            
                            {loadingLots ? (
                                <div className="text-center py-4 text-slate-400">Chargement...</div>
                            ) : availableLots.length === 0 ? (
                                <div className="text-center py-4 text-red-400 italic">Rupture de stock</div>
                            ) : (
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {availableLots.map((lot) => {
                                        const previewQty = previewDistribution[lot.lot];
                                        return (
                                            <div key={`${lot.lot}-${lot.expiry}`} className={`flex justify-between items-center p-2 border rounded group ${previewQty ? 'bg-green-50 border-green-200 ring-1 ring-green-300' : 'hover:bg-slate-50'}`}>
                                                <div>
                                                    <div className="font-mono text-sm font-bold text-slate-800 flex items-center gap-2">
                                                        Lot #{lot.lot}
                                                        {isLotExpired(lot.expiry) && <span className="text-xs bg-red-100 text-red-600 px-1 rounded">Exp</span>}
                                                    </div>
                                                    <div className="text-xs text-slate-500">
                                                        Exp: {new Date(lot.expiry).toLocaleDateString()} • Stock: {formatQty(lot.qtyUnits || lot.qty_units)}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="text-sm font-medium text-slate-600">
                                                        {formatQty(lot.qtyUnits || lot.qty_units)}
                                                        <span className="text-xs text-slate-400 ml-1">({lot.location})</span>
                                                    </div>
                                                    
                                                    {/* Preview Badge */}
                                                    {previewQty && (
                                                        <span className="bg-green-600 text-white text-xs font-bold px-2 py-1 rounded shadow-sm animate-pulse">
                                                            + {formatQty(previewQty)}
                                                        </span>
                                                    )}

                                                    {dispenseMode === 'MANUAL' && (
                                                        <button 
                                                            onClick={() => handleAddReservation(lot, getQtyInUnits(manualQty))} 
                                                            className="bg-orange-100 text-orange-700 border border-orange-200 px-2 py-1 rounded text-xs hover:bg-orange-200 transition font-medium"
                                                        >
                                                            {prepMode === 'BOX' ? `Prendre ${manualQty} Bts` : `Prendre ${manualQty} U`}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Zone E: Cart for this line */}
                        <div className="bg-white p-4 rounded-lg border shadow-sm flex flex-col">
                            <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                                <Package className="w-4 h-4" /> Panier (Préparation)
                            </h3>
                            
                            {cartItems.length === 0 ? (
                                <div className="flex-1 flex flex-col justify-center items-center text-slate-300 italic min-h-[100px]">
                                    <Package className="w-8 h-8 mb-2 opacity-50" />
                                    Aucun lot sélectionné
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {cartItems.map(item => (
                                        <div key={item.reservation_id} className="flex justify-between items-center p-2 bg-indigo-50 border border-indigo-100 rounded">
                                            <div>
                                                <div className="font-mono text-xs font-bold text-indigo-900">Lot #{item.lot}</div>
                                                <div className="text-xs text-indigo-600 text-nowrap">Exp: {new Date(item.expiry).toLocaleDateString()}</div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="font-bold text-indigo-800">{formatQty(item.qty_units)}</span>
                                                <button 
                                                    onClick={() => handleRemoveReservation(item.reservation_id)}
                                                    className="text-red-400 hover:text-red-600"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    
                                    <div className="pt-3 mt-3 border-t flex justify-between font-bold text-slate-800">
                                        <span>Total:</span>
                                        <span>{prepared}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
};

export default DemandLineBlock;
