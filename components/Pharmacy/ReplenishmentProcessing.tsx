import React, { useState, useEffect } from 'react';
import { ArrowLeft, Check, AlertTriangle } from 'lucide-react';
import { api } from '../../services/api';
import { ReplenishmentRequest, InventoryItem, ProductDefinition, ReplenishmentStatus, StockLocation } from '../../types/pharmacy';
import { ReplenishmentItemCard } from './ReplenishmentItemCard';

interface ReplenishmentProcessingProps {
    onBack: () => void;
    requestIdStr?: string;
}

export const ReplenishmentProcessing: React.FC<ReplenishmentProcessingProps> = ({ onBack, requestIdStr }) => {
    const [request, setRequest] = useState<ReplenishmentRequest | null>(null);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [catalog, setCatalog] = useState<ProductDefinition[]>([]);
    const [locations, setLocations] = useState<StockLocation[]>([]);
    const [packs, setPacks] = useState<any[]>([]); // SerializedPack[]
    const [looseUnits, setLooseUnits] = useState<any[]>([]); // LooseUnitItem[]
    const [loading, setLoading] = useState(true);

    const loadData = async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            const [inv, cat, reqs, pharmLocs, serviceLocs, allPacks, allLoose] = await Promise.all([
                api.getInventory(),
                api.getCatalog(),
                api.getReplenishmentRequests(),
                api.getLocations(),
                api.getEmrLocations(),
                api.getSerializedPacks(),
                api.getLooseUnits()
            ]);
            setInventory(inv);
            setCatalog(cat);
            setLocations([...pharmLocs, ...serviceLocs]);
            setPacks(allPacks);
            setLooseUnits(allLoose);

            // Re-bind current request to the latest version from server
            let target: ReplenishmentRequest | undefined;
            if (requestIdStr && (!request || request.id === requestIdStr)) { // Keep same request if ID matches
                 target = reqs.find(r => r.id === requestIdStr);
            } else if (request) {
                 target = reqs.find(r => r.id === request.id);
            } else {
                target = reqs.find(r => r.status === 'En Attente');
            }
            
            if (target) {
                setRequest(target);
            }
        } catch (e) {
            console.error("Failed to load replenishment data", e);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [requestIdStr]);

    const handleDispenseItem = async (data: any) => {
        if (!request) return;
        try {
            // New logic: Send explicit dispensation command
            // data contains: { itemProductId, dispensedProductId, quantity, batches: [], unitType }

            const payload = {
                action: 'DISPENSE_ITEM',
                itemProductId: data.itemProductId,
                dispensedProductId: data.dispensedProductId,
                dispensedQuantity: data.quantity,
                batches: data.batches, // [{ batchNumber, quantity, expiryDate }]
                userId: 'CURRENT_USER' // TODO: Get from context/auth
            };

            const result = await api.updateReplenishmentRequestStatus(
                request.id, 
                'DISPENSED', 
                 payload
            );

            // Refresh to get updated counters
            await loadData(true); 

        } catch (error) {
            console.error("Dispense Processing Error", error);
            throw error; 
        }
    };


    const handleFinalize = async () => {
        if (!request) return;
        
        // Confirm completion
        if (!window.confirm("Êtes-vous sûr de vouloir clôturer cette demande ?")) return;

        try {
            await api.updateReplenishmentRequestStatus(request.id, ReplenishmentStatus.APPROVED, null); // No delta needed as it's atomic
            alert("Demande clôturée avec succès !");
            onBack();
        } catch (e) {
            alert("Erreur lors de la clôture");
        }
    };

    if (loading) return <div className="p-12 text-center text-slate-500">Chargement...</div>;
    if (!request) return <div className="p-12 text-center text-slate-500">Demande introuvable.</div>;

    return (
        <div className="flex flex-col h-full bg-slate-50/50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between sticky top-0 z-30 shadow-sm">
                <div className="flex items-center space-x-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <ArrowLeft size={24} className="text-slate-600" />
                    </button>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">
                             Traitement de Demande
                        </h2>
                        <div className="flex items-center text-sm text-slate-500 mt-1 space-x-3">
                             <span className="font-medium bg-blue-100 text-blue-800 px-2 py-0.5 rounded">{request.serviceName}</span>
                             <span>•</span>
                             <span>{new Date(request.createdAt).toLocaleDateString()}</span>
                             <span>•</span>
                             <span className={`font-bold ${request.status === ReplenishmentStatus.PENDING ? 'text-amber-600' : 'text-emerald-600'}`}>{request.status}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center space-x-4">
                     <div className="text-right mr-4 hidden md:block">
                        <div className="text-sm text-slate-400">Progression</div>
                        <div className="font-bold text-slate-700">
                            {request.items.filter(i => (i.quantityApproved || 0) >= i.quantityRequested).length} / {request.items.length} articles
                        </div>
                     </div>
                     <button
                        onClick={handleFinalize}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-sm transition-all flex items-center space-x-2"
                     >
                        <Check size={20} /> <span>Clôturer / Terminer</span>
                     </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 pb-32">
                <div className="max-w-6xl mx-auto space-y-8">
                    {request.items.map(item => (
                        <ReplenishmentItemCard
                            key={item.productId}
                            item={item}
                            request={request}
                            inventory={inventory}
                            catalog={catalog}
                            locations={locations}
                            packs={packs}
                            looseUnits={looseUnits}
                            onDispense={handleDispenseItem}
                        />
                    ))}
                </div>
            </div>
            
        </div>
    );
};
