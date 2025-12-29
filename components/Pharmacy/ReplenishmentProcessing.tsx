import React, { useState, useEffect } from 'react';
import { ArrowLeft, Box, Check, LayoutGrid, RotateCcw, Search, Truck, History, MapPin } from 'lucide-react';
import { api } from '../../services/api';
import { ReplenishmentRequest, InventoryItem, ProductDefinition, SerializedPack, StockLocation, ReplenishmentStatus } from '../../types/pharmacy';
import { SubstitutionModal } from './SubstitutionModal';

interface ReplenishmentProcessingProps {
    onBack: () => void;
    requestIdStr?: string;
}

export const ReplenishmentProcessing: React.FC<ReplenishmentProcessingProps> = ({ onBack, requestIdStr }) => {
    const [request, setRequest] = useState<ReplenishmentRequest | null>(null);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [catalog, setCatalog] = useState<ProductDefinition[]>([]);

    // Local state for processing items
    const [processingState, setProcessingState] = useState<Record<string, {
        mode: 'BOX' | 'UNIT';
        selectionMode: 'FEFO' | 'MANUAL';
        quantity: number; // New quantity to ADD
        selectedBatches: { batchNumber: string; quantity: number }[];
        substitutedProductId?: string;
        targetLocationId?: string;
    }>>({});

    const [showSubModal, setShowSubModal] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const [inv, cat, reqs] = await Promise.all([
                    api.getInventory(),
                    api.getCatalog(),
                    api.getReplenishmentRequests()
                ]);
                setInventory(inv);
                setCatalog(cat);

                let target: ReplenishmentRequest | undefined;
                if (requestIdStr) {
                    target = reqs.find(r => r.id === requestIdStr);
                } else {
                    target = reqs.find(r => r.status === 'En Attente');
                }

                if (target) {
                    setRequest(target);
                    const initialStates: any = {};
                    target.items.forEach(item => {
                        initialStates[item.productId] = {
                            mode: 'BOX',
                            selectionMode: 'FEFO',
                            quantity: 0,
                            selectedBatches: []
                        };
                    });
                    setProcessingState(initialStates);
                }
            } catch (e) {
                console.error("Failed to load replenishment data", e);
            }
        };
        load();
    }, [requestIdStr]);

    const handleValidation = async () => {
        if (!request) return;

        // Construct DELTA request
        const processedItems = request.items.map(item => {
            const state = processingState[item.productId];
            if (!state) return item;

            const finalProductId = state.substitutedProductId || item.productId;
            const finalName = catalog.find(p => p.id === finalProductId)?.name || item.productName;

            // Only send items that have quantity to add
            if (state.quantity <= 0 && state.selectedBatches.length === 0) return null;

            const activeProductDef = catalog.find(p => p.id === finalProductId);

            // Calculate final quantity regarding unit mode
            let finalQuantity = state.quantity;
            if (state.mode === 'BOX' && activeProductDef?.unitsPerPack && activeProductDef.unitsPerPack > 1) {
                finalQuantity = state.quantity * activeProductDef.unitsPerPack;
            }

            return {
                ...item,
                productDispensedId: state.substitutedProductId,
                productDispensedName: state.substitutedProductId ? finalName : undefined,
                quantityApproved: finalQuantity, // Amount to ADD (Converted to Units)
                targetLocationId: item.targetLocationId, // Use the originally requested location
                dispensedBatches: state.selectionMode === 'MANUAL' ? state.selectedBatches.map(b => ({
                    batchNumber: b.batchNumber,
                    quantity: b.quantity,
                    expiryDate: new Date().toISOString()
                })) : []
            };
        }).filter(Boolean) as any[]; // Filter out nulls

        if (processedItems.length === 0) {
            alert("Aucune nouvelle quantité à dispenser (tout est à 0).");
            return;
        }

        const deltaRequest = { ...request, items: processedItems };

        try {
            await api.updateReplenishmentRequestStatus(request.id, ReplenishmentStatus.APPROVED, deltaRequest);
            alert("Dispensations ajoutées avec succès !");
            onBack();
        } catch (e) {
            alert("Erreur lors de la validation");
            console.error(e);
        }
    };

    const toggleSubModal = (productId: string) => setShowSubModal(productId);

    if (!request) return <div className="p-8 text-center">Aucune demande trouvée.</div>;

    return (
        <div className="flex flex-col h-full space-y-6">
            <div className="flex items-center space-x-4">
                <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-full">
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h2 className="text-2xl font-bold">
                        {request.status === ReplenishmentStatus.APPROVED ? 'Détails / Ajout Dispensation' : 'Traitement Demande'}
                    </h2>
                    <p className="text-slate-500">{request.serviceName} - {new Date(request.createdAt).toLocaleDateString()} - <span className="font-bold">{request.status}</span></p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pb-20">
                {request.items.map(item => {
                    const state = processingState[item.productId];
                    if (!state) return null;

                    const activeProductId = state.substitutedProductId || item.productId;
                    const activeProductDef = catalog.find(p => p.id === activeProductId);
                    const isSubstituted = !!state.substitutedProductId;

                    const batches = inventory
                        .filter(i => i.productId === activeProductId && !i.serviceId && i.theoreticalQty > 0)
                        .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

                    const totalPharmacyStockUnits = batches.reduce((acc, b) => acc + b.theoreticalQty, 0);
                    let formattedStock = `${totalPharmacyStockUnits}`;

                    if (activeProductDef && activeProductDef.unitsPerPack > 1) {
                        const boxes = Math.ceil(totalPharmacyStockUnits / activeProductDef.unitsPerPack);
                        formattedStock = `${boxes} Btes (${totalPharmacyStockUnits})`;
                    }

                    // History Calc
                    const alreadyDispensedQty = (item.dispensedBatches || []).reduce((acc, b) => acc + b.quantity, 0);

                    return (
                        <div key={item.productId} className={`bg-white rounded-xl shadow-sm border p-6 ${isSubstituted ? 'border-amber-200 bg-amber-50' : 'border-slate-200'}`}>
                            {/* Header */}
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="font-bold text-lg flex items-center space-x-2">
                                        <span>{isSubstituted ? activeProductDef?.name : item.productName}</span>
                                        {isSubstituted && <span className="bg-amber-200 text-amber-800 text-xs px-2 py-1 rounded-full">Substitué</span>}
                                    </h3>
                                    <p className="text-slate-500 text-sm mt-1">
                                        Demandé : <span className="font-bold text-slate-800">{item.quantityRequested}</span> |
                                        Dispo Pharma : <span className="font-bold text-slate-800">{formattedStock}</span>
                                    </p>
                                    {isSubstituted && <p className="text-xs text-amber-600 mt-1">Remplace : {item.productName}</p>}
                                </div>
                                <div className="flex flex-col items-end space-y-2">
                                    <button
                                        onClick={() => toggleSubModal(item.productId)}
                                        className="text-blue-600 text-sm font-medium hover:underline flex items-center space-x-1"
                                    >
                                        <RotateCcw size={14} /> <span>{isSubstituted ? 'Changer' : 'Substituer'}</span>
                                    </button>
                                </div>
                            </div>

                            {/* Existing History */}
                            {alreadyDispensedQty > 0 && (
                                <div className="mb-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
                                    <div className="flex items-center space-x-2 mb-2">
                                        <History size={16} className="text-slate-400" />
                                        <span className="text-sm font-bold text-slate-700 uppercase">Historique des Dispensations ({alreadyDispensedQty} total)</span>
                                    </div>
                                    <div className="space-y-1">
                                        {item.dispensedBatches?.map((batch, idx) => (
                                            <div key={idx} className="flex justify-between text-sm text-slate-600 pl-6">
                                                <span className="font-mono">{batch.batchNumber}</span>
                                                <span>{batch.quantity} unités</span>
                                                <span className="text-slate-400 text-xs">{new Date(batch.expiryDate).toLocaleDateString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Controls */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                                {/* 1. Dispensation Mode */}
                                <div className="bg-slate-50 p-4 rounded-lg">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-3 text-center">Unité</label>
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={() => setProcessingState(p => ({ ...p, [item.productId]: { ...p[item.productId], mode: 'BOX', selectionMode: 'FEFO' } }))}
                                            className={`flex-1 py-1.5 px-2 rounded text-xs font-medium border ${state.mode === 'BOX' ? 'bg-white border-blue-500 text-blue-600 shadow-sm' : 'border-slate-200 text-slate-500'}`}
                                        >
                                            <Box size={14} className="inline mr-1" /> Boîte
                                        </button>
                                        <button
                                            onClick={() => setProcessingState(p => ({ ...p, [item.productId]: { ...p[item.productId], mode: 'UNIT', selectionMode: 'FEFO' } }))}
                                            disabled={!activeProductDef?.isSubdivisable}
                                            className={`flex-1 py-1.5 px-2 rounded text-xs font-medium border ${state.mode === 'UNIT' ? 'bg-white border-blue-500 text-blue-600 shadow-sm' : 'border-slate-200 text-slate-500'} ${!activeProductDef?.isSubdivisable && 'opacity-50'}`}
                                        >
                                            <LayoutGrid size={14} className="inline mr-1" /> Unité
                                        </button>
                                    </div>
                                </div>

                                {/* 3. Selection Mode */}
                                <div className="bg-slate-50 p-4 rounded-lg">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-3 text-center">Mode Sélection</label>
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={() => setProcessingState(p => ({ ...p, [item.productId]: { ...p[item.productId], selectionMode: 'FEFO' } }))}
                                            className={`flex-1 py-1.5 px-2 rounded text-xs font-medium border ${state.selectionMode === 'FEFO' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'border-slate-200 text-slate-500'}`}
                                        >
                                            FEFO (Auto)
                                        </button>
                                        <button
                                            onClick={() => setProcessingState(p => ({ ...p, [item.productId]: { ...p[item.productId], selectionMode: 'MANUAL' } }))}
                                            disabled={state.mode === 'UNIT'}
                                            className={`flex-1 py-1.5 px-2 rounded text-xs font-medium border ${state.selectionMode === 'MANUAL' ? 'bg-white border-blue-500 text-blue-600' : 'border-slate-200 text-slate-500'} ${state.mode === 'UNIT' && 'opacity-50'}`}
                                        >
                                            Manuel
                                        </button>
                                    </div>
                                </div>

                                {/* 4. Quantity / Inputs */}
                                <div className="bg-slate-50 p-4 rounded-lg">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-3 text-center">Ajout Qté</label>

                                    {state.selectionMode === 'FEFO' ? (
                                        <div className="text-center">
                                            <div className="flex items-center justify-center space-x-2">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={state.mode === 'BOX' && activeProductDef?.unitsPerPack && activeProductDef.unitsPerPack > 1
                                                        ? Math.floor(totalPharmacyStockUnits / activeProductDef.unitsPerPack)
                                                        : totalPharmacyStockUnits}
                                                    value={state.quantity}
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value) || 0;
                                                        const max = state.mode === 'BOX' && activeProductDef?.unitsPerPack && activeProductDef.unitsPerPack > 1
                                                            ? Math.floor(totalPharmacyStockUnits / activeProductDef.unitsPerPack)
                                                            : totalPharmacyStockUnits;
                                                        if (val <= max) {
                                                            setProcessingState(p => ({ ...p, [item.productId]: { ...p[item.productId], quantity: val } }));
                                                        }
                                                    }}
                                                    className={`w-20 border rounded p-1 text-lg font-bold text-center ${state.quantity > (state.mode === 'BOX' && activeProductDef?.unitsPerPack && activeProductDef.unitsPerPack > 1 ? Math.floor(totalPharmacyStockUnits / activeProductDef.unitsPerPack) : totalPharmacyStockUnits) ? 'border-red-500 text-red-600' : 'border-slate-300'}`}
                                                />
                                                <span className="text-xs font-medium text-slate-600">{state.mode === 'BOX' ? 'Btes' : 'Utés'}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <div className="max-h-24 overflow-y-auto space-y-1">
                                                {batches.map(batch => (
                                                    <div key={batch.batchNumber} className="flex items-center justify-between text-xs bg-white p-1 rounded border border-slate-200">
                                                        <span className="font-mono">{batch.batchNumber} ({batch.theoreticalQty})</span>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max={batch.theoreticalQty}
                                                            placeholder="0"
                                                            className="w-12 border rounded px-1 text-right"
                                                            onChange={(e) => {
                                                                const val = parseInt(e.target.value) || 0;
                                                                setProcessingState(prev => {
                                                                    const currentBatches = prev[item.productId].selectedBatches.filter(b => b.batchNumber !== batch.batchNumber);
                                                                    if (val > 0) currentBatches.push({ batchNumber: batch.batchNumber, quantity: val });
                                                                    const total = currentBatches.reduce((a, b) => a + b.quantity, 0);
                                                                    return {
                                                                        ...prev,
                                                                        [item.productId]: {
                                                                            ...prev[item.productId],
                                                                            selectedBatches: currentBatches,
                                                                            quantity: total
                                                                        }
                                                                    };
                                                                });
                                                            }}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="text-center text-xs font-bold">Total: {state.quantity}</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {showSubModal && (
                <SubstitutionModal
                    isOpen={true}
                    onClose={() => setShowSubModal(null)}
                    originalProductId={showSubModal}
                    onSelectProduct={(newId) => {
                        setProcessingState(prev => ({ ...prev, [showSubModal]: { ...prev[showSubModal], substitutedProductId: newId, quantity: 0, selectedBatches: [] } }));
                        setShowSubModal(null);
                    }}
                    catalog={catalog}
                    inventory={inventory}
                />
            )}

            <div className="fixed bottom-0 left-0 right-0 md:left-64 bg-white border-t border-slate-200 p-4 flex justify-end z-20">
                <button
                    onClick={handleValidation}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-bold text-lg shadow-lg flex items-center space-x-3 transition-transform active:scale-95"
                >
                    <Check size={24} /> <span>{request.status === ReplenishmentStatus.APPROVED ? 'Ajouter Dispensation' : 'Valider la Demande'}</span>
                </button>
            </div>
        </div>
    );
};
