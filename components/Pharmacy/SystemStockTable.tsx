
import React, { useMemo, useState } from 'react';
import { InventoryItem, ItemCategory, ProductDefinition, SerializedPack, PackStatus } from '../../types/pharmacy';
import { ChevronDown, ChevronRight, Hash, MapPin, Calendar, Package, BoxSelect, Boxes } from 'lucide-react';

interface SystemStockTableProps {
    items: InventoryItem[];
    products: ProductDefinition[];
    filter: string;
    packs?: SerializedPack[];
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

export const SystemStockTable: React.FC<SystemStockTableProps> = ({ items, products, filter, packs = [] }) => {
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
                groups[item.productId] = {
                    productId: item.productId,
                    name: item.name,
                    items: [],
                    totalQty: 0,
                    totalValue: 0
                };
            }

            const group = groups[item.productId];
            group.items.push(item);

            const qty = item.theoreticalQty ?? 0;
            group.totalQty += qty;

            // Calculate value based on Public Price (TTC) as requested
            let unitValue = item.unitPrice; // Fallback

            if (productDef) {
                const activePrice = getActivePrice(productDef.suppliers);
                const salePriceHT = calculateSalePriceHT(activePrice, productDef.profitMargin || 0);
                const priceTTC = calculatePriceTTC(salePriceHT, productDef.vatRate || 0);

                // If the product is subdivisable, the stock quantity is in UNITS (pill/ampoule)
                // But the PriceTTC is usually per BOX.
                // We need to determine if we should multiply by Box Price or Unit Price.

                // However, usually 'currentStock' in product definition is tracked in Boxes or Units?
                // In InventoryItem, 'theoreticalQty' is usually the count of the smallest unit for subdivisable items?
                // Let's verify:
                // In ProductCatalog:
                // "Prix Unitaire (10 unités) = 0.023 / unité"
                // "Prix Public (TTC) = 0.23" (Per Box presumably)

                // If I have 7 boxes (which is 7 * unitsPerPack units)...
                // The user screenshot says: "7 Btes (140)". So 140 units.
                // And "Doliprane 1000" => 7 * 126.60 = 886.20.
                // This means the user wants (Boxes Count * Box Price TTC).

                // We need to convert `qty` (which is likely in units for subdivisable) back to boxes?
                // Or is `qty` just boxes if not subdivisable?

                // Look at the display logic below:
                // `${Math.floor(group.totalQty / productDef.unitsPerPack)} Btes (${group.totalQty})`
                // This confirms `group.totalQty` is in UNITS.

                // So Value = (TotalUnits / UnitsPerPack) * BoxPriceTTC
                // OR Value = TotalUnits * UnitPriceTTC

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
                    stats: { sealed: number; opened: number; loose: number; totalQty: number };
                }> = {};

                let productStats = { sealed: 0, opened: 0, loose: 0, totalQty: 0 };

