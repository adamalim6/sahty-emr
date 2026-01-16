
import React, { useState, useEffect, useMemo } from 'react';
import { Search, ArrowLeft, Loader2, Package, Scan, Box, AlertCircle, FileText } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { SerializedPack, PackStatus } from '../../types/serialized-pack';

interface DispensationFormProps {
    prescription: any;
    product: any; // Initial product from prescription
    onSuccess: () => void;
}

export const DispensationForm: React.FC<DispensationFormProps> = ({ prescription, product: initialProduct, onSuccess }) => {
    const { user } = useAuth();

    // Helper for safe date handling
    const safeGetTime = (dateStr: string | undefined): number => {
        if (!dateStr) return 0;
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? 0 : d.getTime();
    };

    const safeFormatDate = (dateStr: string | undefined): string => {
        if (!dateStr) return 'N/A';
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
    };

    const safeDateString = (dateStr: string | undefined): string => {
        if (!dateStr) return 'Invalid';
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? 'Invalid' : d.toDateString();
    };

    // UI State
    const [view, setView] = useState<'SEARCH' | 'DISPENSE'>('SEARCH');
    const [selectedProduct, setSelectedProduct] = useState<any>(initialProduct);

    // Search State
    const [searchTerm, setSearchTerm] = useState(initialProduct?.name || '');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Dispensation State
    const [dispenseMode, setDispenseMode] = useState<'BOX' | 'UNIT'>('BOX');
    const [selectionMode, setSelectionMode] = useState<'FEFO' | 'MANUAL' | 'SCAN'>('FEFO');
    const [quantity, setQuantity] = useState(1);
    const [selectedAdmission, setSelectedAdmission] = useState<string | null>(null);
    const [activeAdmissions, setActiveAdmissions] = useState<any[]>([]);

    // Stock State
    const [availablePacks, setAvailablePacks] = useState<SerializedPack[]>([]);
    const [manualSelectedPackIds, setManualSelectedPackIds] = useState<string[]>([]);
    const [isLoadingStock, setIsLoadingStock] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [locations, setLocations] = useState<any[]>([]);
    const [looseUnits, setLooseUnits] = useState<any[]>([]);

    // Initial Load: Admissions & Locations
    useEffect(() => {
        Promise.all([
            api.getAdmissions(),
            api.getLocations()
        ]).then(([admissions, locs]) => {
            const active = admissions.filter(
                a => a.patientId === prescription.patientId && a.status === 'En cours'
            );
            setActiveAdmissions(active);
            if (active.length > 0) setSelectedAdmission(active[0].id);
            setLocations(locs);
        }).catch(console.error);
    }, [prescription.patientId]);

    // PRE-FILL SEARCH RESULTS if product name is present
    useEffect(() => {
        if (searchTerm && view === 'SEARCH') {
            // Let the existing search effect handle it, but we need to trigger it.
            // The existing effect depends on [searchTerm].
        }
    }, []);

    // Load Stock when product changes
    useEffect(() => {
        if (selectedProduct?.id && view === 'DISPENSE') {
            setIsLoadingStock(true);
            setManualSelectedPackIds([]);
            api.getSerializedPacksByProduct(selectedProduct.id)
                .then(packs => {
                    // Cast packs to the correct type since api.ts might return a lighter type
                    const fullPacks = packs as unknown as SerializedPack[];

                    // Filter out non-available packs AND Service Stock
                    // We allow EXPIRED to show up as per user request

                    const pharmacyLocationIds = locations.map(l => l.id);
                    const pharmacyLocationNames = locations.map(l => l.name);

                    const active = fullPacks.filter(p =>
                        p.status !== PackStatus.DISPENSED &&
                        p.status !== PackStatus.DESTROYED &&
                        p.status !== PackStatus.RETURNED &&
                        // RESTRICTION: Only show packs in Pharmacy Locations
                        (pharmacyLocationIds.includes(p.locationId) || pharmacyLocationNames.includes(p.locationId))
                    );
                    // Sort by FEFO default
                    const sorted = active.sort((a, b) => {
                        if (a.status === PackStatus.OPENED && b.status !== PackStatus.OPENED) return -1;
                        if (b.status === PackStatus.OPENED && a.status !== PackStatus.OPENED) return 1;
                        return safeGetTime(a.expiryDate) - safeGetTime(b.expiryDate);
                    });
                    // Deduplicate packs by ID to prevent weird UI linking
                    const uniquePacks = Array.from(new Map(sorted.map(p => [p.id, p])).values());
                    setAvailablePacks(uniquePacks);
                })
                .catch(err => console.error("Stock load error", err))
                .finally(() => setIsLoadingStock(false));
            
            // Fetch Loose Units
            api.getLooseUnits()
                .then(units => {
                    const productLoose = units.filter((u: any) => u.productId === selectedProduct.id);
                    setLooseUnits(productLoose);
                })
                .catch(err => console.error("Loose units load error", err));
        }
    }, [selectedProduct, view]);

    // Search Logic
    useEffect(() => {
        if (searchTerm.length >= 2) {
            setIsSearching(true);
            api.getCatalog().then(products => {
                const results = products.filter(p =>
                    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (p.molecules && p.molecules.some(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()))) ||
                    // Fallback for old API response if needed
                    (p['molecule'] && p['molecule'].toLowerCase().includes(searchTerm.toLowerCase()))
                );
                setSearchResults(results);
            }).finally(() => setIsSearching(false));
        } else {
            setSearchResults([]);
        }
    }, [searchTerm]);

    // Reset selection when modes change
    useEffect(() => {
        setManualSelectedPackIds([]);
    }, [dispenseMode, selectionMode]);

    // Force BOX mode if product is not subdivisable
    useEffect(() => {
        if (selectedProduct && selectedProduct.isSubdivisable === false) {
            setDispenseMode('BOX');
        }
    }, [selectedProduct]);


    const handleDispense = async () => {
        if (!selectedAdmission) return setError("Aucune admission sélectionnée");

        setIsSubmitting(true);
        setError(null);

        try {
            // If Manual, validate count
            if (selectionMode === 'MANUAL' && manualSelectedPackIds.length === 0) {
                throw new Error("Veuillez sélectionner des lots.");
            }
            // Removed redundancy check per user request

            await api.dispenseWithFEFO({
                prescriptionId: prescription.id,
                admissionId: selectedAdmission,
                productId: selectedProduct.id,
                mode: dispenseMode === 'BOX' ? 'FULL_PACK' : 'UNIT',
                quantity: selectionMode === 'MANUAL' ? manualSelectedPackIds.length : quantity,
                userId: user ? `${user.prenom} ${user.nom}`.trim() || user.username : 'unknown', 
                targetPackIds: selectionMode === 'MANUAL' ? manualSelectedPackIds : undefined
            });

            onSuccess();
            setQuantity(1);
            setManualSelectedPackIds([]);
            // Reload stock
            api.getSerializedPacksByProduct(selectedProduct.id).then(packs => {
                const fullPacks = packs as unknown as SerializedPack[];
                const pharmacyLocationIds = locations.map(l => l.id);
                const pharmacyLocationNames = locations.map(l => l.name);

                const active = fullPacks.filter(p =>
                    [PackStatus.SEALED, PackStatus.OPENED].includes(p.status) &&
                    (pharmacyLocationIds.includes(p.locationId) || pharmacyLocationNames.includes(p.locationId))
                );
                // re-sort
                active.sort((a, b) => safeGetTime(a.expiryDate) - safeGetTime(b.expiryDate));
                setAvailablePacks(active);
            });

        } catch (err: any) {
            setError(err.message || "Erreur de dispensation");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Group packs for Manual Mode
    const groupedPacks = useMemo(() => {
        const groups: Record<string, {
            id: string;
            lotNumber: string;
            expiryDate: string;
            locationId: string;
            packs: SerializedPack[];
        }> = {};

        availablePacks.forEach(pack => {
            const key = `${pack.batchNumber}-${pack.locationId || 'Stock'}-${safeDateString(pack.expiryDate)}`;
            if (!groups[key]) {
                groups[key] = {
                    id: key,
                    lotNumber: pack.batchNumber,
                    expiryDate: pack.expiryDate,
                    locationId: pack.locationId || 'Stock',
                    packs: []
                };
            }
            groups[key].packs.push(pack);
        });
        return Object.values(groups).sort((a, b) => safeGetTime(a.expiryDate) - safeGetTime(b.expiryDate));
    }, [availablePacks]);

    const handleGroupQuantityChange = (groupPacks: SerializedPack[], newQty: number) => {
        const currentSelectedIds = manualSelectedPackIds.filter(id => groupPacks.some(p => p.id === id));
        const currentQty = currentSelectedIds.length;
        const diff = newQty - currentQty;

        if (diff > 0) {
            const availableToAdd = groupPacks.filter(p => !manualSelectedPackIds.includes(p.id));
            const toAdd = availableToAdd.slice(0, diff).map(p => p.id);
            setManualSelectedPackIds(prev => [...prev, ...toAdd]);
        } else if (diff < 0) {
            const toRemove = currentSelectedIds.slice(0, Math.abs(diff));
            setManualSelectedPackIds(prev => prev.filter(id => !toRemove.includes(id)));
        }
    };

    const totalAvailable = dispenseMode === 'BOX'
        ? availablePacks.filter(p => p.status === PackStatus.SEALED).length
        : availablePacks.reduce((acc, p) => acc + (p.remainingUnits || p.unitsPerPack), 0);

    // Render Search View
    if (view === 'SEARCH') {
        return (
            <div className="bg-white rounded-2xl h-full flex flex-col relative overflow-hidden border border-slate-200/60 shadow-xl shadow-slate-200/40">
                <div className="p-6 pb-4 bg-slate-50/50 border-b border-slate-100">
                    <h3 className="font-black text-slate-800 text-lg mb-1 flex items-center">
                        <Search className="w-5 h-5 mr-2 text-indigo-500" />
                        Recherche Stock
                    </h3>
                    <p className="text-xs text-slate-400">Recherchez un produit pour commencer la dispensation.</p>
                </div>

                <div className="p-4">
                    <div className="relative group">
                        <Search className="absolute left-3 top-3 text-slate-400 w-5 h-5 group-focus-within:text-indigo-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Nom du médicament, DCI..."
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-800"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3 custom-scrollbar">
                    {isSearching ? (
                        <div className="flex flex-col items-center justify-center h-40">
                            <Loader2 className="animate-spin text-indigo-500 mb-2" />
                            <span className="text-xs text-slate-400 font-medium tracking-wide uppercase">Recherche en cours...</span>
                        </div>
                    ) : searchResults.length > 0 ? (
                        searchResults.map(prod => {
                            const isOutOfStock = (prod.currentStock || 0) <= 0;
                            return (
                                <button
                                    key={prod.id}
                                    onClick={() => {
                                        if (!isOutOfStock) {
                                            setSelectedProduct(prod);
                                            setView('DISPENSE');
                                        }
                                    }}
                                    disabled={isOutOfStock}
                                    className={`w-full p-4 rounded-xl border-l-4 transition-all text-left group relative overflow-hidden ${isOutOfStock
                                        ? 'bg-slate-50 border-slate-200 border-l-slate-300 opacity-75 cursor-not-allowed grayscale-[0.5]'
                                        : 'bg-white border-slate-100 border-l-indigo-500 shadow-sm hover:shadow-lg hover:-translate-y-0.5'
                                        }`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center">
                                                <span className={`font-bold text-lg ${isOutOfStock ? 'text-slate-500' : 'text-slate-800'}`}>
                                                    {prod.name}
                                                </span>
                                            </div>
                                            <div className="text-sm text-slate-500 mt-1 font-medium">
                                                {prod.molecules
                                                    ? prod.molecules.map((m: any) => m.name).join(', ')
                                                    : (prod.molecule || '')}
                                            </div>
                                            {prod.category && (
                                                <span className="inline-block mt-2 px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] uppercase font-bold rounded">
                                                    {prod.category}
                                                </span>
                                            )}
                                        </div>

                                        {isOutOfStock ? (
                                            <div className="flex flex-col items-end">
                                                <span className="px-3 py-1 bg-red-50 text-red-600 text-xs font-bold uppercase rounded-lg border border-red-100 flex items-center">
                                                    <AlertCircle size={12} className="mr-1" />
                                                    Rupture
                                                </span>
                                                <span className="text-[10px] text-slate-400 mt-1 font-mono">Stock: 0</span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-end">
                                                <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-xs font-bold uppercase rounded-lg border border-emerald-100">
                                                    En Stock
                                                </span>
                                                {prod.currentStock > 0 && (
                                                    <span className="text-[10px] text-emerald-600/70 mt-1 font-bold font-mono">
                                                        {prod.currentStock} dispo
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {!isOutOfStock && (
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <ArrowLeft className="rotate-180 text-indigo-500" />
                                        </div>
                                    )}
                                </button>
                            );
                        })
                    ) : searchTerm.length > 2 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                            <Package size={48} className="text-slate-200 mb-3" />
                            <p>Aucun produit trouvé</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 opacity-50">
                            <div className="bg-slate-100 p-4 rounded-full mb-4">
                                <Search size={32} className="text-slate-400" />
                            </div>
                            <p className="text-slate-400 text-sm font-medium">Commencez à taper pour rechercher...</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Render Dispense View
    return (
        <div className="bg-white rounded-2xl h-full flex flex-col font-sans overflow-hidden border border-slate-200 shadow-xl shadow-slate-200/50">
            {/* Header */}
            <div className="bg-slate-50 p-5 border-b border-slate-100 flex items-start gap-4">
                <button
                    onClick={() => setView('SEARCH')}
                    className="mt-1 p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all border border-transparent hover:border-slate-200 group"
                >
                    <ArrowLeft className="w-5 h-5 text-slate-500 group-hover:text-indigo-600" />
                </button>
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-black text-xl text-slate-800 leading-tight">{selectedProduct?.name}</span>
                        <div className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase rounded border border-indigo-100">
                            Dispensation
                        </div>
                    </div>
                    <p className="text-sm text-slate-500 font-medium">
                        {selectedProduct?.molecules
                            ? selectedProduct.molecules.map((m: any) => m.name).join(', ')
                            : (selectedProduct?.molecule || '')}
                    </p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">


                {/* 0. Admission Context */}
                <div className={`p-4 rounded-xl border ${activeAdmissions.length === 0 ? 'bg-red-50 border-red-200' : 'bg-indigo-50 border-indigo-100'}`}>
                    <div className="flex items-center justify-between mb-2">
                         <span className={`text-xs font-bold uppercase tracking-widest ${activeAdmissions.length === 0 ? 'text-red-500' : 'text-indigo-500'}`}>
                             Contexte Admission
                         </span>
                         {activeAdmissions.length > 1 && (
                             <span className="text-[10px] bg-white px-2 py-1 rounded border border-indigo-100 text-indigo-600 font-bold">
                                 {activeAdmissions.length} Actives
                             </span>
                         )}
                    </div>
                    
                    {activeAdmissions.length === 0 ? (
                         <div className="flex items-center text-red-600 font-medium text-sm">
                             <AlertCircle size={18} className="mr-2" />
                             Aucune admission active pour ce patient. Dispensation bloquée.
                         </div>
                    ) : (
                        activeAdmissions.length === 1 ? (
                            <div className="font-bold text-slate-700 text-sm flex items-center">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></div>
                                Admission du {safeFormatDate(activeAdmissions[0].admissionDate)} ({activeAdmissions[0].id})
                            </div>
                        ) : (
                            <select 
                                value={selectedAdmission || ''}
                                onChange={(e) => setSelectedAdmission(e.target.value)}
                                className="w-full mt-1 p-2 rounded-lg border border-indigo-200 bg-white text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            >
                                {activeAdmissions.map(adm => (
                                    <option key={adm.id} value={adm.id}>
                                        Admission du {safeFormatDate(adm.admissionDate)} - {adm.serviceId || 'Service Inconnu'}
                                    </option>
                                ))}
                            </select>
                        )
                    )}
                </div>

                {/* 1. Mode Selector (Box/Unit) */}
                <div className="bg-slate-50 p-1.5 rounded-xl flex shadow-inner">
                    <button
                        onClick={() => setDispenseMode('BOX')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${dispenseMode === 'BOX'
                            ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-100'
                            : 'text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        <Box size={16} />
                        Par Boite
                    </button>
                    <button
                        onClick={() => setDispenseMode('UNIT')}
                        disabled={selectedProduct?.isSubdivisable === false}
                        title={selectedProduct?.isSubdivisable === false ? "Ce produit n'est pas subdivisable" : ""}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
                            selectedProduct?.isSubdivisable === false
                                ? 'opacity-50 cursor-not-allowed text-slate-300'
                                : dispenseMode === 'UNIT'
                                    ? 'bg-white text-amber-600 shadow-sm ring-1 ring-slate-100'
                                    : 'text-slate-400 hover:text-slate-600' 
                            }`}
                    >
                        <Scan size={16} />
                        Par Unité
                    </button>
                </div>

                {/* 2. Quantity Selector - BIG (Hidden in Manual Mode) */}
                {selectionMode !== 'MANUAL' && (
                    <div className="flex flex-col items-center justify-center py-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Quantité à dispenser</span>
                        <div className="flex items-center gap-6">
                            <button
                                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-white transition-all active:scale-95"
                            >
                                <span className="text-2xl font-light">-</span>
                            </button>

                            <div className="w-24 text-center">
                                <input
                                    type="number"
                                    min="1"
                                    value={quantity}
                                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 0))}
                                    className="w-full text-5xl font-black text-center text-slate-800 bg-transparent outline-none p-0"
                                />
                                <div className="text-sm font-bold text-slate-400 uppercase mt-1">
                                    {dispenseMode === 'BOX' ? 'Boîte(s)' : 'Unité(s)'}
                                </div>
                            </div>

                            <button
                                onClick={() => setQuantity(quantity + 1)}
                                className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:border-emerald-300 hover:text-emerald-600 hover:bg-white transition-all active:scale-95"
                            >
                                <span className="text-2xl font-light">+</span>
                            </button>
                        </div>

                            <div className="mt-6 flex flex-wrap justify-center gap-3">
                                {(() => {
                                    const sealedCount = availablePacks.filter(p => p.status === PackStatus.SEALED).length;
                                    const openCount = availablePacks.filter(p => p.status === PackStatus.OPENED).length;
                                    const looseCount = looseUnits.reduce((acc, u) => acc + u.quantity, 0);
                                    const unitsInOpen = availablePacks.filter(p => p.status === PackStatus.OPENED).reduce((acc, p) => acc + (p.remainingUnits || 0), 0);
                                    const totalUnits = (sealedCount * (selectedProduct?.unitsPerPack || 1)) + unitsInOpen + looseCount;
                                    
                                    return (
                                        <>
                                            <div className="flex items-center space-x-2 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                                                <span className="w-4 h-4 rounded bg-emerald-200 flex items-center justify-center text-[10px] text-emerald-800 font-bold">B</span>
                                                <div className="flex flex-col leading-none">
                                                    <span className="text-[10px] text-emerald-600 font-bold uppercase">Scellées</span>
                                                    <span className="font-bold text-emerald-900">{sealedCount}</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center space-x-2 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100">
                                                <span className="w-4 h-4 rounded bg-amber-200 flex items-center justify-center text-[10px] text-amber-800 font-bold">O</span>
                                                <div className="flex flex-col leading-none">
                                                    <span className="text-[10px] text-amber-600 font-bold uppercase">Ouvertes</span>
                                                    <span className="font-bold text-amber-900">{openCount}</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center space-x-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                                                <span className="w-4 h-4 rounded bg-blue-200 flex items-center justify-center text-[10px] text-blue-800 font-bold">U</span>
                                                <div className="flex flex-col leading-none">
                                                    <span className="text-[10px] text-blue-600 font-bold uppercase">Vrac</span>
                                                    <span className="font-bold text-blue-900">{looseCount}</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center space-x-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                                                <div className="flex flex-col leading-none text-right min-w-[60px]">
                                                    <span className="text-[10px] text-slate-500 font-bold uppercase">Total Unités</span>
                                                    <span className="font-bold text-slate-900">{totalUnits}</span>
                                                </div>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                    </div>
                )}

                {/* 3. Strategy Selector */}
                <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 block">Mode de sélection des lots</span>
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { id: 'FEFO', label: 'Auto (FEFO)', icon: Package },
                            { id: 'MANUAL', label: 'Manuel', icon: FileText },
                            { id: 'SCAN', label: 'Scan', icon: Scan }
                        ].map(mode => (
                            <button
                                key={mode.id}
                                onClick={() => setSelectionMode(mode.id as any)}
                                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${selectionMode === mode.id
                                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                    : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
                                    }`}
                            >
                                <mode.icon size={20} className="mb-1" />
                                <span className="text-[10px] font-bold uppercase">{mode.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 4. Preview / Dynamic Content */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 min-h-[120px]">
                    {isLoadingStock ? (
                        <div className="flex items-center justify-center h-full text-slate-400 gap-2">
                            <Loader2 size={16} className="animate-spin" /> Verif stock...
                        </div>
                    ) : selectionMode === 'FEFO' ? (
                        availablePacks.length > 0 ? (
                            <div className="space-y-2">
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-xs font-bold text-slate-500 uppercase">Lots pré-sélectionnés</span>
                                    {availablePacks[0] && (
                                        <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 font-medium">
                                            Expiration la plus proche: {safeFormatDate(availablePacks[0].expiryDate)}
                                        </span>
                                    )}
                                </div>
                                {availablePacks
                                    .slice(0, dispenseMode === 'BOX' ? quantity : Math.ceil(quantity / (availablePacks[0]?.unitsPerPack || 10)))
                                    .map((pack) => (
                                        <div key={pack.id} className="bg-white border-l-4 border-l-emerald-500 rounded-r-lg p-3 shadow-sm flex justify-between items-center animate-in fade-in slide-in-from-right-2">
                                            <div>
                                                <div className="font-bold text-slate-800 text-sm">Lot {pack.batchNumber}</div>
                                                <div className="text-xs text-slate-400">Exp: {safeFormatDate(pack.expiryDate)}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs font-black text-slate-700">{pack.locationId || 'Stock'}</div>
                                                {dispenseMode === 'UNIT' && <div className="text-[10px] text-amber-600 font-bold">Prélèvement partiel</div>}
                                            </div>
                                        </div>
                                    ))}
                                {availablePacks.length < (dispenseMode === 'BOX' ? quantity : 1) && (
                                    <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm text-center font-medium border border-red-100">
                                        Stock insuffisant pour cette quantité
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-slate-400 text-sm">Stock épuisé pour ce produit.</div>
                        )
                    ) : (
                        <div className="text-center py-8 text-slate-400 text-sm italic">
                            {selectionMode === 'MANUAL' ? 'Sélectionnez les lots manuellement ci-dessous...' : 'Scannez le code DataMatrix sur la boîte...'}
                        </div>
                    )}
                </div>

                {/* Manual Selection Grid */}
                {selectionMode === 'MANUAL' && (
                    <div className="space-y-3">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Lots disponibles (Hôpital)</span>
                        {groupedPacks.length === 0 ? (
                            <div className="text-center py-6 text-slate-400 italic bg-slate-50 rounded-lg">Aucun lot disponible</div>
                        ) : (
                            groupedPacks.map(group => {
                                const selectedCount = manualSelectedPackIds.filter(id => group.packs.some(p => p.id === id)).length;
                                const maxAvailable = group.packs.length;
                                const isFullySelected = selectedCount === maxAvailable;

                                return (
                                    <div
                                        key={group.id}
                                        className={`bg-white border rounded-lg p-3 transition-all ${selectedCount > 0 ? 'border-indigo-500 ring-1 ring-indigo-500 shadow-sm' : 'border-slate-200 hover:border-slate-300'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-slate-800 text-sm">Lot {group.lotNumber}</span>
                                                    {safeGetTime(group.expiryDate) < Date.now() && (
                                                        <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] uppercase font-bold rounded">Expiré</span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-slate-500 mt-1">Exp: {safeFormatDate(group.expiryDate)}</div>
                                                <div className="text-xs text-purple-600 font-medium mt-1">{group.locationId}</div>
                                            </div>
                                            <div className="text-right flex flex-col items-end">
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Dispo</span>
                                                <span className={`text-lg font-black ${safeGetTime(group.expiryDate) < Date.now() ? 'text-slate-400' : 'text-slate-700'}`}>
                                                    {maxAvailable}
                                                </span>
                                            </div>
                                        </div>

                                        <div className={`flex items-center justify-between rounded-lg p-2 bg-slate-50 ${safeGetTime(group.expiryDate) < Date.now() ? 'opacity-50' : ''}`}>
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide pl-1">
                                                {safeGetTime(group.expiryDate) < Date.now() ? 'Expiré' : 'Sélection'}
                                            </span>
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => handleGroupQuantityChange(group.packs, Math.max(0, selectedCount - 1))}
                                                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${selectedCount > 0
                                                        ? 'bg-white border border-slate-200 text-indigo-600 hover:border-indigo-300 shadow-sm'
                                                        : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                                        }`}
                                                    disabled={selectedCount === 0}
                                                >
                                                    -
                                                </button>
                                                <span className={`w-8 text-center font-bold text-lg ${selectedCount > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>
                                                    {selectedCount}
                                                </span>
                                                <button
                                                    onClick={() => !(safeGetTime(group.expiryDate) < Date.now()) && handleGroupQuantityChange(group.packs, Math.min(maxAvailable, selectedCount + 1))}
                                                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${!isFullySelected && !(safeGetTime(group.expiryDate) < Date.now())
                                                        ? 'bg-white border border-slate-200 text-indigo-600 hover:border-indigo-300 shadow-sm'
                                                        : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                                        }`}
                                                    disabled={isFullySelected || safeGetTime(group.expiryDate) < Date.now()}
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>

            {/* Sticky Footer */}
            <div className="p-5 border-t border-slate-100 bg-slate-50/80 backdrop-blur-sm">

                {error && (
                    <div className="mb-4 bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm flex items-center animate-in slide-in-from-bottom-2">
                        <AlertCircle size={16} className="mr-2 shrink-0" />
                        {error}
                    </div>
                )}

                <button
                    onClick={handleDispense}
                    disabled={isSubmitting || (availablePacks.length === 0)}
                    className={`w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 ${isSubmitting || availablePacks.length === 0
                        ? 'bg-slate-300 cursor-not-allowed transform-none shadow-none'
                        : 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400'
                        }`}
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="animate-spin" />
                            Traitement...
                        </>
                    ) : (
                        <>
                            <span>Valider la Dispensation</span>
                            <span className="bg-white/20 px-2 py-0.5 rounded text-sm font-normal">
                                {selectionMode === 'MANUAL' ? manualSelectedPackIds.length : quantity} {dispenseMode === 'BOX' ? 'bte' : 'unt'}
                            </span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};
