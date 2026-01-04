import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { InventoryItem, ItemCategory, ProductDefinition, SerializedPack, PackStatus } from '../types/pharmacy';
import { Search, Filter, AlertTriangle, Package, ChevronDown, ChevronRight, Droplets, Pill, Syringe, FileText, Hash, MapPin, Calendar, BoxSelect, Boxes, LayoutGrid } from 'lucide-react';

export const ServiceStock: React.FC = () => {
    const { user } = useAuth();
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [products, setProducts] = useState<ProductDefinition[]>([]);
    const [packs, setPacks] = useState<SerializedPack[]>([]);
    const [locations, setLocations] = useState<any[]>([]); 
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [selectedCategory, setSelectedCategory] = useState<ItemCategory | 'all'>('all');
    const [error, setError] = useState<string | null>(null);
    const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
    const [userServices, setUserServices] = useState<any[]>([]); // {id, name}

    // Load User Services and Set Default
    useEffect(() => {
        const fetchUserServices = async () => {
             try {
                const allServices = await api.getServices();
                const allowed = allServices.filter((s: any) => user?.service_ids?.includes(s.id));
                setUserServices(allowed);
                
                // Default Selection: First available
                if (allowed.length > 0 && !selectedServiceId) {
                    setSelectedServiceId(allowed[0].id);
                }
             } catch (e) {
                 console.error("Failed to load services", e);
             }
        };

        if (user?.service_ids && user.service_ids.length > 0) {
            fetchUserServices();
        }
    }, [user]);

    // Fetch Stock when Service Selection Changes
    useEffect(() => {
        if (!selectedServiceId) {
             setInventory([]);
             return; 
        }

        const loadStock = async () => {
            setLoading(true);
            setError(null);
            try {
                const [inv, cat, packsData, locs] = await Promise.all([
                    api.getInventory(selectedServiceId), // Pass Service ID
                    api.getCatalog(),
                    api.getSerializedPacks(),
                    // Use scoped locations
                    api.getLocations(selectedServiceId, 'SERVICE') 
                ]);
                
                setInventory(inv);
                setProducts(cat);
                setPacks(packsData);
                setLocations(locs);
            } catch (error: any) {
                console.error("Failed to load service inventory", error);
                if (error.message?.includes('403') || error.message?.toLowerCase().includes('forbidden')) {
                     setError("Accès refusé : Vous n'avez pas les permissions nécessaires pour voir ce stock.");
                } else {
                     setError("Erreur lors du chargement du stock.");
                }
            } finally {
                setLoading(false);
            }
        };

        loadStock();
    }, [selectedServiceId]);

    const getLocationName = (locId: string) => {
        const loc = locations.find(l => l.id === locId);
        return loc ? loc.name : locId;
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

    return (
        <div className="p-6 h-full flex flex-col bg-slate-50">
            <div className="flex flex-col space-y-4 mb-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-slate-800">Stock du Service</h1>
                    <div className="flex gap-4 items-center">
                         {/* Service Selector */}
                         <div className="relative">
                            <select
                                value={selectedServiceId || ''}
                                onChange={(e) => setSelectedServiceId(e.target.value)}
                                className="pl-4 pr-10 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700 w-64 appearance-none"
                            >
                                <option value="" disabled>Sélectionner un service</option>
                                {userServices.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                        </div>

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
            </div>

            {/* Error State */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
                    <AlertTriangle className="h-5 w-5" />
                    <span>{error}</span>
                </div>
            )}
            
            {/* No Selection State */}
            {!selectedServiceId && !loading && !error && (
                 <div className="flex-1 flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                        <LayoutGrid className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-900">Aucun service sélectionné</h3>
                    <p className="text-slate-500 max-w-sm mt-1">Veuillez sélectionner un service dans le menu déroulant ci-dessus pour afficher son stock.</p>
                 </div>
            )}

            {/* Content */}
            {selectedServiceId && (
                <div className="flex-1 overflow-y-auto space-y-4">
                    {loading ? (
                         <div className="flex items-center justify-center p-24">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600"></div>
                        </div>
                    ) : stockGroups.length === 0 ? (
                        <div className="p-12 text-center text-slate-400 border border-dashed border-slate-300 rounded-xl bg-white">
                            Aucun stock trouvé pour ce service.
                        </div>
                    ) : (
                        stockGroups.map(group => {
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
                            
                            const totalStockUnits = item.theoreticalQty || 0;
                            const looseUnits = Math.max(0, totalStockUnits - sealedUnits);

                            if (!locationGroups[item.location]) {
                                locationGroups[item.location] = {
                                    name: getLocationName(item.location),
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
                                                 <span className="text-[10px] uppercase text-slate-400 font-bold">Unités en Vrac</span>
                                                 <span className="font-bold text-lg text-slate-800">{productStats.loose}</span>
                                            </div>
                                            <div className="w-px h-8 bg-slate-200"></div>
                                            <div className="flex flex-col items-center">
                                                <span className="text-[10px] uppercase text-slate-400 font-bold">Tot. Unités</span>
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
                                                         const sealedCount = sealedPacks.length;
                                                         
                                                         const sealedUnits = sealedCount * unitsPerPack;
                                                         const totalStockUnits = item.theoreticalQty || 0;
                                                         const looseUnits = Math.max(0, totalStockUnits - sealedUnits);

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
                                                                        <span className="text-slate-300">Boites scellés</span>
                                                                        <span className="font-bold text-white text-sm">: {sealedCount}</span>
                                                                    </div>
                                                                    
                                                                    <div className="bg-slate-800 rounded px-2 py-1.5 flex justify-between items-center text-xs">
                                                                        <span className="text-slate-300">Unités Vrac</span>
                                                                        <span className="font-bold text-white text-sm">: {looseUnits}</span>
                                                                    </div>

                                                                    <div className="pt-2 border-t border-slate-700 flex justify-between items-center mt-1">
                                                                        <span className="text-[10px] font-bold uppercase text-slate-500">Total UNITÉS</span>
                                                                        <span className="font-mono text-lg font-bold text-blue-400">{item.theoreticalQty}</span>
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
                    })
                    )}
                </div>
            )}
        </div>
    );
};
