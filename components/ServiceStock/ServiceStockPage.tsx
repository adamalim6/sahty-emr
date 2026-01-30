/**
 * ServiceStockPage - Clean rebuild of Service Stock viewer
 * Uses EMR-based endpoint (not PHARMACY module)
 * Design matches Stock Pharma page for consistency
 * Integrates with Layout component - no separate header needed
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight, MapPin, Package, BoxSelect, AlertTriangle, Building2, X } from 'lucide-react';
import { api } from '../../services/api';

interface ServiceStockItem {
    productId: string;
    productName: string;
    sahtyCode: string | null;
    type: string | null;
    therapeuticClass: string | null;
    unitsPerBox: number | null;
    lot: string;
    expiry: string;
    location: string;
    locationName: string;
    qtyUnits: number;
    reservedUnits?: number;
    pendingReturnUnits?: number;
    availableUnits?: number;
}

interface ServiceInfo {
    id: string;
    name: string;
}

interface StockGroup {
    productId: string;
    name: string;
    sahtyCode: string | null;
    therapeuticClass: string | null;
    unitsPerBox: number | null;
    items: ServiceStockItem[];
    totalQty: number;
    totalAvailableQty: number;
}

export const ServiceStockPage: React.FC = () => {
    const [services, setServices] = useState<ServiceInfo[]>([]);
    const [selectedServiceId, setSelectedServiceId] = useState<string>('');
    const [stockItems, setStockItems] = useState<ServiceStockItem[]>([]);
    const [loadingServices, setLoadingServices] = useState(true);
    const [loadingStock, setLoadingStock] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchInput, setSearchInput] = useState('');  // What user types
    const [searchTerm, setSearchTerm] = useState('');    // Applied filter (on Enter/button)
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    // Trigger search on Enter or button click
    const handleSearch = () => {
        setSearchTerm(searchInput);
    };

    // Clear search
    const handleClearSearch = () => {
        setSearchInput('');
        setSearchTerm('');
    };

    // Load user services on mount
    useEffect(() => {
        const loadServices = async () => {
            setLoadingServices(true);
            try {
                console.log('[ServiceStockPage] Fetching user services...');
                const svc = await api.getUserServices();
                console.log('[ServiceStockPage] Got services:', svc);
                setServices(svc);
                if (svc.length > 0) {
                    setSelectedServiceId(svc[0].id);
                } else {
                    setError('Aucun service assigné à votre compte');
                }
            } catch (err: any) {
                console.error('[ServiceStockPage] Failed to load services:', err);
                setError('Impossible de charger vos services: ' + (err.message || 'Erreur inconnue'));
            } finally {
                setLoadingServices(false);
            }
        };
        loadServices();
    }, []);

    // Load stock when service changes
    useEffect(() => {
        if (!selectedServiceId) return;
        
        const loadStock = async () => {
            setLoadingStock(true);
            setError(null);
            try {
                console.log('[ServiceStockPage] Fetching stock for service:', selectedServiceId);
                const items = await api.getServiceStock(selectedServiceId);
                console.log('[ServiceStockPage] Got stock items:', items.length);
                setStockItems(items);
            } catch (err: any) {
                console.error('[ServiceStockPage] Failed to load stock:', err);
                setError(err.message || 'Erreur lors du chargement du stock');
            } finally {
                setLoadingStock(false);
            }
        };
        loadStock();
    }, [selectedServiceId]);

    const toggleGroup = (productId: string) => {
        const newExpanded = new Set(expandedGroups);
        if (newExpanded.has(productId)) {
            newExpanded.delete(productId);
        } else {
            newExpanded.add(productId);
        }
        setExpandedGroups(newExpanded);
    };

    const normalizeText = (text: string) => {
        return text?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "") || '';
    };

    const stockGroups = useMemo(() => {
        const groups: Record<string, StockGroup> = {};
        const searchNormalized = normalizeText(searchTerm);

        stockItems.forEach(item => {
            const matchesFilter =
                searchTerm === '' ||
                normalizeText(item.productName).includes(searchNormalized) ||
                normalizeText(item.sahtyCode || '').includes(searchNormalized) ||
                normalizeText(item.locationName).includes(searchNormalized) ||
                normalizeText(item.lot).includes(searchNormalized);

            if (!matchesFilter) return;

            if (!groups[item.productId]) {
                groups[item.productId] = {
                    productId: item.productId,
                    name: item.productName,
                    sahtyCode: item.sahtyCode,
                    therapeuticClass: item.therapeuticClass,
                    unitsPerBox: item.unitsPerBox,
                    items: [],
                    totalQty: 0,
                    totalAvailableQty: 0
                };
            }

            groups[item.productId].items.push(item);
            groups[item.productId].totalQty += item.qtyUnits;
            groups[item.productId].totalAvailableQty += item.availableUnits ?? item.qtyUnits;
        });

        return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
    }, [stockItems, searchTerm]);

    // Auto-expand on filter
    useEffect(() => {
        if (stockGroups.length > 0 && (searchTerm || stockGroups.length < 5)) {
            setExpandedGroups(new Set(stockGroups.map(g => g.productId)));
        }
    }, [stockGroups.length, searchTerm]);

    const deriveBoxQuantity = (units: number, unitsPerBox: number | null): number => {
        if (!unitsPerBox || unitsPerBox <= 1) return units;
        return units / unitsPerBox;
    };

    const selectedService = services.find(s => s.id === selectedServiceId);

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center space-x-4">
                <Building2 className="h-8 w-8 text-blue-600" />
                <div>
                    <h1 className="text-xl font-bold text-slate-900">Stock du Service</h1>
                    <p className="text-sm text-slate-500">Visualisation du stock de votre service</p>
                </div>
            </div>

            {/* Controls */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="flex flex-col md:flex-row gap-4">
                    {/* Service Selector */}
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-slate-600 mb-1">Service</label>
                        {loadingServices ? (
                            <div className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-400">
                                Chargement des services...
                            </div>
                        ) : (
                            <select
                                value={selectedServiceId}
                                onChange={(e) => setSelectedServiceId(e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                disabled={services.length === 0}
                            >
                                {services.length === 0 ? (
                                    <option value="">Aucun service disponible</option>
                                ) : (
                                    services.map(svc => (
                                        <option key={svc.id} value={svc.id}>{svc.name}</option>
                                    ))
                                )}
                            </select>
                        )}
                    </div>

                    {/* Search - Triggers on Enter or button click */}
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-slate-600 mb-1">Recherche</label>
                        <div className="flex items-center space-x-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    placeholder="Nom, lot, emplacement, code Sahty..."
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <button
                                onClick={handleSearch}
                                className="p-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                title="Rechercher"
                            >
                                <Search size={20} />
                            </button>
                            {searchTerm && (
                                <button
                                    onClick={handleClearSearch}
                                    className="p-2.5 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-colors"
                                    title="Effacer la recherche"
                                >
                                    <X size={20} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center space-x-3">
                    <AlertTriangle className="text-red-500 flex-shrink-0" size={24} />
                    <span className="text-red-700">{error}</span>
                </div>
            )}

            {/* Loading Stock */}
            {loadingStock && (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            )}

            {/* Empty State */}
            {!loadingServices && !loadingStock && services.length > 0 && stockGroups.length === 0 && !error && (
                <div className="p-12 text-center text-slate-400 border border-dashed border-slate-300 rounded-xl bg-slate-50">
                    Aucun stock trouvé pour ce service.
                </div>
            )}

            {/* Stock Groups */}
            {!loadingStock && stockGroups.length > 0 && (
                <div className="space-y-6">
                    {stockGroups.map(group => {
                        const isExpanded = expandedGroups.has(group.productId);
                        const totalBoxes = deriveBoxQuantity(group.totalQty, group.unitsPerBox);

                        // Group by location
                        const locationGroups: Record<string, { name: string; items: ServiceStockItem[]; totalQty: number }> = {};
                        group.items.forEach(item => {
                            if (!locationGroups[item.location]) {
                                locationGroups[item.location] = { name: item.locationName, items: [], totalQty: 0 };
                            }
                            locationGroups[item.location].items.push(item);
                            locationGroups[item.location].totalQty += item.qtyUnits;
                        });

                        return (
                            <div key={group.productId} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                {/* Header */}
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
                                                    <span className="text-slate-500 font-medium">Code Sahty: <span className="font-mono text-slate-700">{group.sahtyCode || 'N/A'}</span></span>
                                                    {group.therapeuticClass && (
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-blue-100 text-blue-700">
                                                            {group.therapeuticClass}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center space-x-6 md:space-x-8 bg-white px-5 py-2.5 rounded-lg border border-slate-200 shadow-sm min-w-[300px] justify-between">
                                            <div className="flex flex-col items-center">
                                                <span className="text-[10px] uppercase text-slate-400 font-bold flex items-center gap-1">
                                                    <Package size={12} /> EST. BOITES
                                                </span>
                                                <span className="font-bold text-xl text-slate-800">
                                                    {totalBoxes.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                            <div className="w-px h-10 bg-slate-200"></div>
                                            <div className="flex flex-col items-center">
                                                <span className="text-[10px] uppercase text-slate-400 font-bold flex items-center gap-1">
                                                    <BoxSelect size={12} /> TOTAL UNITÉS
                                                </span>
                                                <span className="font-mono text-xl font-bold text-blue-600">{group.totalQty}</span>
                                                <span 
                                                    className="text-xs text-slate-500 cursor-help"
                                                    title={`Stock physique: ${group.totalQty}\nRéservé: ${group.totalQty - group.totalAvailableQty}\nDisponible: ${group.totalAvailableQty}`}
                                                >
                                                    Disponible: <span className="font-semibold text-emerald-600">{group.totalAvailableQty}</span>
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Body */}
                                {isExpanded && (
                                    <div className="p-6 bg-slate-50 space-y-6">
                                        {Object.entries(locationGroups).map(([locId, locGroup]) => {
                                            const locTotalBoxes = deriveBoxQuantity(locGroup.totalQty, group.unitsPerBox);

                                            return (
                                                <div key={locId} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                                    {/* Location Header */}
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

                                                    {/* Batch Cards */}
                                                    <div className="p-4 grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                                        {locGroup.items.map((item, idx) => {
                                                            const batchBoxes = deriveBoxQuantity(item.qtyUnits, group.unitsPerBox);
                                                            const isExpired = new Date(item.expiry) < new Date();

                                                            return (
                                                                <div key={`${item.lot}-${idx}`} className="group relative overflow-hidden bg-slate-900 text-white p-4 rounded-lg shadow-md hover:shadow-lg transition-all border border-slate-800">
                                                                    {/* Header */}
                                                                    <div className="flex justify-between items-start mb-4 border-b border-slate-700/50 pb-3">
                                                                        <div>
                                                                            <div className="text-[10px] uppercase text-slate-400 font-bold mb-0.5 tracking-wider">Lot / Batch</div>
                                                                            <div className="font-mono text-base font-bold text-white tracking-tight">{item.lot}</div>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <div className="text-[10px] uppercase text-slate-400 font-bold mb-0.5 tracking-wider">Expiration</div>
                                                                            <div className={`font-medium text-sm ${isExpired ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
                                                                                {new Date(item.expiry).toLocaleDateString()}
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

                                                                        <div className="pt-2 border-t border-slate-700/50">
                                                                            <div className="flex justify-between items-center">
                                                                                <span className="text-[10px] font-bold uppercase text-slate-500">Stock Unitaire</span>
                                                                                <span className="font-mono text-2xl font-bold text-blue-400 group-hover:text-blue-300 transition-colors">
                                                                                    {item.qtyUnits}
                                                                                </span>
                                                                            </div>
                                                                            <div 
                                                                                className="flex justify-between items-center mt-1 cursor-help"
                                                                                title={`Stock physique: ${item.qtyUnits}\nRéservé: ${item.reservedUnits || 0}\nRetours en attente: ${item.pendingReturnUnits || 0}\nDisponible: ${item.availableUnits ?? item.qtyUnits}`}
                                                                            >
                                                                                <span className="text-[10px] text-slate-500">Disponible</span>
                                                                                <span className="text-sm font-semibold text-emerald-400">
                                                                                    {item.availableUnits ?? item.qtyUnits}
                                                                                </span>
                                                                            </div>
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
            )}
        </div>
    );
};

export default ServiceStockPage;
