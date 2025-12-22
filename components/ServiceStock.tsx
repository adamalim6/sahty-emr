import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { InventoryItem, ItemCategory, ProductDefinition, SerializedPack, PackStatus } from '../types/pharmacy';
import { Search, Filter, AlertTriangle, Package, ChevronDown, ChevronRight, Droplets, Pill, Syringe, FileText, Hash, MapPin, Calendar, BoxSelect, Boxes, LayoutGrid } from 'lucide-react';

export const ServiceStock: React.FC = () => {
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [products, setProducts] = useState<ProductDefinition[]>([]);
    const [packs, setPacks] = useState<SerializedPack[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [selectedCategory, setSelectedCategory] = useState<ItemCategory | 'all'>('all');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [inv, cat, packsData] = await Promise.all([
                api.getInventory(),
                api.getCatalog(),
                api.getSerializedPacks()
            ]);

            // Filter for ANY service stock (items with a serviceId)
            // This ensures verification/testing data appears even if not 'SERVICE_DEFAULT'
            const serviceItems = inv.filter(i => !!i.serviceId);
            setInventory(serviceItems);
            setProducts(cat);
            setPacks(packsData);
        } catch (error) {
            console.error("Failed to load service inventory", error);
        } finally {
            setLoading(false);
        }
    };

    const toggleGroup = (productId: string) => {
        const newExpanded = new Set(expandedGroups);
        if (newExpanded.has(productId)) {
            newExpanded.delete(productId);
        } else {
            newExpanded.add(productId);
        }
        setExpandedGroups(newExpanded);
    };

    const getCategoryIcon = (category: ItemCategory) => {
        switch (category) {
            case ItemCategory.ANTIBIOTICS: return <Pill className="w-4 h-4 text-blue-500" />;
            case ItemCategory.ANALGESICS: return <Pill className="w-4 h-4 text-green-500" />;
            case ItemCategory.FLUIDS: return <Droplets className="w-4 h-4 text-cyan-500" />;
            case ItemCategory.CONSUMABLES: return <FileText className="w-4 h-4 text-slate-500" />;
            default: return <Package className="w-4 h-4 text-slate-500" />;
        }
    };

    const stockGroups = useMemo(() => {
        const groups: Record<string, {
            productId: string;
            name: string;
            // category: ItemCategory; // Derived from product def preferably
            totalQuantity: number;
            items: InventoryItem[];
            locations: Set<string>;
            serviceIds: Set<string>;
        }> = {};

        inventory.forEach(item => {
            const productDef = products.find(p => p.id === item.productId);
            // Matches search?
            const matchesSearch =
                item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.productId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.batchNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.location.toLowerCase().includes(searchTerm.toLowerCase());

            // Matches Category?
            const itemCat = productDef?.type || item.category || 'AUTRE';
            const matchesCategory = selectedCategory === 'all' || itemCat === selectedCategory;

            if (!matchesSearch || !matchesCategory) return;

            if (!groups[item.productId]) {
                groups[item.productId] = {
                    productId: item.productId,
                    name: item.name,
                    totalQuantity: 0,
                    items: [],
                    locations: new Set(),
                    serviceIds: new Set()
                };
            }
            groups[item.productId].items.push(item);
            groups[item.productId].totalQuantity += (item.theoreticalQty || 0);
            groups[item.productId].locations.add(item.location);
            if (item.serviceId) groups[item.productId].serviceIds.add(item.serviceId);
        });

        return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
    }, [inventory, searchTerm, selectedCategory, products]);

    const categories = Object.values(ItemCategory);

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="p-6 h-full flex flex-col bg-slate-50">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-800">Stock du Service</h1>
                <div className="flex gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Rechercher (Nom, Lot, Emplacement)..."
                            className="pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4">
                {stockGroups.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 border border-dashed border-slate-300 rounded-xl bg-white">
                        Aucun stock trouvé pour ce service.
                    </div>
                ) : (
                    stockGroups.map(group => {
                        const isExpanded = expandedGroups.has(group.productId);
                        const productDef = products.find(p => p.id === group.productId);

                        let displayClass = 'N/A';
                        let classColor = 'bg-slate-100 text-slate-600';
                        if (productDef) {
                            if (productDef.therapeuticClass) {
                                displayClass = productDef.therapeuticClass;
                                classColor = 'bg-blue-100 text-blue-700';
                            } else {
                                displayClass = productDef.type;
                            }
                        }

                        // Calculate total boxes vs units
                        const unitsPerPack = productDef?.unitsPerPack || 1;
                        // Display: "X Btes + Y Utés" or just "Z Utés"
                        // Simplification: Match SystemStock logic -> Show Boxes (Total Units) if subdivisable
                        const qtyDisplay = unitsPerPack > 1
                            ? `${Math.ceil(group.totalQuantity / unitsPerPack)} Btes (${group.totalQuantity})`
                            : `${group.totalQuantity} Unités`;

                        const unitValue = productDef ? (
                            (productDef.suppliers?.[0]?.purchasePrice || 0) * (1 + (productDef.profitMargin || 0) / 100) * (1 + (productDef.vatRate || 0) / 100)
                        ) : 0;

                        // Normalized value calculation (per unit if subdivisable)
                        const finalUnitValue = (unitsPerPack > 1) ? (unitValue / unitsPerPack) : unitValue;
                        const totalValue = group.totalQuantity * finalUnitValue;

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
                                                <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                                                    {Array.from(group.serviceIds).join(', ')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between w-full md:w-auto md:space-x-12 bg-slate-50 md:bg-transparent p-3 md:p-0 rounded-lg">
                                        <div className="flex flex-col items-center md:items-end px-4 md:px-0">
                                            <div className="text-[10px] uppercase text-slate-400 font-semibold mb-1">Stock Service</div>
                                            <div className="text-xl font-bold text-slate-800 flex items-center space-x-1">
                                                <Package size={16} className="text-slate-400" />
                                                <span>{qtyDisplay}</span>
                                            </div>
                                        </div>
                                        <div className="w-px h-8 bg-slate-200 md:hidden"></div>
                                        <div className="flex flex-col items-center md:items-end px-4 md:px-0">
                                            <div className="text-[10px] uppercase text-slate-400 font-semibold mb-1">Valeur Totale</div>
                                            <div className="text-xl font-bold text-slate-800">
                                                €{totalValue.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="bg-slate-50/50 p-4 grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                        {group.items.map(item => {
                                            // Infer Sealed/Opened from Qty
                                            const itemQty = item.theoreticalQty || 0;
                                            const sealed = unitsPerPack > 1 ? Math.floor(itemQty / unitsPerPack) : itemQty;
                                            const remainder = unitsPerPack > 1 ? itemQty % unitsPerPack : 0;
                                            const opened = remainder > 0 ? 1 : 0;

                                            // Value per item
                                            const itemValue = itemQty * finalUnitValue;

                                            return (
                                                <div key={item.id} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm relative overflow-hidden group">
                                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>

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
                                                            <span className="text-slate-500">Exp: {new Date(item.expiryDate).toLocaleDateString()}</span>
                                                        </div>
                                                    </div>

                                                    {/* Pack Details Section (Inferred) */}
                                                    <div className="mx-2 mb-3 p-2 bg-slate-50 rounded text-xs space-y-1 border border-slate-100">
                                                        <div className="flex justify-between items-center">
                                                            <span className="flex items-center space-x-1 text-slate-600">
                                                                <BoxSelect size={12} /> <span>Scellées:</span>
                                                            </span>
                                                            <span className="font-bold text-slate-800">{sealed}</span>
                                                        </div>
                                                        {opened > 0 && (
                                                            <div className="flex justify-between items-center text-amber-700">
                                                                <span className="flex items-center space-x-1">
                                                                    <Boxes size={12} /> <span>Entamées:</span>
                                                                </span>
                                                                <span className="font-medium">{opened} ({remainder} unités rest.)</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="border-t border-slate-50 pt-3 pl-2 flex justify-between items-end">
                                                        <div>
                                                            <div className="text-[10px] text-slate-400 uppercase font-semibold">Quantité</div>
                                                            <div className="font-mono font-bold text-lg text-slate-800">
                                                                {unitsPerPack > 1
                                                                    ? `${Math.ceil(itemQty / unitsPerPack)} Btes`
                                                                    : itemQty}
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-[10px] text-slate-400 uppercase font-semibold">Valeur</div>
                                                            <div className="font-medium text-sm text-slate-600">
                                                                €{itemValue.toFixed(2)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
