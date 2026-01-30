import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Package, Check, AlertCircle, ChevronDown, ChevronUp, Box, LayoutGrid, Barcode } from 'lucide-react';
import { api } from '../../services/api';
import { InventoryItem, ProductDefinition, SerializedPack, PackStatus } from '../../types/pharmacy';

interface ServiceStockExitModalProps {
    isOpen: boolean;
    onClose: () => void;
    admissionId: string;
    serviceName: string;
    onSuccess: () => void;
}

interface ProcessingItem {
    product: ProductDefinition;
    active: boolean;
    mode: 'BOX' | 'UNIT';
    selectionMode: 'FEFO' | 'MANUAL';
    quantity: number;
    selectedBatches: { batchNumber: string; quantity: number }[]; // For Manual Mode
}

export const ServiceStockExitModal: React.FC<ServiceStockExitModalProps> = ({ isOpen, onClose, admissionId, serviceName, onSuccess }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [packs, setPacks] = useState<SerializedPack[]>([]);
    const [catalog, setCatalog] = useState<ProductDefinition[]>([]);
    const [processingState, setProcessingState] = useState<Record<string, ProcessingItem>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadData();
        }
    }, [isOpen]);

    const loadData = async () => {
        try {
            const [inv, cat, allPacks] = await Promise.all([
                api.getInventory(undefined, 'SERVICE'), // Service stock for exit (client filters by serviceId later)
                api.getCatalog(),
                api.getSerializedPacks() // We might need a filter for service location here or strict equality on serviceId?
                // Assuming getSerializedPacks returns all, we filter clientside for now for demo
            ]);
            setInventory(inv);
            setCatalog(cat);
            setPacks(allPacks);
        } catch (e) {
            console.error("Failed to load stock data", e);
        }
    };

    // Filter Service Stock
    const serviceStockItems = useMemo(() => {
        // 1. Find InventoryItems that belong to this service (or location mapped to service)
        // Adjust filter logic based on how serviceId is stored. currently 'serviceId' in InventoryItem
        // RELAXED FILTER: Show ALL service stock for demo purposes/visibility
        const serviceItems = inventory.filter(i =>
            (!!i.serviceId) && i.theoreticalQty > 0
        );

        // Group by product
        const productIds = Array.from(new Set(serviceItems.map(i => i.productId)));

        return productIds.map(pid => {
            const prodDef = catalog.find(p => p.id === pid);
            const items = serviceItems.filter(i => i.productId === pid);
            const totalQty = items.reduce((acc, i) => acc + i.theoreticalQty, 0);

            return {
                product: prodDef,
                totalQty,
                batches: items
            };
        }).filter(item => item.product && (
            item.product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.product.molecules || []).some(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()))
        ));
    }, [inventory, catalog, serviceName, searchQuery]);

    const handleSelectProduct = (productId: string) => {
        setProcessingState(prev => {
            if (prev[productId]) {
                const newState = { ...prev };
                delete newState[productId]; // Toggle off
                return newState;
            } else {
                return {
                    ...prev,
                    [productId]: {
                        product: catalog.find(p => p.id === productId)!,
                        active: true,
                        mode: 'BOX',
                        selectionMode: 'FEFO',
                        quantity: 0,
                        selectedBatches: []
                    }
                };
            }
        });
    };

    const updateProcessingState = (productId: string, updates: Partial<ProcessingItem>) => {
        setProcessingState(prev => ({
            ...prev,
            [productId]: { ...prev[productId], ...updates }
        }));
    };

    // FEFO Computation Helper
    const getFEFOPreview = (productId: string, qtyRequested: number, mode: 'BOX' | 'UNIT') => {
        // Find relevant packs in service
        // Filter packs by location?? currently using InventoryItems to detect stock, but for FEFO we need packs?
        // If we strictly track packs in service:
        // We need to implement logic to check pack.locationId vs serviceName mapping.
        // Assuming for this prototype that `inventory` items are accurate for available qty.
        // But for strict serialization, we need packs.

        // Let's rely on InventoryItem batches for "Sortie Pharmacie" if we don't have perfect pack mapping yet?
        // NO, user request explicitely mentions "Parcourir le stock du service selon la règle FEFO ... Numéro de lot ... Emplacement"

        // Let's use InventoryItems which have batchNumber and expiryDate and location.
        // Filter items for this product in this service.
        const items = inventory.filter(i =>
            i.productId === productId &&
            (i.serviceId === serviceName || i.location.includes(serviceName)) &&
            i.theoreticalQty > 0
        ).sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

        // FEFO Allocation
        let remaining = qtyRequested;
        const allocation: { batch: string; location: string; expiry: string; qty: number }[] = [];

        for (const item of items) {
            if (remaining <= 0) break;
            const take = Math.min(item.theoreticalQty, remaining);
            allocation.push({
                batch: item.batchNumber,
                location: item.location,
                expiry: item.expiryDate,
                qty: take
            });
            remaining -= take;
        }

        return allocation;
    };

    const handleValidation = async () => {
        // Collect all processed items with qty > 0
        const itemsToDispense = Object.values(processingState).filter(s => s.quantity > 0).map(state => {
            return {
                productId: state.product.id,
                quantity: state.quantity,
                mode: state.mode,
                // If manual, pass selected batches?
                dispensedBatches: state.selectionMode === 'MANUAL' ? state.selectedBatches : undefined
            };
        });

        if (itemsToDispense.length === 0) return;

        setIsSubmitting(true);
        try {
            await api.dispenseFromServiceStock({
                admissionId,
                serviceId: serviceName, // Or map to location ID
                items: itemsToDispense
            });
            onSuccess();
            onClose();
        } catch (e) {
            console.error("Error dispensing", e);
            alert("Erreur lors de la validation de la sortie.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex flex-col animate-in fade-in duration-200">
            {/* Header */}
            <div className="bg-white px-8 py-6 flex justify-between items-center shadow-md z-10">
                <div>
                    <h2 className="text-2xl font-black text-slate-800">Sortie de Stock Service</h2>
                    <p className="text-slate-500 font-bold">Tous Services (Demo) • {new Date().toLocaleDateString()}</p>
                </div>
                <div className="flex items-center space-x-4">
                    <div className="relative w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="Rechercher (Nom, Molécule, Lot...)"
                            className="w-full pl-10 pr-4 py-3 bg-slate-100 border-none rounded-xl font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <button onClick={onClose} className="p-3 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                        <X size={24} />
                    </button>
                </div>
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto bg-slate-50 p-8">
                <div className="max-w-5xl mx-auto space-y-6">
                    {serviceStockItems.map(({ product, totalQty, batches }) => {
                        const state = processingState[product.id];
                        const isSelected = !!state;

                        // Calculate Preview for this item if active & quantity > 0
                        const fefoPreview = isSelected && state.selectionMode === 'FEFO' && state.quantity > 0
                            ? getFEFOPreview(product.id, state.quantity, state.mode)
                            : [];

                        return (
                            <div key={product.id} className={`bg-white rounded-2xl border transition-all duration-200 ${isSelected ? 'border-indigo-500 shadow-lg ring-1 ring-indigo-500' : 'border-slate-200 hover:border-slate-300'}`}>
                                {/* Product Card Header */}
                                <div className="p-6 cursor-pointer" onClick={() => handleSelectProduct(product.id)}>
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-start space-x-4">
                                            <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${isSelected ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                                                <Package size={24} />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-black text-slate-800">{product.name}</h3>
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {(product.molecules || []).map(m => (
                                                        <span key={m.id} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-bold uppercase">{m.name}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Dispo Service</div>
                                            {(() => {
                                                const mode = state?.mode || 'BOX';
                                                const unitsPerPack = product.unitsPerPack || 1;
                                                let displayQty = totalQty;
                                                let displayUnit = 'Unité(s) (Total)';

                                                if (mode === 'BOX') {
                                                    // Show available FULL boxes only
                                                    displayQty = Math.floor(totalQty / unitsPerPack);
                                                    displayUnit = 'Bte(s)';
                                                }

                                                return (
                                                    <div className="text-xl font-black text-emerald-600">
                                                        {displayQty} {displayUnit}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>

                                {/* Configuration Section (Visible if Selected) */}
                                {isSelected && (
                                    <div className="px-6 pb-6 animate-in slide-in-from-top-4 duration-200">
                                        <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 space-y-6">

                                            {/* 1. Modes */}
                                            <div className="flex items-center space-x-6">
                                                {/* Dispensation Mode */}
                                                <div className="flex-1">
                                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Mode Dispensation</label>
                                                    <div className="flex bg-white rounded-lg p-1 border border-slate-200">
                                                        <button
                                                            onClick={() => updateProcessingState(product.id, { mode: 'BOX', selectionMode: 'FEFO' })}
                                                            className={`flex-1 py-2 rounded-md text-sm font-bold flex items-center justify-center space-x-2 transition-all ${state.mode === 'BOX' ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                                                        >
                                                            <Box size={16} /> <span>À la boîte</span>
                                                        </button>
                                                        <button
                                                            onClick={() => updateProcessingState(product.id, { mode: 'UNIT', selectionMode: 'FEFO' })}
                                                            disabled={!product.isSubdivisable}
                                                            className={`flex-1 py-2 rounded-md text-sm font-bold flex items-center justify-center space-x-2 transition-all ${state.mode === 'UNIT' ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'} ${!product.isSubdivisable && 'opacity-50 cursor-not-allowed'}`}
                                                        >
                                                            <LayoutGrid size={16} /> <span>À l'unité</span>
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Selection Mode */}
                                                <div className="flex-1">
                                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Mode Sélection</label>
                                                    <div className="flex bg-white rounded-lg p-1 border border-slate-200">
                                                        <button
                                                            onClick={() => updateProcessingState(product.id, { selectionMode: 'FEFO' })}
                                                            className={`flex-1 py-2 rounded-md text-sm font-bold flex items-center justify-center space-x-2 transition-all ${state.selectionMode === 'FEFO' ? 'bg-emerald-100 text-emerald-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                                                        >
                                                            <span>FEFO (Auto)</span>
                                                        </button>
                                                        <button
                                                            onClick={() => updateProcessingState(product.id, { selectionMode: 'MANUAL' })}
                                                            disabled={state.mode === 'UNIT'}
                                                            className={`flex-1 py-2 rounded-md text-sm font-bold flex items-center justify-center space-x-2 transition-all ${state.selectionMode === 'MANUAL' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'} ${state.mode === 'UNIT' && 'opacity-50 cursor-not-allowed'}`}
                                                        >
                                                            <span>Manuel</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 2. Quantity Input */}
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                                    Quantité à sortir ({state.mode === 'BOX' ? 'Boîtes' : 'Unités'})
                                                </label>
                                                <div className="flex items-center space-x-4">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max={state.mode === 'BOX' ? Math.floor(totalQty / (product.unitsPerPack || 1)) : totalQty}
                                                        value={state.quantity || ''}
                                                        onChange={(e) => {
                                                            let val = parseInt(e.target.value) || 0;
                                                            const max = state.mode === 'BOX' ? Math.floor(totalQty / (product.unitsPerPack || 1)) : totalQty;
                                                            if (val > max) val = max; // Enforce max
                                                            updateProcessingState(product.id, { quantity: val });
                                                        }}
                                                        className="w-32 text-2xl font-black text-center bg-white border border-slate-300 rounded-xl py-3 focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                                        placeholder="0"
                                                    />

                                                    {state.quantity > 0 && state.selectionMode === 'FEFO' && (
                                                        <div className="flex-1 bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-start space-x-3">
                                                            <Check className="text-emerald-500 mt-1" size={16} />
                                                            <div className="text-sm">
                                                                <span className="font-bold text-emerald-800">Allocation automatique FEFO :</span>
                                                                <ul className="mt-2 space-y-1">
                                                                    {fefoPreview.map((alloc, idx) => (
                                                                        <li key={idx} className="flex justify-between text-emerald-700">
                                                                            <span>Lot <strong className="font-mono">{alloc.batch}</strong> ({new Date(alloc.expiry).toLocaleDateString()})</span>
                                                                            <span className="font-bold">{alloc.qty} {state.mode === 'BOX' ? 'Bte' : 'Uté'}</span>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* 3. Manual Mode Table */}
                                            {state.selectionMode === 'MANUAL' && (
                                                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                                    <table className="w-full text-sm text-left">
                                                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                                                            <tr>
                                                                <th className="px-4 py-3">Lot</th>
                                                                <th className="px-4 py-3">Péremption</th>
                                                                <th className="px-4 py-3">Emplacement</th>
                                                                <th className="px-4 py-3 text-right">Dispo</th>
                                                                <th className="px-4 py-3 text-right bg-indigo-50/50">À Prélever</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {batches.map(batch => {
                                                                const selected = state.selectedBatches.find(b => b.batchNumber === batch.batchNumber)?.quantity || 0;
                                                                // Manual Mode is only available in BOX mode, so we calculate available BOXES
                                                                const unitsPerPack = product.unitsPerPack || 1;
                                                                const availableBoxes = Math.floor(batch.theoreticalQty / unitsPerPack);

                                                                return (
                                                                    <tr key={batch.id} className="hover:bg-slate-50">
                                                                        <td className="px-4 py-3 font-mono font-bold text-slate-700">{batch.batchNumber}</td>
                                                                        <td className="px-4 py-3">{new Date(batch.expiryDate).toLocaleDateString()}</td>
                                                                        <td className="px-4 py-3 text-slate-500">{batch.location}</td>
                                                                        <td className="px-4 py-3 text-right font-bold">
                                                                            {availableBoxes} <span className="text-xs font-normal text-slate-400">Bte(s)</span>
                                                                        </td>
                                                                        <td className="px-4 py-2 text-right bg-indigo-50/30">
                                                                            <input
                                                                                type="number"
                                                                                min="0"
                                                                                max={availableBoxes}
                                                                                className="w-20 text-right border border-slate-300 rounded px-2 py-1 font-bold focus:border-indigo-500 outline-none"
                                                                                value={selected || ''}
                                                                                onChange={(e) => {
                                                                                    const val = Math.min(parseInt(e.target.value) || 0, availableBoxes);
                                                                                    const newBatches = state.selectedBatches.filter(b => b.batchNumber !== batch.batchNumber);
                                                                                    if (val > 0) newBatches.push({ batchNumber: batch.batchNumber, quantity: val });

                                                                                    // Update total quantity based on sum of batches
                                                                                    const sum = newBatches.reduce((acc, b) => acc + b.quantity, 0);
                                                                                    updateProcessingState(product.id, { selectedBatches: newBatches, quantity: sum });
                                                                                }}
                                                                            />
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}

                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Footer */}
            <div className="bg-white border-t border-slate-200 px-8 py-6 flex justify-between items-center z-10">
                <div className="text-slate-500 font-medium">
                    {Object.values(processingState).filter(s => s.quantity > 0).length} produit(s) prêt(s) à sortir
                </div>
                <div className="flex space-x-4">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={handleValidation}
                        disabled={isSubmitting || Object.values(processingState).filter(s => s.quantity > 0).length === 0}
                        className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:shadow-none transition-all transform active:scale-95 flex items-center space-x-2"
                    >
                        {isSubmitting ? (
                            <><span>En cours...</span></>
                        ) : (
                            <>
                                <Check size={20} />
                                <span>Valider la Sortie</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
