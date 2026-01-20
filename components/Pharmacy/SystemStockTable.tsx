
import React, { useMemo, useState } from 'react';
import { InventoryItem, ItemCategory, ProductDefinition, SerializedPack, PackStatus, LooseUnitItem } from '../../types/pharmacy';
import { ChevronDown, ChevronRight, Hash, MapPin, Calendar, Package, BoxSelect, Boxes } from 'lucide-react';

interface SystemStockTableProps {
    items: InventoryItem[];
    products: ProductDefinition[];
    filter: string;
    packs?: SerializedPack[];
    looseUnits?: LooseUnitItem[];
}

interface StockGroup {
    productId: string;
    name: string;
    // We will derive better category/class info from ProductDefinition if available
    // but we keep basic info here
    items: InventoryItem[];
    totalQty: number;
    totalValue: number;
}

export const SystemStockTable: React.FC<SystemStockTableProps> = ({ items, products, filter, packs = [], looseUnits = [] }) => {
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

    // Helper functions for price calculation
    const getActivePrice = (suppliers: any[] = []) => {
        const active = suppliers.find((s: any) => s.isActive);
        return active ? active.purchasePrice : 0;
    };

    const calculateSalePriceHT = (purchasePrice: number, margin: number) => {
        return purchasePrice * (1 + margin / 100);
    };

    const calculatePriceTTC = (salePriceHT: number, vatRate: number) => {
        return salePriceHT * (1 + vatRate / 100);
    };

    const stockGroups = useMemo(() => {
        const groups: Record<string, StockGroup> = {};

        // Filter out Service Stock (items with serviceId defined)
        const pharmaItems = items.filter(i => !i.serviceId);

        pharmaItems.forEach(item => {
            const productDef = products.find(p => p.id === item.productId);

            const matchesFilter =
                item.name.toLowerCase().includes(filter.toLowerCase()) ||
                item.id.toLowerCase().includes(filter.toLowerCase()) ||
                item.location.toLowerCase().includes(filter.toLowerCase()) ||
                item.batchNumber.toLowerCase().includes(filter.toLowerCase()) ||
                (productDef?.molecules?.some(m => m.name.toLowerCase().includes(filter.toLowerCase())) ?? false);

            if (!matchesFilter && filter !== '') return;

            if (!groups[item.productId]) {
                const productDef = products.find(p => p.id === item.productId);
                groups[item.productId] = {
                    productId: item.productId,
                    name: productDef?.name || item.productId, // Resolve Name
                    items: [],
                    totalQty: 0,
                    totalValue: 0
                };
            }

            const group = groups[item.productId];
            group.items.push(item);
            
            // Use SQL Inventory Quantity
            const qty = item.theoreticalQty; 
            
            group.totalQty += qty;

            // Calculate value based on Public Price (TTC) as requested
            let unitValue = item.unitPrice; // Fallback

            if (productDef) {
                const activePrice = getActivePrice(productDef.suppliers);
                const salePriceHT = calculateSalePriceHT(activePrice, productDef.profitMargin || 0);
                const priceTTC = calculatePriceTTC(salePriceHT, productDef.vatRate || 0);

                if (productDef.isSubdivisable && productDef.unitsPerPack > 0) {
                    const pricePerUnit = priceTTC / productDef.unitsPerPack;
                    unitValue = pricePerUnit;
                } else {
                    unitValue = priceTTC;
                }
            }

            group.totalValue += (qty * unitValue);
        });

        return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
    }, [items, filter, products]);

    useMemo(() => {
        if (stockGroups.length > 0 && expandedGroups.size === 0) {
            setExpandedGroups(new Set(stockGroups.map(g => g.productId)));
        }
    }, [stockGroups.length]);

    if (stockGroups.length === 0) {
        return (
            <div className="p-12 text-center text-slate-400 border border-dashed border-slate-300 rounded-xl bg-slate-50">
                Aucun enregistrement système trouvé correspondant à votre recherche.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {stockGroups.map(group => {
                const isExpanded = expandedGroups.has(group.productId);
                const productDef = products.find(p => p.id === group.productId);
                const unitsPerPack = productDef?.unitsPerPack || 1;

                // Group items by Location
                const locationGroups: Record<string, {
                    name: string;
                    items: InventoryItem[];
                    stats: { sealed: number; open: number; loose: number; totalQty: number };
                }> = {};

                let productStats = { sealed: 0, open: 0, loose: 0, totalQty: 0 };

                group.items.forEach(item => {
                    const normalize = (s: string) => s?.trim().toLowerCase() || '';
                    const locationPacks = packs.filter(p =>
                        p.productId === item.productId &&
                        p.batchNumber === item.batchNumber &&
                        normalize(p.locationId) === normalize(item.location)
                    );

                    const sealedPacks = locationPacks.filter(p => p.status === PackStatus.SEALED);
                    const openPacks = locationPacks.filter(p => p.status === PackStatus.OPENED);
                    
                    const sealedCount = sealedPacks.length;
                    const openCount = openPacks.length;
                    
                    const sealedUnits = sealedCount * unitsPerPack;
                    const openUnits = openPacks.reduce((acc, p) => acc + (p.remainingUnits || 0), 0);
                    
                    // Loose units calculation from Physical State (SSOT)
                    const batchLooseItems = looseUnits.filter(u => 
                        u.productId === item.productId &&
                        u.batchNumber === item.batchNumber &&
                        u.locationId === item.location
                    );
                    const looseQty = batchLooseItems.reduce((acc, u) => acc + u.quantity, 0);

                    const totalStockUnits = sealedUnits + openUnits + looseQty;

                    if (!locationGroups[item.location]) {
                        locationGroups[item.location] = {
                            name: item.location,
                            items: [],
                            stats: { sealed: 0, open: 0, loose: 0, totalQty: 0 }
                        };
                    }

                    locationGroups[item.location].items.push(item);
                    locationGroups[item.location].stats.sealed += sealedCount;
                    locationGroups[item.location].stats.open += openCount;
                    locationGroups[item.location].stats.loose += looseQty;
                    locationGroups[item.location].stats.totalQty += totalStockUnits;

                    productStats.sealed += sealedCount;
                    productStats.open += openCount;
                    productStats.loose += looseQty;
                    productStats.totalQty += totalStockUnits;
                });

                // Determine display category/class
                let displayClass = 'N/A';
                let classColor = 'bg-slate-100 text-slate-600';

                if (productDef) {
                    if (productDef.therapeuticClass) {
                        displayClass = productDef.therapeuticClass;
                        classColor = 'bg-blue-100 text-blue-700';
                    } else {
                        displayClass = productDef.type;
                        classColor = 'bg-slate-100 text-slate-600';
                    }
                }

                return (
                    <div key={group.productId} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
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
                                        <h3 className="font-bold text-slate-900 text-lg">{group.name}</h3>
                                        <div className="flex items-center space-x-3 mt-1 text-sm">
                                            <span className="text-slate-500 font-mono">Réf: {group.productId}</span>
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide ${classColor}`}>
                                                {displayClass}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex items-center space-x-6 md:space-x-12 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
                                    <div className="flex flex-col items-center">
                                         <span className="text-[10px] uppercase text-slate-400 font-bold">Est. Boites</span>
                                         <span className="font-bold text-lg text-slate-800">
                                             {unitsPerPack > 0 ? Math.floor(productStats.totalQty / unitsPerPack) : productStats.totalQty}
                                         </span>
                                    </div>
                                    <div className="w-px h-8 bg-slate-200"></div>
                                    <div className="flex flex-col items-center">
                                         <span className="text-[10px] uppercase text-slate-400 font-bold">Total Unités</span>
                                         <span className="font-bold text-lg text-slate-800">{productStats.totalQty}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {isExpanded && (
                            <div className="p-6 bg-slate-50 space-y-6">
                                {Object.values(locationGroups).map(locGroup => (
                                    <div key={locGroup.name} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                        <div className="bg-slate-50/80 border-b border-slate-100 px-4 py-3 flex justify-between items-center">
                                            <div className="flex items-center space-x-2 font-bold text-slate-800">
                                                <MapPin size={18} className="text-slate-400" />
                                                <span>{locGroup.name}</span>
                                            </div>
                                            <div className="flex items-center space-x-4 text-xs font-medium text-slate-600 bg-white px-3 py-1.5 rounded-full border border-slate-100 shadow-sm">
                                                <span>Scellés: <b>{locGroup.stats.sealed}</b></span>
                                                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                                <span className="text-amber-600">Ouverts: <b>{locGroup.stats.open}</b></span>
                                                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                                <span>Vrac: <b>{locGroup.stats.loose}</b></span>
                                                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                                <span className="text-blue-600">Tot: <b>{locGroup.stats.totalQty}</b></span>
                                            </div>
                                        </div>
                                        
                                        <div className="p-4 grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                            {locGroup.items.map(item => {
                                                 const normalize = (s: string) => s?.trim().toLowerCase() || '';
                                                 const locationPacks = packs.filter(p =>
                                                    p.productId === item.productId &&
                                                    p.batchNumber === item.batchNumber &&
                                                    normalize(p.locationId) === normalize(item.location)
                                                 );
                                                 
                                                 const sealedPacks = locationPacks.filter(p => p.status === PackStatus.SEALED);
                                                 const openPacks = locationPacks.filter(p => p.status === PackStatus.OPENED);
                                                 
                                                 const sealedCount = sealedPacks.length;
                                                 const openCount = openPacks.length;
                                                 
                                                 const sealedUnits = sealedCount * unitsPerPack;
                                                 const openUnits = openPacks.reduce((acc, p) => acc + (p.remainingUnits || 0), 0);
                                                 

                                                 const totalStockUnits = item.theoreticalQty;

                                                 // Estimate boxes for display
                                                 const boxes = unitsPerPack > 0 ? Math.floor(totalStockUnits / unitsPerPack) : 0;
                                                 const remainder = unitsPerPack > 0 ? totalStockUnits % unitsPerPack : 0;
                                                 
                                                 return (
                                                    <div key={item.id} className="bg-slate-900 text-white p-4 rounded-lg shadow-lg relative overflow-hidden">
                                                        <div className="flex justify-between items-start mb-3 border-b border-slate-700 pb-2">
                                                            <div className="flex-1">
                                                                <div className="text-[10px] uppercase text-slate-400 font-bold mb-0.5">Lot / Batch</div>
                                                                <div className="font-mono font-bold text-base text-white">{item.batchNumber}</div>
                                                            </div>
                                                            <div className="text-right flex-1">
                                                                <div className="text-[10px] uppercase text-slate-400 font-bold mb-0.5">Expiration</div>
                                                                <div className={`font-medium text-sm ${new Date(item.expiryDate) < new Date() ? 'text-red-400' : 'text-slate-300'}`}>
                                                                    {new Date(item.expiryDate).toLocaleDateString()}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="space-y-2">
                                                            <div className="bg-slate-800 rounded px-2 py-1.5 flex justify-between items-center text-xs">
                                                                <span className="text-slate-300">Est. Boites</span>
                                                                <span className="font-bold text-white text-sm">: {boxes}</span>
                                                            </div>
                                                            <div className="bg-slate-800 rounded px-2 py-1.5 flex justify-between items-center text-xs">
                                                                <span className="text-slate-300">Reste (Unités)</span>
                                                                <span className="font-bold text-white text-sm">: {remainder}</span>
                                                            </div>

                                                            <div className="pt-2 border-t border-slate-700 flex justify-between items-center mt-1">
                                                                <span className="text-[10px] font-bold uppercase text-slate-500">Total UNITÉS</span>
                                                                <span className="font-mono text-lg font-bold text-blue-400">{totalStockUnits}</span>
                                                            </div>
                                                        </div>
                                                    </div> 
                                                 );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
