
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Search, Plus, Trash2, Send, Package, AlertCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';

// --- Fuzzy Logic Helpers ---

const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

const levenshtein = (a: string, b: string): number => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
};

const isFuzzyMatch = (item: any, query: string): boolean => {
    if (!query) return true;
    const normQuery = normalize(query);
    const queryTokens = normQuery.split(/\d+/).filter(t => t.length > 2); // Split by numbers to separate text tokens? Or just use raw query?
    // Simplify: Just use raw normalized query if short, or tokenize if spaces found.
    // User said "ignore spaces". So "doliprane 1000" -> "doliprane1000".
    
    // Fields to search
    const fields = [
        item.productName || '',
        item.sahtyCode || '',
        item.lot || '',
        // Add code if available in stockList item structure
    ];

    const normFields = fields.map(normalize);

    // 1. Exact Substring Match (relaxed)
    if (normFields.some(f => f.includes(normQuery))) return true;

    // 2. Token Matching (Spelling errors)
    // If query is short (<3 chars), strict match required (already checked above).
    if (normQuery.length < 3) return false;

    // Check Levenshtein on tokens
    // Split item name into tokens
    for (const rawField of fields) {
        const tokens = rawField.toLowerCase().split(/[\s-]+/);
        for (const token of tokens) {
            const normToken = normalize(token);
            // Allow distance relative to length. e.g. 1 error for 4 chars, 2 for >6 chars.
            const dist = levenshtein(normQuery, normToken);
            const tolerance = normQuery.length > 6 ? 3 : (normQuery.length > 4 ? 2 : 1);
            if (dist <= tolerance) return true;
        }
    }

    return false;
};

// --- Component ---

interface NewReturnTabProps {
    services: any[];
    selectedServiceId: string;
    onServiceChange: (id: string) => void;
}

