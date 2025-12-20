
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

        items.forEach(item => {
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
        <div className="space-y-4">
            {stockGroups.map(group => {
                const isExpanded = expandedGroups.has(group.productId);
                const productDef = products.find(p => p.id === group.productId);

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
                            className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-100"
                        >
                            <div className="flex items-center space-x-3 w-full md:w-auto mb-4 md:mb-0">
                                <div className={`p-2 rounded-lg transition-colors flex-shrink-0 ${isExpanded ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                                    {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                </div>
                                <div>
                                    <div className="flex items-center space-x-2">
                                        <h3 className="font-bold text-slate-900 text-lg">{group.name}</h3>
                                    </div>
                                    <div className="flex items-center space-x-2 mt-1">
                                        <span className="text-xs text-slate-400 font-mono">Réf: {group.productId}</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${classColor}`}>
                                            {displayClass}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between w-full md:w-auto md:space-x-12 bg-slate-50 md:bg-transparent p-3 md:p-0 rounded-lg">
                                <div className="flex flex-col items-center md:items-end px-4 md:px-0">
                                    <div className="text-[10px] uppercase text-slate-400 font-semibold mb-1">Stock Total</div>
                                    <div className="text-xl font-bold text-slate-800 flex items-center space-x-1">
                                        <Package size={16} className="text-slate-400" />
                                        <span>
                                            {productDef && productDef.unitsPerPack > 1
                                                ? `${Math.floor(group.totalQty / productDef.unitsPerPack)} Btes (${group.totalQty})`
                                                : group.totalQty}
                                        </span>
                                    </div>
                                </div>
                                <div className="w-px h-8 bg-slate-200 md:hidden"></div>
                                <div className="flex flex-col items-center md:items-end px-4 md:px-0">
                                    <div className="text-[10px] uppercase text-slate-400 font-semibold mb-1">Valeur Totale</div>
                                    <div className="text-xl font-bold text-slate-800">€{group.totalValue.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</div>
                                </div>
                            </div>
                        </div>

                        {isExpanded && (
                            <div className="bg-slate-50/50 p-4 grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {group.items.map(item => (
                                    <div key={item.id} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm relative overflow-hidden group">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>

                                        <div className="flex justify-between items-start mb-3 pl-2">
                                            <div className="flex items-center space-x-2">
                                                <div className="bg-slate-100 p-1.5 rounded text-slate-500"><Hash size={14} /></div>
                                                <span className="font-mono font-bold text-sm text-slate-700">{item.batchNumber}</span>
                                            </div>
                                            <div className="flex items-center space-x-1 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                                <MapPin size={12} />
                                                <span>{item.location}</span>
                                            </div>
                                        </div>

                                        <div className="pl-2 mb-4">
                                            <div className="flex items-center space-x-2 text-xs">
                                                <Calendar size={12} className="text-slate-400" />
                                                <span className="text-slate-500">Exp: {item.expiryDate}</span>
                                            </div>
                                        </div>

                                        {/* Pack Details Section */}
                                        {packs.length > 0 && (
                                            <div className="mx-2 mb-3 p-2 bg-slate-50 rounded text-xs space-y-1 border border-slate-100">
                                                {(() => {
                                                    const normalize = (s: string) => s?.trim().toLowerCase() || '';
                                                    const itemPacks = packs.filter(p =>
                                                        p.productId === item.productId &&
                                                        p.lotNumber === item.batchNumber &&
                                                        normalize(p.locationId) === normalize(item.location)
                                                    );

                                                    const sealedCount = itemPacks.filter(p => p.status === PackStatus.SEALED).length;
                                                    const openedPacks = itemPacks.filter(p => p.status === PackStatus.OPENED);
                                                    const openedCount = openedPacks.length;
                                                    const totalRemUnits = openedPacks.reduce((acc, p) => acc + (p.remainingUnits || 0), 0);

                                                    return (
                                                        <>
                                                            <div className="flex justify-between items-center">
                                                                <span className="flex items-center space-x-1 text-slate-600">
                                                                    <BoxSelect size={12} /> <span>Scellées:</span>
                                                                </span>
                                                                <span className="font-bold text-slate-800">{sealedCount}</span>
                                                            </div>
                                                            {openedCount > 0 && (
                                                                <div className="flex justify-between items-center text-amber-700">
                                                                    <span className="flex items-center space-x-1">
                                                                        <Boxes size={12} /> <span>Entamées:</span>
                                                                    </span>
                                                                    <span className="font-medium">{openedCount} ({totalRemUnits} unités rest.)</span>
                                                                </div>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        )}

                                        <div className="border-t border-slate-50 pt-3 pl-2 flex justify-between items-end">
                                            <div>
                                                <div className="text-[10px] text-slate-400 uppercase font-semibold">Quantité</div>
                                                <div className="font-mono font-bold text-lg text-slate-800">
                                                    {products.find(p => p.id === group.productId)?.unitsPerPack && (products.find(p => p.id === group.productId)?.unitsPerPack || 1) > 1
                                                        ? `${Math.floor((item.theoreticalQty ?? 0) / (products.find(p => p.id === group.productId)?.unitsPerPack || 1))} Btes`
                                                        : (item.theoreticalQty ?? 0)}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] text-slate-400 uppercase font-semibold">Valeur</div>
                                                <div className="font-medium text-sm text-slate-600">
                                                    €{(() => {
                                                        const pDef = products.find(p => p.id === group.productId);
                                                        let unitVal = item.unitPrice;
                                                        if (pDef) {
                                                            const activePrice = getActivePrice(pDef.suppliers);
                                                            const sPriceHT = calculateSalePriceHT(activePrice, pDef.profitMargin || 0);
                                                            const pTTC = calculatePriceTTC(sPriceHT, pDef.vatRate || 0);

                                                            if (pDef.isSubdivisable && pDef.unitsPerPack > 0) {
                                                                unitVal = pTTC / pDef.unitsPerPack;
                                                            } else {
                                                                unitVal = pTTC;
                                                            }
                                                        }
                                                        return ((item.theoreticalQty ?? 0) * unitVal).toFixed(2);
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                        }
                    </div >
                )
            })}
        </div >
    );
};
