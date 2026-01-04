import React, { useState, useEffect } from 'react';
import { Box, LayoutGrid, AlertTriangle, Check, History, Search, Scan, RefreshCw } from 'lucide-react';
import { ReplenishmentRequest, InventoryItem, ProductDefinition, StockLocation } from '../../types/pharmacy';
import { api } from '../../services/api';

interface ReplenishmentItemCardProps {
    item: ReplenishmentRequest['items'][0];
    request: ReplenishmentRequest;
    inventory: InventoryItem[];
    catalog: ProductDefinition[];
    locations: StockLocation[];
    onDispense: (data: any) => Promise<void>;
}

export const ReplenishmentItemCard: React.FC<ReplenishmentItemCardProps> = ({
    item, request, inventory, catalog, locations, onDispense
}) => {
    // 1. Dispensation State
    const [substitutedProductId, setSubstitutedProductId] = useState<string | undefined>(undefined);
    const [unitType, setUnitType] = useState<'BOX' | 'UNIT'>('BOX');
    const [selectionMode, setSelectionMode] = useState<'FEFO' | 'MANUAL' | 'SCAN'>('FEFO');
    const [quantityToAdd, setQuantityToAdd] = useState<number>(0);
    const [selectedBatches, setSelectedBatches] = useState<{ batchNumber: string; quantity: number; expiryDate: string; locationId: string }[]>([]);
    const [isDispensing, setIsDispensing] = useState(false);
    
    // Search State (Zone C)
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<ProductDefinition[]>([]);
    const [showSearch, setShowSearch] = useState(false);

    // Derived Data
    console.log('[DEBUG] ItemCard item:', item);
    const activeProductId = substitutedProductId || item.productId;
    const activeProduct = catalog.find(p => p.id === activeProductId);
    const requestedProduct = catalog.find(p => p.id === item.productId);

    // Filter Inventory for Active Product (Strict Pharmacy Scope)
    const availableStock = inventory
        .filter(i => i.productId === activeProductId && !i.serviceId && i.theoreticalQty > 0)
        .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()); // FEFO sort

    const totalStockUnits = availableStock.reduce((acc, i) => acc + i.theoreticalQty, 0);

    console.log('[DEBUG] Locations:', locations);
    console.log('[DEBUG] Available Stock:', availableStock);

    // 2. Auto-Calculate FEFO Batches when Quantity Changes
    useEffect(() => {
        // Force FEFO if Unit Type is UNIT
        if (unitType === 'UNIT' && (selectionMode === 'MANUAL' || selectionMode === 'SCAN')) {
            setSelectionMode('FEFO');
            // The state update will trigger a re-render/re-effect, so we can stop here or proceed.
            // Proceeding is fine as selectionMode is still 'MANUAL' in this closure. 
            // However, we shouldn't calculate FEFO based on Manual input logic if we are switching.
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
                    locationId: batch.location // Capture Location
                });
                remaining -= pick;
            }
            setSelectedBatches(batchesToPick);
        } else if (selectionMode !== 'MANUAL') {
            setSelectedBatches([]);
        }
    }, [quantityToAdd, unitType, selectionMode, activeProductId, availableStock, activeProduct]);

    // 3. Handle Dispense Action
    const handleDispenseClick = async () => {
        const totalQty = selectedBatches.reduce((a, b) => a + b.quantity, 0);
        if (totalQty <= 0) return;
        
        setIsDispensing(true);
        try {
            await onDispense({
                requestId: request.id,
                itemProductId: item.productId,
                dispensedProductId: activeProductId,
                quantity: totalQty,
                batches: selectedBatches,
                unitType
            });
            // Reset Form on Success
            setQuantityToAdd(0);
            setSelectedBatches([]);
        } catch (error) {
            console.error("Dispense Error", error);
            alert("Erreur lors de la dispensation");
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

                </div>

                <div className="mt-6 pt-6 border-t border-slate-200">
                     <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Historique Session</span>
                     <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                        {item.dispensedBatches && item.dispensedBatches.length > 0 ? (
                            item.dispensedBatches.map((batch, idx) => (
                                <div key={idx} className="bg-white p-2 rounded border border-slate-200 text-xs">
                                    <div className="flex justify-between">
                                        <span className="font-mono font-bold text-slate-700">{batch.batchNumber}</span>
                                        <span className="text-emerald-600 font-medium">+{batch.quantity}</span>
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
                        <div className="text-sm opacity-80 mt-1">
                            Dispo Pharma: <span className="font-bold">{totalStockUnits} unités</span> 
                            {activeProduct?.unitsPerPack && activeProduct.unitsPerPack > 1 && ` (${Math.floor(totalStockUnits / activeProduct.unitsPerPack)} boîtes)`}
                        </div>
                    </div>
                    {substitutedProductId && <AlertTriangle className="text-amber-500 h-6 w-6" />}
                 </div>

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
                                    <Scan className="inline h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {/* 3. Quantity Input (Conditional) */}
                        {selectionMode === 'MANUAL' ? (
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
                                                         const loc = locations.find(l => l.id === batch.location || l.name === batch.location); // Updated to batch.location
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
                             {selectedBatches.map((batch, idx) => (
                                 <div key={idx} className="flex justify-between items-center bg-white p-3 rounded border border-slate-200 shadow-sm text-sm">
                                     <div>
                                         <div className="font-bold font-mono text-slate-800">{batch.batchNumber}</div>
                                         <div className="text-xs text-slate-500">Exp: {new Date(batch.expiryDate).toLocaleDateString()}</div>
                                         {/* Show Location Name */}
                                         <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wide">
                                             {(() => {
                                                 const loc = locations.find(l => l.id === batch.locationId || l.name === batch.locationId);
                                                 return loc ? loc.name : (batch.locationId || 'N/A');
                                             })()}
                                         </div>
                                     </div>
                                     <div className="text-right">
                                         {/* Show Quantity in Box/Units */}
                                         {unitType === 'BOX' && activeProduct?.unitsPerPack ? (
                                             <div className="font-bold text-emerald-600">
                                                 {Number((batch.quantity / activeProduct.unitsPerPack).toFixed(2))} bts
                                             </div>
                                         ) : (
                                             <div className="font-bold text-emerald-600">{batch.quantity} uts</div>
                                         )}
                                     </div>
                                 </div>
                             ))}
                             {selectedBatches.length === 0 && (
                                 <div className="text-center py-10 text-slate-400 text-sm">
                                     Aucun lot sélectionné.
                                     <br />
                                     Saisissez une quantité pour voir l'aperçu FEFO.
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