const NewReturnTab: React.FC<NewReturnTabProps> = ({ services, selectedServiceId, onServiceChange }) => {
    const { user } = useAuth();
    
    // Search State
    const [inputValue, setInputValue] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    
    const [stockList, setStockList] = useState<any[]>([]);
    const [loadingStock, setLoadingStock] = useState(false);
    
    const [basket, setBasket] = useState<any[]>([]);
    const [basketHeader, setBasketHeader] = useState<any>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const [inputQtys, setInputQtys] = useState<Record<string, number>>({});
    const [returnQuarantineId, setReturnQuarantineId] = useState<string | null>(null);

    // Session Management
    const sessionId = useMemo(() => {
        const key = `return_session_${user?.id}_${selectedServiceId}`;
        const stored = localStorage.getItem(key);
        if (stored) return stored;
        const newId = uuidv4();
        localStorage.setItem(key, newId);
        return newId;
    }, [user?.id, selectedServiceId]);

    // Load Service Stock
    useEffect(() => {
        if (!selectedServiceId) return;
        loadStock();
        loadBasket();
    }, [selectedServiceId, refreshTrigger]);

    const loadStock = async () => {
        setLoadingStock(true);
        try {
            console.log('[NewReturnTab] Loading stock for service:', selectedServiceId);
            const data = await api.getServiceStock(selectedServiceId);
            console.log('[NewReturnTab] Loaded stock items:', data?.length, data?.[0]);
            setStockList(data || []);
        } catch (error) {
            console.error(error);
            toast.error('Erreur chargement stock');
        } finally {
            setLoadingStock(false);
        }
    };

    const loadBasket = async () => {
        try {
            const cart = await api.getStockReservationCart(sessionId);
            if (cart) {
                setBasketHeader(cart.header);
                setBasket(cart.lines || []);
            } else {
                setBasket([]);
                setBasketHeader(null);
            }
        } catch (error) {
            console.error("Error loading basket", error);
        }
    };

    // Load Return Quarantine Location
    useEffect(() => {
        const fetchQuarantine = async () => {
            try {
                const loc = await api.getReturnQuarantineLocation();
                if (loc) {
                    setReturnQuarantineId(loc.location_id);
                } else {
                    console.error('[NewReturnTab] RETURN_QUARANTINE location not found');
                }
            } catch (err) {
                console.error('[NewReturnTab] Error loading quarantine location', err);
            }
        };
        fetchQuarantine();
    }, []);

    // Filter Logic
    const filteredStock = useMemo(() => {
        if (!searchTerm) return []; // Only show results if search term exists
        return stockList.filter(item => isFuzzyMatch(item, searchTerm));
    }, [searchTerm, stockList]);

    // Search Handlers
    const handleSearchClick = () => {
        console.log('[NewReturnTab] Search triggered with input:', inputValue);
        if (!inputValue.trim()) {
            setSearchTerm('');
            return;
        }
        setSearchTerm(inputValue);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearchClick();
        }
    };

    const handleReset = () => {
        setInputValue('');
        setSearchTerm('');
    };

    // Available Qty Helper
    const getAvailable = (item: any) => {
        const qty = item.qtyUnits || 0;
        const reserved = item.reservedUnits || 0;
        const pending = item.pendingReturnUnits || 0;
        return Math.max(0, qty - reserved - pending);
    };

    // Basket Handlers
    const handleAddToBasket = async (item: any) => {
        const key = `${item.productId}_${item.lot}`;
        const qty = inputQtys[key];

        if (!qty || qty <= 0) {
            toast.error('Veuillez saisir une quantité');
            return;
        }
        const avail = getAvailable(item);
        if (qty > avail) {
            toast.error(`Quantité insuffisante (Dispo: ${avail})`);
            return;
        }

        try {
            await api.holdStockReservation({
                session_id: sessionId,
                user_id: user?.id,
                product_id: item.productId,
                lot: item.lot,
                expiry: item.expiry,
                qty_units: qty,
                source_location_id: item.location,
                destination_location_id: returnQuarantineId
            });
            
            toast.success('Ajouté au panier');
            setInputQtys({ ...inputQtys, [key]: 0 });
            setRefreshTrigger(prev => prev + 1);
        } catch (error: any) {
            toast.error(error.message || "Erreur lors de l'ajout");
        }
    };

    const handleRemoveFromBasket = async (lineId: string) => {
        try {
            await api.releaseStockReservation(lineId);
            setRefreshTrigger(prev => prev + 1);
            toast.success('Retiré du panier');
        } catch (error) {
            console.error(error);
            toast.error('Erreur suppression');
        }
    };

    const handleCreateReturn = async () => {
        if (!basketHeader || basket.length === 0 || !selectedServiceId) return;
        if (!confirm('Confirmer la création du retour ?')) return;

        try {
            await api.createReturn({
                serviceId: selectedServiceId,
                reservationId: basketHeader.reservation_id
            });
            toast.success('Retour créé avec succès !');
            const key = `return_session_${user?.id}_${selectedServiceId}`;
            localStorage.removeItem(key);
            setRefreshTrigger(prev => prev + 1);
        } catch (error: any) {
            toast.error(error.message || 'Erreur création retour');
        }
    };

    const getBasketItemName = (productId: string) => {
        const found = stockList.find(s => s.productId === productId);
        return found ? found.productName : 'Produit Inconnu';
    };

    const groupedBasket = useMemo(() => {
        const groups: Record<string, any[]> = {};
        basket.forEach(item => {
            if (!groups[item.product_id]) groups[item.product_id] = [];
            groups[item.product_id].push(item);
        });
        return groups;
    }, [basket]);


    return (
        <div className="flex flex-col gap-6">
            <div className="w-full md:w-1/3">
                <label className="block text-sm font-medium text-slate-700 mb-1">Service</label>
                <div className="max-w-xs">
                    <select 
                        value={selectedServiceId}
                        onChange={(e) => onServiceChange(e.target.value)}
                        className="w-full p-2.5 bg-slate-200 border-none rounded-lg font-semibold text-slate-700"
                    >
                        {services.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8 min-h-[500px]">
                {/* LEFT: Search */}
                <div className="flex-1 flex flex-col gap-4 bg-blue-50 p-4 rounded-xl">
                     <div className="relative flex items-center gap-2">
                        <div className="relative flex-1">
                            <input 
                                type="text"
                                placeholder="Nom, code, lot... (+ ENTREE)"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="w-full pl-4 pr-10 py-3 bg-slate-200 border-none rounded-lg focus:ring-2 focus:ring-indigo-500 placeholder-slate-500"
                            />
                            {/* Inner Reset Button if text exists */}
                            {inputValue && (
                                <button 
                                    onClick={handleReset} 
                                    className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600"
                                >
                                    <X size={20} />
                                </button>
                            )}
                        </div>
                        
                        <button 
                            onClick={handleSearchClick}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-lg transition-colors"
                        >
                            <Search size={20} />
                        </button>
                    </div>

                    <div className="flex-1 space-y-4">
                        {loadingStock && <div className="text-center p-4 text-slate-500">Chargement...</div>}
                        
                        {!loadingStock && searchTerm && filteredStock.length === 0 && (
                            <div className="text-center p-8 bg-white rounded-xl border border-dashed border-slate-300">
                                <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                <p className="text-slate-500">Aucun produit trouvé pour "{searchTerm}"</p>
                            </div>
                        )}
                        
                        {!loadingStock && !searchTerm && stockList.length > 0 && (
                            <div className="text-center p-8 text-slate-400 italic">
                                Appuyez sur <span className="font-bold">Entrée</span> ou le bouton <Search className="inline w-4 h-4" /> pour lancer la recherche
                            </div>
                        )}

                        {filteredStock.length > 0 && (() => {
                            // Group by location
                            const groupedByLocation = filteredStock.reduce((acc, item) => {
                                const locName = item.locationName || 'Emplacement Inconnu';
                                if (!acc[locName]) acc[locName] = [];
                                acc[locName].push(item);
                                return acc;
                            }, {} as Record<string, any[]>);

                            return Object.entries(groupedByLocation).map(([locName, items]) => (
                                <div key={locName} className="space-y-3">
                                    <div className="flex items-center gap-2 text-slate-500 font-bold uppercase text-xs tracking-wider border-b border-slate-200 pb-1">
                                        <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                        {locName}
                                    </div>
                                    <div className="grid gap-4">
                                        {items.map(item => {
                                            const avail = getAvailable(item);
                                            const key = `${item.productId}_${item.lot}`;
                                            const qtyVal = inputQtys[key] || '';

                                            return (
                                                <div key={key} className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div>
                                                            <h3 className="font-bold text-slate-800">{item.productName}</h3>
                                                            <div className="flex gap-2 text-xs text-slate-500 mt-1">
                                                                {(item.therapeuticClass || item.sahtyCode) && (
                                                                    <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-medium border border-slate-200">
                                                                        {item.therapeuticClass || item.sahtyCode}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="bg-slate-50 rounded-lg p-3 mt-3 border border-slate-100">
                                                        <div className="flex justify-between items-center text-sm font-mono mb-2">
                                                            <span className="font-bold text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200">LOT#{item.lot}</span>
                                                            <span className={`text-xs font-semibold ${new Date(item.expiry) < new Date() ? 'text-red-500' : 'text-slate-500'}`}>
                                                                EXP:{new Date(item.expiry).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between items-center mb-3">
                                                            <span className="text-sm font-medium text-slate-600">
                                                                Disponible: <span className="text-emerald-600 font-bold">{avail}</span> <span className="text-[10px] uppercase text-slate-400">UNITÉS</span>
                                                            </span>
                                                        </div>
                                                        
                                                        <div className="flex gap-2 items-center">
                                                            <input 
                                                                type="number" 
                                                                min="1"
                                                                max={avail}
                                                                placeholder="Qté"
                                                                value={qtyVal}
                                                                onChange={(e) => setInputQtys({ ...inputQtys, [key]: parseInt(e.target.value) || 0 })}
                                                                className="w-20 p-2 border border-slate-300 rounded-lg text-center font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                            />
                                                            <button 
                                                                onClick={() => handleAddToBasket(item)}
                                                                disabled={avail === 0}
                                                                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase shadow-sm"
                                                            >
                                                                Ajouter
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>
                </div>


                {/* RIGHT: Basket */}
                <div className="w-full lg:w-96 flex flex-col">
                    <div className="bg-slate-200 rounded-t-xl p-3 font-bold text-slate-700">
                        PANIER
                    </div>
                    <div className="bg-slate-200 bg-opacity-50 flex-1 p-4 rounded-b-xl space-y-4">
                        {basket.length === 0 ? (
                            <div className="text-center py-10 text-slate-500 italic">
                                Le panier est vide
                            </div>
                        ) : (
                            Object.entries(groupedBasket).map(([prodId, items]) => (
                                <div key={prodId} className="bg-white rounded-lg p-3 shadow-sm">
                                    <div className="font-bold text-slate-800 text-sm mb-2 pb-2 border-b">
                                        {getBasketItemName(prodId)}
                                    </div>
                                    <div className="space-y-2">
                                        {items.map((line, idx) => (
                                            <div key={line.id} className="flex justify-between items-center bg-slate-50 rounded p-2 text-xs">
                                                <div className="font-mono font-medium text-slate-700">
                                                    LOT#{line.lot}
                                                </div>
                                                <div className="text-slate-600 font-medium">
                                                    {line.qty_units} UTES
                                                </div>
                                                <button 
                                                    onClick={() => handleRemoveFromBasket(line.id)}
                                                    className="text-red-400 hover:text-red-600"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="mt-4 p-4 bg-indigo-900 rounded-xl">
                        <button 
                            onClick={handleCreateReturn}
                            disabled={basket.length === 0}
                            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg uppercase tracking-wide transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            CRER RETOUR
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NewReturnTab;
