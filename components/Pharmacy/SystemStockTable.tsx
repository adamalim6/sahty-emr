
import React, { useMemo, useState } from 'react';
import { InventoryItem, ProductDefinition, SerializedPack, LooseUnitItem, StockLocation } from '../../types/pharmacy';
import { ChevronDown, ChevronRight, MapPin, Package, BoxSelect } from 'lucide-react';

interface SystemStockTableProps {
    items: InventoryItem[];
    products: ProductDefinition[];
    locations: StockLocation[]; // Added locations prop
    filter: string;
    packs?: SerializedPack[];
    looseUnits?: LooseUnitItem[];
}

interface StockGroup {
    productId: string;
    name: string;
    items: InventoryItem[];
    totalQty: number;
    totalValue: number;
}

export const SystemStockTable: React.FC<SystemStockTableProps> = ({ items, products, locations, filter }) => {
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    const toggleGroup = (productId: string) => {
        const newExpanded = new Set(expandedGroups);
        if (newExpanded.has(productId)) {
            newExpanded.delete(productId);
        } else {
            newExpanded.add(productId);
        }
        setExpandedGroups(newExpanded);
    };

    // Fuzzy Search Helper
    const normalizeText = (text: string) => {
        return text?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "") || '';
    };

    const stockGroups = useMemo(() => {
        const groups: Record<string, StockGroup> = {};
        const pharmaItems = items.filter(i => !i.serviceId);

        pharmaItems.forEach(item => {
            const productDef = products.find(p => p.id === item.productId);
            // Resolve Location Name for Filter
            const locName = locations.find(l => l.id === item.location)?.name || item.location;

            const searchNormalized = normalizeText(filter);
            
            const matchesFilter =
                filter === '' ||
                normalizeText(item.name).includes(searchNormalized) ||
                normalizeText(item.id).includes(searchNormalized) ||
                normalizeText(locName).includes(searchNormalized) || 
                normalizeText(item.batchNumber).includes(searchNormalized) ||
                (productDef?.sahtyCode && normalizeText(productDef.sahtyCode).includes(searchNormalized)) ||
                (productDef?.dciComposition?.some(m => normalizeText(m.name || '').includes(searchNormalized)) ?? false);

            if (!matchesFilter) return;

            if (!groups[item.productId]) {
                groups[item.productId] = {
                    productId: item.productId,
                    name: productDef?.name || item.productId,
                    items: [],
                    totalQty: 0,
                    totalValue: 0
                };
            }

            const group = groups[item.productId];
            group.items.push(item);
            
            const qty = item.theoreticalQty; 
            group.totalQty += qty;

            // Value Calc (Simplified for visualization, keeping existing logic mostly)
            let unitValue = item.unitPrice;
             if (productDef && productDef.suppliers?.find(s => s.isActive)) {
                 unitValue = productDef.suppliers.find(s => s.isActive)!.purchasePrice || 0;
             }
            group.totalValue += (qty * unitValue);
        });

        return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
    }, [items, filter, products, locations]);

    // Auto-expand if searching or small number
    useMemo(() => {
        if (stockGroups.length > 0 && expandedGroups.size === 0 && (filter || stockGroups.length < 5)) {
            setExpandedGroups(new Set(stockGroups.map(g => g.productId)));
        }
    }, [stockGroups.length, filter]);

    if (stockGroups.length === 0) {
        return (
            <div className="p-12 text-center text-slate-400 border border-dashed border-slate-300 rounded-xl bg-slate-50">
                Aucun enregistrement système trouvé correspondant à votre recherche.
            </div>
        );
    }

    // Helper to derive box quantity from units strictly using unitsPerBox
    const deriveBoxQuantity = (units: number, product?: ProductDefinition): number => {
        if (!product || !product.unitsPerBox || product.unitsPerBox <= 1) return units; 
        return units / product.unitsPerBox; 
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {stockGroups.map(group => {
                const isExpanded = expandedGroups.has(group.productId);
                const productDef = products.find(p => p.id === group.productId);
                
                const totalBoxes = deriveBoxQuantity(group.totalQty, productDef);

                // 1. Group items by Location ID
                const locationGroups: Record<string, {
                    id: string;
                    name: string;
                    items: InventoryItem[];
                    totalQty: number;
                }> = {};

                group.items.forEach(item => {
                    const locId = item.location;
                    if (!locationGroups[locId]) {
                        // Resolve Name Here
                        const locName = locations.find(l => l.id === locId)?.name || locId;
                        locationGroups[locId] = {
                            id: locId,
                            name: locName,
                            items: [],
                            totalQty: 0
                        };
                    }
                    locationGroups[locId].items.push(item);
                    locationGroups[locId].totalQty += item.theoreticalQty;
                });

                // Display Classification
                let displayClass = 'N/A';
                let classColor = 'bg-slate-100 text-slate-600';
                if (productDef) {
                    if (productDef.therapeuticClass) {
                        displayClass = productDef.therapeuticClass;
                        classColor = 'bg-blue-100 text-blue-700';
                    } else if (productDef.type) {
                        displayClass = productDef.type;
                    }
                }

                return (
                    <div key={group.productId} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        {/* HEADER */}
                        <div
                            onClick={() => toggleGroup(group.productId)}
                            className="bg-slate-50 border-b border-slate-200 p-4 cursor-pointer hover:bg-slate-100 transition-colors"
                        >
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-center space-x-3">
                                    <div className={`p-2 rounded-lg transition-colors flex-shrink-0 ${isExpanded ? 'bg-blue-100 text-blue-700' : 'bg-white text-slate-500 border border-slate-200'}`}>
                                        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900 text-lg uppercase">{group.name}</h3>
                                        <div className="flex items-center space-x-3 mt-1 text-sm">
                                            <span className="text-slate-500 font-medium">Code Sahty: <span className="font-mono text-slate-700">{productDef?.sahtyCode || 'N/A'}</span></span>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${classColor}`}>
                                                {displayClass}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex items-center space-x-6 md:space-x-8 bg-white px-5 py-2.5 rounded-lg border border-slate-200 shadow-sm min-w-[300px] justify-between">
                                    <div className="flex flex-col items-center">
                                         <span className="text-[10px] uppercase text-slate-400 font-bold flex items-center gap-1">
                                            <Package size={12} /> EST. BOITES
                                         </span>
                                         <span className="font-bold text-xl text-slate-800">
                                             {totalBoxes > 0 && totalBoxes < 0.01 ? '< 0.01' : totalBoxes.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                         </span>
                                    </div>
                                    <div className="w-px h-8 bg-slate-200"></div>
                                    <div className="flex flex-col items-center">
                                         <span className="text-[10px] uppercase text-slate-400 font-bold flex items-center gap-1">
                                            <BoxSelect size={12} /> TOTAL UNITÉS
                                         </span>
                                         <span className="font-mono text-xl font-bold text-blue-600">{group.totalQty}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* BODY */}
                        {isExpanded && (
                            <div className="p-6 bg-slate-50 space-y-6">
                                {Object.values(locationGroups).map(locGroup => {
                                    const locTotalBoxes = deriveBoxQuantity(locGroup.totalQty, productDef);
                                    
                                    return (
                                        <div key={locGroup.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                            {/* LOCATION HEADER */}
                                            <div className="bg-white border-b border-slate-100 px-4 py-3 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white">
                                                <div className="flex items-center space-x-2 font-bold text-slate-800 text-sm">
                                                    <MapPin size={16} className="text-blue-500" />
                                                    <span className="uppercase tracking-wide">{locGroup.name}</span>
                                                </div>
                                                <div className="flex items-center space-x-3 text-xs">
                                                    <div className="flex items-center space-x-1.5 px-3 py-1 bg-slate-100 rounded-full border border-slate-200">
                                                        <span className="text-slate-500 font-medium">Vol</span>
                                                        <span className="font-bold text-slate-900">{locTotalBoxes.toLocaleString(undefined, { maximumFractionDigits: 2 })} Bts</span>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* BATCH CARDS GRID */}
                                            <div className="p-4 grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                                {locGroup.items.map(item => {
                                                     const batchBoxes = deriveBoxQuantity(item.theoreticalQty, productDef);
                                                     const isExpired = new Date(item.expiryDate) < new Date();
                                                     
                                                     return (
                                                        <div key={item.id} className="group relative overflow-hidden bg-slate-900 text-white p-4 rounded-lg shadow-md hover:shadow-lg transition-all border border-slate-800">
                                                            {/* Header */}
                                                            <div className="flex justify-between items-start mb-4 border-b border-slate-700/50 pb-3">
                                                                <div>
                                                                    <div className="text-[10px] uppercase text-slate-400 font-bold mb-0.5 tracking-wider">Lot / Batch</div>
                                                                    <div className="font-mono text-base font-bold text-white tracking-tight">{item.batchNumber}</div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <div className="text-[10px] uppercase text-slate-400 font-bold mb-0.5 tracking-wider">Expiration</div>
                                                                    <div className={`font-medium text-sm ${isExpired ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
                                                                        {new Date(item.expiryDate).toLocaleDateString()}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            
                                                            {/* Content */}
                                                            <div className="space-y-3">
                                                                <div className="flex justify-between items-center text-xs">
                                                                    <span className="text-slate-400 font-medium">Est. Boites</span>
                                                                    <span className="font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                                                                        {batchBoxes.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                                    </span>
                                                                </div>

                                                                <div className="pt-2 border-t border-slate-700/50 flex justify-between items-center">
                                                                    <span className="text-[10px] font-bold uppercase text-slate-500">Stock Unitaire</span>
                                                                    <span className="font-mono text-2xl font-bold text-blue-400 group-hover:text-blue-300 transition-colors">
                                                                        {item.theoreticalQty}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div> 
                                                     );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
