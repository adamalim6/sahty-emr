import React, { useState, useEffect, useRef } from 'react';
import { Box, LayoutGrid, AlertTriangle, Check, History, Search, Scan, RefreshCw, X, Package } from 'lucide-react';
import { ReplenishmentRequest, InventoryItem, ProductDefinition, StockLocation, PackStatus } from '../../types/pharmacy';
import { api } from '../../services/api';

interface ReplenishmentItemCardProps {
    item: ReplenishmentRequest['items'][0];
    request: ReplenishmentRequest;
    inventory: InventoryItem[];
    catalog: ProductDefinition[];
    locations: StockLocation[];
    packs?: any[]; // SerializedPack[]
    looseUnits?: any[]; // LooseUnitItem[]
    onDispense: (data: any) => Promise<void>;
}

export const ReplenishmentItemCard: React.FC<ReplenishmentItemCardProps> = ({
    item, request, inventory, catalog, locations, packs = [], looseUnits = [], onDispense
}) => {
    // 1. Dispensation State
    const [substitutedProductId, setSubstitutedProductId] = useState<string | undefined>(undefined);
    const [unitType, setUnitType] = useState<'BOX' | 'UNIT'>('BOX');
    const [selectionMode, setSelectionMode] = useState<'FEFO' | 'MANUAL' | 'SCAN'>('FEFO');
    const [quantityToAdd, setQuantityToAdd] = useState<number>(0);
    const [selectedBatches, setSelectedBatches] = useState<{ 
        batchNumber: string; 
        quantity: number; 
        expiryDate: string; 
        locationId: string;
        productId?: string;
        productName?: string;
    }[]>([]);
    const [isDispensing, setIsDispensing] = useState(false);
    
    // Scan Mode State
    const [scannedPacks, setScannedPacks] = useState<{ 
        serializedPackId: string; 
        batchNumber: string; 
        expiryDate: string; 
        locationId?: string 
    }[]>([]);
    const scanInputRef = useRef<HTMLInputElement>(null);
    
    // Search State (Zone C)
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<ProductDefinition[]>([]);
    const [showSearch, setShowSearch] = useState(false);

    // Derived Data
    console.log('[DEBUG] ItemCard item:', item);
    const activeProductId = substitutedProductId || item.productId;
    const activeProduct = catalog.find(p => p.id === activeProductId);
    const requestedProduct = catalog.find(p => p.id === item.productId);

    // Filter Inventory for Active Product (Strict Pharmacy Scope for display total)
    // We keep using inventory for FEFO logic as it's the current working model
    const availableStock = inventory
        .filter(i => i.productId === activeProductId && !i.serviceId && i.theoreticalQty > 0)
        .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()); // FEFO sort

    // Detailed Stock Calculation for Header
    // We use the passed packs/looseUnits if available, falling back to simple inventory math if not
    
    // Filter for Pharmacy Locations only
    // Robustness: Some packs might store location Name instead of ID due to legacy/bug
    const pharmacyLocations = locations.filter(l => l.scope === 'PHARMACY' || !l.scope);
    const pharmacyLocationIds = pharmacyLocations.map(l => l.id);
    const pharmacyLocationNames = pharmacyLocations.map(l => l.name);

    const activePacks = packs.filter(p => 
        p.productId === activeProductId && 
        [PackStatus.SEALED, PackStatus.OPENED].includes(p.status) &&
        (pharmacyLocationIds.includes(p.locationId) || pharmacyLocationNames.includes(p.locationId))
    );
    const activeLoose = looseUnits.filter(u => 
        u.productId === activeProductId &&
        (pharmacyLocationIds.includes(u.locationId) || pharmacyLocationNames.includes(u.locationId))
    );

    const sealedCount = activePacks.filter(p => p.status === PackStatus.SEALED).length;
    const openCount = activePacks.filter(p => p.status === PackStatus.OPENED).length;
    // For open boxes, they contribute to total units but are displayed as "Boîtes ouvertes"
    const unitsInOpen = activePacks.filter(p => p.status === PackStatus.OPENED).reduce((acc, p) => acc + (p.remainingUnits || 0), 0);
    const looseCount = activeLoose.reduce((acc, u) => acc + u.quantity, 0);

    const useDetailedDisplay = packs.length > 0;
    
    // If we have detailed packs, use them for total. Else fallback to inventory sum.
    const totalStockUnits = useDetailedDisplay 
        ? (sealedCount * (activeProduct?.unitsPerPack || 1)) + unitsInOpen + looseCount
        : availableStock.reduce((acc, i) => acc + i.theoreticalQty, 0);

    // Focus Management for Scan Mode
    useEffect(() => {
        if (selectionMode === 'SCAN' && scanInputRef.current) {
            scanInputRef.current.focus();
            const interval = setInterval(() => {
                if (document.activeElement !== scanInputRef.current && document.activeElement?.tagName !== 'INPUT') {
                    scanInputRef.current?.focus();
                }
            }, 500);
            return () => clearInterval(interval);
        }
    }, [selectionMode]);

    // 2a. Auto-Calculate FEFO Batches (FEFO Mode only)
    useEffect(() => {
        // Force FEFO if Unit Type is UNIT
        if (unitType === 'UNIT' && (selectionMode === 'MANUAL' || selectionMode === 'SCAN')) {
            setSelectionMode('FEFO');
        }

        if (selectionMode === 'FEFO' && quantityToAdd > 0) {
            let targetUnits = quantityToAdd;
            if (unitType === 'BOX' && activeProduct?.unitsPerPack) {
                targetUnits *= activeProduct.unitsPerPack;
            }

            const batchesToPick: typeof selectedBatches = [];
            let remaining = targetUnits;

            for (const batch of availableStock) {
                if (remaining <= 0) break;
                const pick = Math.min(batch.theoreticalQty, remaining);
                batchesToPick.push({
                    batchNumber: batch.batchNumber,
                    quantity: pick,
                    expiryDate: batch.expiryDate,
                    locationId: batch.location,
                    productId: activeProduct?.id,
                    productName: activeProduct?.name
                });
                remaining -= pick;
            }
            setSelectedBatches(batchesToPick);
        } else if (selectionMode === 'FEFO' && quantityToAdd === 0) {
            setSelectedBatches([]);
        }
    }, [quantityToAdd, unitType, selectionMode, activeProductId, activeProduct]); 

    // 2b. Sync Scanned Packs to Selected Batches (SCAN Mode only)
    useEffect(() => {
        if (selectionMode === 'SCAN') {
            const aggregated: typeof selectedBatches = [];
            scannedPacks.forEach(pack => {
                const existing = aggregated.find(b => b.batchNumber === pack.batchNumber && b.locationId === pack.locationId);
                // Scanned packs are assumed to be BOXES in standard logic
                const quantityUnits = activeProduct?.unitsPerPack || 1;

                if (existing) {
                    existing.quantity += quantityUnits;
                } else {
                    aggregated.push({
                        batchNumber: pack.batchNumber,
                        quantity: quantityUnits,
                        expiryDate: pack.expiryDate,
                        locationId: pack.locationId || '',
                        productId: activeProduct?.id,
                        productName: activeProduct?.name
                    });
                }
            });
            setSelectedBatches(aggregated);
        }
    }, [scannedPacks, selectionMode, activeProduct]);

    // Handle Scan Input
    const handleScanInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            const raw = e.currentTarget.value;
            e.currentTarget.value = ''; // Clear immediately
            console.log("[SCAN DEBUG] Raw Input:", raw);

            try {
                // 1. Sanitize AZERTY <-> QWERTY char mappings of internal content
                // ! -> _
                // § -> -
                let sanitized = raw.replace(/!/g, '_').replace(/§/g, '-');
                
                // 2. Core Extraction Strategy
                // Instead of trying to fix the braces, we assume the content is wrapped in garbage.
                // We locate the first and last `"` (double quote) which marks the start of the first key
                // and the end of the last value (since last value is string "serialized_pack_id").
                
                const firstQuoteIdx = sanitized.indexOf('"');
                const lastQuoteIdx = sanitized.lastIndexOf('"');
                
                let jsonString = sanitized;

                if (firstQuoteIdx !== -1 && lastQuoteIdx !== -1 && lastQuoteIdx > firstQuoteIdx) {
                    // Extract everything between first and last quote inclusive
                    const coreContent = sanitized.substring(firstQuoteIdx, lastQuoteIdx + 1);
                    // Wrap in braces to form valid object
                    jsonString = `{${coreContent}}`;
                    console.log("[SCAN DEBUG] Extracted Core:", jsonString);
                } else {
                    console.warn("[SCAN DEBUG] Quotes not found or invalid range. Attempting raw parse.");
                    // Fallback to raw/sanitized if regex fails (e.g. numeric last value?)
                    // But our payload allows this strategy.
                }

                let data;
                try {
                    data = JSON.parse(jsonString);
                } catch (jsonErr) {
                     // Last ditch effort: Try to parse original sanitized 
                     try {
                        data = JSON.parse(sanitized);
                     } catch {
                         console.error("[SCAN DEBUG] JSON Parse Fail:", jsonErr);
                         alert(`Erreur de lecture: Données non reconnues.\n${sanitized}`);
                         return;
                     }
                }
                
                // Normalization
                const productId = data.product_id || data.productId || data["product!id"];
                const packId = data.serialized_pack_id || data.serializedPackId || data["serialized!pack!id"];
                const batchNum = data.batch_number || data.batchNumber || data["batch!number"];
                const expiry = data.expiry_date || data.expiryDate || data["expiry!date"];

                if (!productId || !packId || !batchNum) {
                     console.warn("Missing fields in:", data);
                     alert("Données QR incomplètes (champs manquants).");
                     return;
                }

                // 1. Validation
                if (productId !== activeProductId) {
                    console.warn("Product Mismatch", productId, activeProductId);
                    alert(`Produit incorrect ! Attendu: ${activeProduct?.name}`);
                    return;
                }

                if (scannedPacks.find(p => p.serializedPackId === packId)) {
                    alert("Ce pack a déjà été scanné !");
                    return;
                }

                // 2. Find internal location for this batch to assist (Optional)
                const stockBatch = availableStock.find(b => b.batchNumber === batchNum);
                
                setScannedPacks(prev => [...prev, {
                    serializedPackId: packId,
                    batchNumber: batchNum,
                    expiryDate: expiry,
                    locationId: stockBatch?.location
                }]);

            } catch (err) {
                console.error("Scan Logic Error", err);
                alert("Erreur de traitement du scan");
            }
        }
    };

    const handleRemoveScannedPack = (packId: string) => {
        setScannedPacks(prev => prev.filter(p => p.serializedPackId !== packId));
    };

    // Error State
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Clear error when user changes inputs
    useEffect(() => {
        if (errorMessage) setErrorMessage(null);
    }, [selectedBatches, quantityToAdd, unitType]);

    // 3. Handle Dispense Action
    const handleDispenseClick = async () => {
        const totalQty = selectedBatches.reduce((a, b) => a + b.quantity, 0);
        if (totalQty <= 0) return;
        
        setIsDispensing(true);
        setErrorMessage(null); // Clear previous errors

        try {
            await onDispense({
                requestId: request.id,
                itemProductId: item.productId,
                dispensedProductId: activeProductId,
                quantity: totalQty,
                batches: selectedBatches,
                unitType,
                targetLocationId: item.targetLocationId // EXPLICITLY pass destination
            });
            // Reset Form on Success
            setQuantityToAdd(0);
            setSelectedBatches([]);
            setScannedPacks([]);
            setSelectionMode('FEFO'); // Reset mode
        } catch (error: any) {
            console.error("Dispense Error", error);
            // Extract Error Message
            let msg = "Erreur inconnue lors de la dispensation.";
            if (error instanceof Error) msg = error.message;
            if (typeof error === 'string') msg = error;
            
            setErrorMessage(msg);
            // Do NOT use alert()
        } finally {
            setIsDispensing(false);
        }
    };

    // 4. Render
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6 flex flex-col lg:flex-row">
            
            {/* ZONE A: REQUEST INFO (Top/Left) */}
            <div className="lg:w-1/4 p-6 border-b lg:border-b-0 lg:border-r border-slate-100 bg-slate-50/50">
                <div className="mb-4">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Produit Demandé</span>
                    <h3 className="font-bold text-lg text-slate-800 mt-1">{item.productName}</h3>
                    <p className="text-sm text-slate-500">{requestedProduct?.therapeuticClass || 'N/A'}</p>
                </div>
                
                <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500">Quantité Demandée:</span>
                        <span className="font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                            {item.quantityRequested || (item as any).quantity || 0} {(item as any).unitType === 'BOX' ? 'Boîtes' : 'Unités'}
                        </span>
                    </div>

                    {item.targetLocationId && (
                        <div className="flex justify-between items-center text-sm pt-1">
                           <span className="text-slate-500">Emplacement Dest.:</span>
                           <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-xs">
                               {locations.find(l => l.id === item.targetLocationId)?.name || item.targetLocationId}
                           </span>
                        </div>
                    )}

                </div>

                <div className="mt-6 pt-6 border-t border-slate-200">
                     <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Produits Dispensés</span>
                     <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                        {item.dispensedBatches && item.dispensedBatches.length > 0 ? (
                            item.dispensedBatches.map((batch, idx) => (
                                <div key={idx} className="bg-white p-2 rounded border border-slate-200 text-xs">
                                    <div className="mb-1 pb-1 border-b border-slate-100">
                                        <div className="font-bold text-slate-800 leading-tight">
                                            {(batch as any).productName || item.productDispensedName || item.productName}
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-mono">
                                            {(batch as any).productId || item.productDispensedId || item.productId}
                                        </div>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="font-mono font-bold text-slate-700">{batch.batchNumber}</span>
                                        <span className="text-emerald-600 font-medium">
                                            {(() => {
                                                const isBox = activeProduct?.unitsPerPack && activeProduct.unitsPerPack > 1 && batch.quantity % activeProduct.unitsPerPack === 0;
                                                if (isBox && activeProduct?.unitsPerPack) {
                                                    return `+${batch.quantity / activeProduct.unitsPerPack} btes`;
                                                }
                                                return `+${batch.quantity} utes`;
                                            })()}
                                        </span>
                                    </div>
                                    <div className="text-slate-400 text-[10px] mt-0.5">{new Date(batch.expiryDate).toLocaleDateString()}</div>
                                </div>
                            ))
                        ) : (
                            <p className="text-xs text-slate-400 italic">Aucune dispensation dans cette session.</p>
                        )}
                     </div>
                </div>
            </div>

            {/* ZONE C: DISPENSATION PANEL (Main Content) */}
            <div className="flex-1 p-6">
                 {/* Search / Substitution Header */}
                 <div className="flex items-center justify-between mb-6">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                        <input 
                            type="text" 
                            placeholder="Rechercher produit à dispenser..." 
                            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            value={searchTerm || (activeProductId === item.productId ? '' : activeProduct?.name)}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setShowSearch(true);
                                // Simple search logic
                                if (e.target.value.length > 1) {
                                    setSearchResults(catalog.filter(p => p.name.toLowerCase().includes(e.target.value.toLowerCase())).slice(0, 5));
                                } else {
                                    setSearchResults([]);
                                }
                            }}
                            onFocus={() => setShowSearch(true)}
                            onBlur={() => setTimeout(() => setShowSearch(false), 200)}
                        />
                        {/* Search Results Dropdown */}
                        {showSearch && searchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-xl mt-1 z-50">
                                {searchResults.map(res => (
                                    <button 
                                        key={res.id}
                                        className="w-full text-left px-4 py-3 hover:bg-slate-50 text-sm border-b border-slate-100 last:border-0"
                                        onMouseDown={() => {
                                            setSubstitutedProductId(res.id);
                                            setSearchTerm(''); // Clear term to show selected name via placeholder logic or reset
                                        }}
                                    >
                                        <div className="font-medium">{res.name}</div>
                                        <div className="text-slate-400 text-xs">{res.therapeuticClass}</div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    {substitutedProductId && (
                         <button 
                            onClick={() => setSubstitutedProductId(undefined)}
                            className="ml-4 flex items-center text-amber-600 text-sm hover:underline"
                        >
                            <RefreshCw className="h-4 w-4 mr-1" /> Rétablir Original
                         </button>
                    )}
                 </div>

                 {/* Product Context */}
                 <div className={`mb-6 p-4 rounded-lg flex justify-between items-center ${substitutedProductId ? 'bg-amber-50 border border-amber-200' : 'bg-blue-50 border border-blue-100'}`}>
                    <div>
                        <div className="text-xs font-bold uppercase opacity-60 mb-1">{substitutedProductId ? 'Produit de Substitution' : 'Même que demandé'}</div>
                        <h4 className="font-bold text-lg">{activeProduct?.name}</h4>
                        <div className="text-sm opacity-80 mt-1 flex flex-col space-y-1">
                            {activeProduct?.unitsPerPack && activeProduct.unitsPerPack > 1 ? (
                                <>
                                    <div className="flex items-center space-x-2">
                                        <span className="w-4 h-4 rounded bg-emerald-100 flex items-center justify-center text-[10px] text-emerald-700 font-bold">B</span>
                                        <span>Boîtes scellées: <span className="font-bold">{useDetailedDisplay ? sealedCount : Math.floor(totalStockUnits / activeProduct.unitsPerPack)}</span></span>
                                    </div>
                                    
                                    {useDetailedDisplay && (
                                        <div className="flex items-center space-x-2">
                                            <span className="w-4 h-4 rounded bg-amber-100 flex items-center justify-center text-[10px] text-amber-700 font-bold">O</span>
                                            <span>Boîtes ouvertes: <span className="font-bold">{openCount}</span></span>
                                        </div>
                                    )}

                                    <div className="flex items-center space-x-2">
                                        <span className="w-4 h-4 rounded bg-blue-100 flex items-center justify-center text-[10px] text-blue-700 font-bold">U</span>
                                        <span>Unités en vrac: <span className="font-bold">{useDetailedDisplay ? looseCount : totalStockUnits % activeProduct.unitsPerPack}</span></span>
                                    </div>
                                    <div className="flex items-center space-x-2 pt-1 border-t border-blue-200/50 mt-1">
                                         <span className="font-medium text-xs uppercase tracking-wide opacity-70">Total:</span> 
                                         <span className="font-bold">{totalStockUnits} unités</span>
                                    </div>
                                </>
                            ) : (
                                <div>Dispo: <span className="font-bold">{totalStockUnits} unités</span></div>
                            )}
                        </div>
                    </div>
                    {substitutedProductId && <AlertTriangle className="text-amber-500 h-6 w-6" />}
                 </div>

                 {errorMessage && (
                    <div className="mb-6 p-4 bg-red-100 border-2 border-red-500 text-red-700 rounded-lg flex items-start animate-pulse">
                        <AlertTriangle className="h-6 w-6 mr-3 flex-shrink-0" />
                        <div>
                            <h4 className="font-bold uppercase text-xs mb-1">Échec de la transaction</h4>
                            <p className="font-bold text-sm">{errorMessage}</p>
                        </div>
                    </div>
                 )}

                 {/* Dispensation Controls */}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     
                     {/* LEFT: Inputs */}
                     <div className="space-y-6">
                        {/* 1. Unit Type */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Unité de Dispensation</label>
                            <div className="flex bg-slate-100 p-1 rounded-lg w-full">
                                <button
                                    className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${unitType === 'BOX' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    onClick={() => setUnitType('BOX')}
                                >
                                    <Box className="inline h-4 w-4 mr-2" /> Boîtes
                                </button>
                                <button
                                    className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${unitType === 'UNIT' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    onClick={() => setUnitType('UNIT')}
                                    disabled={!activeProduct?.isSubdivisable}
                                >
                                    <LayoutGrid className="inline h-4 w-4 mr-2" /> Unités
                                </button>
                            </div>
                        </div>

                        {/* 2. Selection Mode */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Mode de Sélection</label>
                            <div className="flex bg-slate-100 p-1 rounded-lg w-full">
                                <button
                                    className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${selectionMode === 'FEFO' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    onClick={() => setSelectionMode('FEFO')}
                                >
                                    Auto (FEFO)
                                </button>
                                <button
                                    className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${selectionMode === 'MANUAL' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'} ${unitType === 'UNIT' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    onClick={() => setSelectionMode('MANUAL')}
                                    disabled={unitType === 'UNIT'}
                                    title={unitType === 'UNIT' ? "Indisponible en mode Unités" : ""}
                                >
                                    Manuel
                                </button>
                                <button
                                    className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${selectionMode === 'SCAN' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'} ${unitType === 'UNIT' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    onClick={() => setSelectionMode('SCAN')}
                                    disabled={unitType === 'UNIT'}
                                    title={unitType === 'UNIT' ? "Indisponible en mode Unités" : ""}
                                >
                                    <Scan className="inline h-4 w-4 mr-2" /> Scan
                                </button>
                            </div>
                        </div>

                        {/* 3. Quantity Input / Scanner Area */}
                        {selectionMode === 'SCAN' ? (
                            <div className="relative">
                                {/* Hidden Input for Scanner */}
                                <input
                                    ref={scanInputRef}
                                    type="text"
                                    className="absolute opacity-0 w-1 h-1 overflow-hidden"
                                    onKeyDown={handleScanInput}
                                    autoFocus
                                    onBlur={() => {
                                        // Optional: Visual indication that focus is lost
                                    }}
                                />
                                
                                <div className="bg-slate-900 rounded-xl p-6 text-center text-white relative overflow-hidden group mb-4">
                                    <div className="absolute inset-0 bg-blue-500/10 animate-pulse pointer-events-none"></div>
                                    <Scan className="h-10 w-10 mx-auto text-blue-400 mb-2" />
                                    <h5 className="font-bold text-lg mb-1">Mode Scan Actif</h5>
                                    
                                    {/* Focus trigger for mouse users */}
                                    <button 
                                        className="absolute inset-0 w-full h-full cursor-text"
                                        onClick={() => scanInputRef.current?.focus()}
                                        title="Cliquez pour scanner"
                                    ></button>
                                </div>

                                {/* Scanned Items List */}
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {scannedPacks.length > 0 ? (
                                        <>
                                            <div className="flex justify-between items-center px-1">
                                                <label className="text-xs font-bold text-slate-500 uppercase">Boîtes Scannées</label>
                                                <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{scannedPacks.length}</span>
                                            </div>
                                            {scannedPacks.map((pack) => (
                                                <div key={pack.serializedPackId} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg shadow-sm animate-in slide-in-from-left-2 duration-300">
                                                    <div className="flex items-center space-x-3">
                                                        <div className="bg-blue-50 p-2 rounded text-blue-600">
                                                            <Package size={16} />
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-bold text-slate-800 tracking-tight">{pack.serializedPackId}</div>
                                                            <div className="text-[10px] text-slate-500 flex items-center space-x-2">
                                                                <span className="font-mono">{pack.batchNumber}</span>
                                                                <span>•</span>
                                                                <span>Exp: {pack.expiryDate}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button 
                                                        onClick={() => handleRemoveScannedPack(pack.serializedPackId)}
                                                        className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded transition-all"
                                                        title="Retirer cet article"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </>
                                    ) : (
                                        <div className="text-center py-4 text-slate-400 text-sm italic border-2 border-dashed border-slate-200 rounded-xl">
                                            Aucun article scanné.
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : selectionMode === 'MANUAL' ? (
                            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                                <label className="block text-xs font-bold text-slate-500 uppercase">Lots Disponibles</label>
                                {availableStock.map(batch => {
                                    const selected = selectedBatches.find(b => b.batchNumber === batch.batchNumber);
                                    const currentQtyUnits = selected ? selected.quantity : 0;
                                    const currentQtyDisplay = unitType === 'BOX' && activeProduct?.unitsPerPack 
                                        ? Number((currentQtyUnits / activeProduct.unitsPerPack).toFixed(2)) 
                                        : currentQtyUnits;

                                    return (
                                        <div key={batch.id} className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <div className="font-bold text-sm text-slate-700">{batch.batchNumber}</div>
                                                    <div className="text-xs text-slate-500">Exp: {new Date(batch.expiryDate).toLocaleDateString()}</div>
                                                    <div className="text-[10px] text-slate-400 uppercase">{(() => {
                                                         const loc = locations.find(l => l.id === batch.location || l.name === batch.location);
                                                         return loc ? loc.name : (batch.location || 'N/A');
                                                     })()}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs font-medium text-emerald-600">Dispo: {unitType === 'BOX' && activeProduct?.unitsPerPack ? `${Number((batch.theoreticalQty / activeProduct.unitsPerPack).toFixed(2))} bts` : `${batch.theoreticalQty} uts`}</div>
                                                </div>
                                            </div>
                                            <input 
                                                type="number"
                                                min="0"
                                                className="w-full border border-slate-300 rounded px-2 py-1 text-sm font-bold text-center focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="0"
                                                value={currentQtyDisplay || ''}
                                                onChange={(e) => {
                                                    const val = parseFloat(e.target.value) || 0;
                                                    const units = unitType === 'BOX' && activeProduct?.unitsPerPack ? Math.round(val * activeProduct.unitsPerPack) : val;
                                                    
                                                    // Clamp to max available
                                                    const validUnits = Math.min(units, batch.theoreticalQty);
                                                    
                                                    setSelectedBatches(prev => {
                                                        const others = prev.filter(p => p.batchNumber !== batch.batchNumber);
                                                        if (validUnits > 0) {
                                                            return [...others, {
                                                                batchNumber: batch.batchNumber,
                                                                quantity: validUnits,
                                                                expiryDate: batch.expiryDate,
                                                                locationId: batch.location
                                                            }];
                                                        }
                                                        return others;
                                                    });
                                                }}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Quantité à Ajouter</label>
                                <input 
                                    type="number" 
                                    min="0"
                                    className="w-full text-3xl font-bold p-4 border border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-center"
                                    value={quantityToAdd || ''}
                                    onChange={(e) => setQuantityToAdd(parseInt(e.target.value) || 0)}
                                    placeholder="0"
                                />
                                <p className="text-xs text-center mt-2 text-slate-400">
                                    {unitType === 'BOX' ? 'Boîtes' : 'Unités'} à dispenser
                                </p>
                            </div>
                        )}

                        {/* ACTION */}
                        <button
                            onClick={handleDispenseClick}
                            disabled={isDispensing || selectedBatches.reduce((a, b) => a + b.quantity, 0) === 0}
                            className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center space-x-2 transition-all transform active:scale-95 ${
                                selectedBatches.reduce((a, b) => a + b.quantity, 0) > 0 ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-blue-500/30' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                        >
                            {isDispensing ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                            ) : (
                                <>
                                    <Check className="h-5 w-5" /> <span>Confirmer Dispensation</span>
                                </>
                            )}
                        </button>
                     </div>

                     {/* RIGHT: Preview / Details */}
                     <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 h-full flex flex-col">
                        <h5 className="font-bold text-slate-700 mb-4 text-sm flex items-center">
                            <History className="h-4 w-4 mr-2" /> Lots Sélectionnés
                        </h5>
                        
                        <div className="flex-1 overflow-y-auto space-y-2">
                             {selectedBatches.length > 0 ? (
                                 selectedBatches.map((batch, idx) => (
                                     <div key={idx} className="flex justify-between items-center bg-white p-3 rounded border border-slate-200 shadow-sm text-sm">
                                         <div>
                                            <div className="mb-1 pb-1 border-b border-slate-100">
                                                <div className="font-bold text-slate-700 text-xs">
                                                    {(batch as any).productName || item.productDispensedName || item.productName}
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-mono">
                                                    {(batch as any).productId || item.productDispensedId || item.productId}
                                                </div>
                                            </div>

                                            <div>
                                                 <div className="font-bold font-mono text-slate-800">{batch.batchNumber}</div>
                                                 <div className="text-xs text-slate-500">Exp: {new Date(batch.expiryDate).toLocaleDateString()}</div>
                                                 <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wide">
                                                     {(() => {
                                                         const loc = locations.find(l => l.id === batch.locationId || l.name === batch.locationId);
                                                         return loc ? loc.name : (batch.locationId || 'N/A');
                                                     })()}
                                                 </div>
                                             </div>
                                         </div>
                                         <div className="text-right">
                                             {unitType === 'BOX' && activeProduct?.unitsPerPack ? (
                                                 <div className="font-bold text-emerald-600">
                                                     {Number((batch.quantity / activeProduct.unitsPerPack).toFixed(2))} bts
                                                 </div>
                                             ) : (
                                                 <div className="font-bold text-emerald-600">{batch.quantity} uts</div>
                                             )}
                                         </div>
                                     </div>
                                 ))
                             ) : (
                                  <div className="text-center py-10 text-slate-400 text-sm">
                                      Aucun lot sélectionné.
                                      <br />
                                      {selectionMode === 'SCAN' ? "Scannez des produits pour commencer." : "Saisissez une quantité pour voir l'aperçu FEFO."}
                                  </div>
                             )}
                        </div>

                        {/* Summary Footer */}
                        {selectedBatches.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-slate-200">
                                <div className="flex justify-between items-center text-sm font-bold">
                                    <span>Total:</span>
                                    <span>
                                        {unitType === 'BOX' && activeProduct?.unitsPerPack ? (
                                             <span>{Number((selectedBatches.reduce((a, b) => a + b.quantity, 0) / activeProduct.unitsPerPack).toFixed(2))} bts</span>
                                         ) : (
                                             <span>{selectedBatches.reduce((a, b) => a + b.quantity, 0)} uts</span>
                                         )}
                                    </span>
                                </div>
                            </div>
                        )}
                     </div>

                 </div>
            </div>

        </div>
    );
};