                group.items.forEach(item => {
                    const normalize = (s: string) => s?.trim().toLowerCase() || '';
                    const locationPacks = packs.filter(p =>
                        p.productId === item.productId &&
                        p.batchNumber === item.batchNumber &&
                        normalize(p.locationId) === normalize(item.location)
                    );

                    const sealedPacks = locationPacks.filter(p => p.status === PackStatus.SEALED);
                    const openedPacks = locationPacks.filter(p => p.status === PackStatus.OPENED);
                    
                    const sealedCount = sealedPacks.length;
                    const openedCount = openedPacks.length;
                    
                    const sealedUnits = sealedCount * unitsPerPack;
                    const openedUnitsRemaining = openedPacks.reduce((acc, p) => acc + (p.remainingUnits || 0), 0);
                    
                    const totalStockUnits = item.theoreticalQty || 0;
                    const looseUnits = Math.max(0, totalStockUnits - sealedUnits - openedUnitsRemaining);

                    if (!locationGroups[item.location]) {
                        locationGroups[item.location] = {
                            name: item.location,
                            items: [],
                            stats: { sealed: 0, opened: 0, loose: 0, totalQty: 0 }
                        };
                    }

                    locationGroups[item.location].items.push(item);
                    locationGroups[item.location].stats.sealed += sealedCount;
                    locationGroups[item.location].stats.opened += openedCount;
                    locationGroups[item.location].stats.loose += looseUnits;
                    locationGroups[item.location].stats.totalQty += totalStockUnits;

                    productStats.sealed += sealedCount;
                    productStats.opened += openedCount;
                    productStats.loose += looseUnits;
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
                                            <span className={`px-2 py-0.5 rounded textxs font-bold uppercase tracking-wide ${classColor}`}>
                                                {displayClass}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex items-center space-x-6 md:space-x-12 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
                                    <div className="flex flex-col items-center">
                                         <span className="text-[10px] uppercase text-slate-400 font-bold">Boites Scellées</span>
                                         <span className="font-bold text-lg text-slate-800">{productStats.sealed}</span>
                                    </div>
                                    <div className="w-px h-8 bg-slate-200"></div>
                                    <div className="flex flex-col items-center">
                                         <span className="text-[10px] uppercase text-slate-400 font-bold">Boites Entamées</span>
                                         <span className="font-bold text-lg text-slate-800">{productStats.opened}</span>
                                    </div>
                                    <div className="w-px h-8 bg-slate-200"></div>
                                    <div className="flex flex-col items-center">
                                         <span className="text-[10px] uppercase text-slate-400 font-bold">Unités en Vrac</span>
                                         <span className="font-bold text-lg text-slate-800">{productStats.loose}</span>
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
                                                <span>Entamés: <b>{locGroup.stats.opened}</b></span>
                                                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                                <span>Vrac: <b>{locGroup.stats.loose}</b></span>
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
                                                 const openedPacks = locationPacks.filter(p => p.status === PackStatus.OPENED);
                                                 
                                                 const sealedCount = sealedPacks.length;
                                                 const openedCount = openedPacks.length;
                                                 const sealedUnits = sealedCount * unitsPerPack;
                                                 const openedUnitsRemaining = openedPacks.reduce((acc, p) => acc + (p.remainingUnits || 0), 0);
                                                 const totalStockUnits = item.theoreticalQty || 0;
                                                 const looseUnits = Math.max(0, totalStockUnits - sealedUnits - openedUnitsRemaining);
                                                 
                                                 return (
                                                    <div key={item.id} className="bg-slate-900 text-white p-4 rounded-lg shadow-lg relative overflow-hidden">
                                                        <div className="flex justify-between items-start mb-4 border-b border-slate-700 pb-3">
                                                            <div>
                                                                <div className="text-[10px] uppercase text-slate-400 font-bold mb-1">Lot / Batch</div>
                                                                <div className="font-mono font-bold text-lg text-white">{item.batchNumber}</div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-[10px] uppercase text-slate-400 font-bold mb-1">Expiration</div>
                                                                <div className={`font-medium ${new Date(item.expiryDate) < new Date() ? 'text-red-400' : 'text-slate-300'}`}>
                                                                    {new Date(item.expiryDate).toLocaleDateString()}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="space-y-3">
                                                            {/* Boites Scelles */}
                                                            <div className="bg-slate-800 rounded p-2 flex justify-between items-center">
                                                                <span className="text-xs text-slate-400 font-medium">Boites scellés</span>
                                                                <span className="font-bold text-white">: {sealedCount}</span>
                                                            </div>
                                                            
                                                            {/* Boites Entames */}
                                                            <div className="bg-slate-800 rounded p-2">
                                                                <div className="flex justify-between items-center mb-1">
                                                                    <span className="text-xs text-slate-400 font-medium">Boites entamnés</span>
                                                                    <span className="font-bold text-white">: {openedCount}</span>
                                                                </div>
                                                                {openedCount > 0 && (
                                                                    <div className="space-y-1 mt-2 pl-2 border-l-2 border-slate-600">
                                                                        {openedPacks.map(p => (
                                                                            <div key={p.id} className="flex justify-between text-[10px] bg-indigo-900/50 px-2 py-1 rounded">
                                                                                <span className="font-mono text-indigo-300">{p.serialNumber}</span>
                                                                                <span className="text-white">Reste : {p.remainingUnits}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            
                                                            {/* Unites en Vrac */}
                                                            <div className="bg-slate-800 rounded p-2 flex justify-between items-center">
                                                                <span className="text-xs text-slate-400 font-medium">Unités en vrac</span>
                                                                <span className="font-bold text-white">: {looseUnits}</span>
                                                            </div>

                                                            <div className="pt-2 border-t border-slate-700 flex justify-between items-center">
                                                                <span className="text-[10px] text-slate-500 uppercase">Total Unités</span>
                                                                <span className="font-mono text-sm font-bold text-blue-400">{item.theoreticalQty}</span>
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
