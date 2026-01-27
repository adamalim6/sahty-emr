import React, { useState, useEffect, useCallback } from 'react';
import { ProductDefinition, ProductType, ProductSupplier, PharmacySupplier } from '../../types/pharmacy';
import { useAuth } from '../../context/AuthContext';
import {
  Search, Edit2, Save, X, Box, Pill, Stethoscope,
  DollarSign, Calculator, ChevronLeft, ChevronRight, RotateCcw, 
  Plus as PlusIcon, Lock, Info, History, FileText, CheckCircle, Trash2
} from 'lucide-react';
import { SearchableSelect } from './SearchableSelect';
import { api } from '../../services/api';

interface ProductCatalogProps {
  suppliers: PharmacySupplier[];
  onAddProduct: (product: ProductDefinition) => void;
  onUpdateProduct: (product: ProductDefinition) => void;
}

const PriceHistoryModal = ({ supplier, onClose }: { supplier: ProductSupplier, onClose: () => void }) => {
    // Robust Data Preparation (Prevents "Blank Page" crashes from type mismatches)
    const versions = React.useMemo(() => {
        if (!supplier.priceVersions || !Array.isArray(supplier.priceVersions)) return [];
        
        return [...supplier.priceVersions]
            .map(v => {
                // Safe Date Parsing
                let dateObj = new Date(v.validFrom);
                if (isNaN(dateObj.getTime())) dateObj = new Date(); // Fallback safety

                return {
                    ...v,
                    validFromDate: dateObj,
                    // Safe Number Casting (PG returns strings for numeric)
                    purchasePriceVal: Number(v.purchasePrice || 0),
                    salePriceTTCVal: Number(v.salePriceTTC || 0),
                };
            })
            .sort((a, b) => b.validFromDate.getTime() - a.validFromDate.getTime());
    }, [supplier.priceVersions]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <History size={18} className="text-blue-600" />
                        Historique des Prix - {supplier.name}
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>
                <div className="overflow-y-auto p-0">
                    {versions.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 italic">Aucun historique disponible</div>
                    ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold sticky top-0">
                            <tr>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3 text-right">P. Achat</th>
                                <th className="px-4 py-3 text-right">P. Vente</th>
                                <th className="px-4 py-3">Auteur</th>
                                <th className="px-4 py-3">Motif</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {versions.map((v) => (
                                <tr key={v.id} className={`hover:bg-slate-50 transition-colors ${!v.validTo ? "bg-blue-50/30" : ""}`}>
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-slate-700">
                                            {v.validFromDate.toLocaleDateString('fr-FR')}
                                        </div>
                                        <div className="text-[10px] text-slate-400">
                                            {v.validFromDate.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 font-mono text-right">
                                        {v.purchasePriceVal.toFixed(2)} Dhs
                                    </td>
                                    <td className="px-4 py-3 font-mono text-emerald-600 font-medium text-right">
                                        {v.salePriceTTCVal.toFixed(2)} Dhs
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-xs">
                                           {v.createdBy || 'Sys'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-500 italic max-w-[200px] truncate" title={v.reason || v.changeReason}>
                                        {v.reason || v.changeReason || '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    )}
                </div>
                 <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 shadow-sm">
                        Fermer
                    </button>
                </div>
            </div>
        </div>
    );
};

export const ProductCatalog: React.FC<ProductCatalogProps> = ({ suppliers: globalSuppliers, onUpdateProduct }) => {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'list' | 'form'>('list');
  
  // Pagination State
  const [products, setProducts] = useState<ProductDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Search State
  const [searchInput, setSearchInput] = useState(''); // What user types
  const [activeQuery, setActiveQuery] = useState(''); // What we search for

  const [showDisabled, setShowDisabled] = useState(true);

  const [formData, setFormData] = useState<Partial<ProductDefinition>>({});
  
  // New State for History & Prompt
  const [historySupplier, setHistorySupplier] = useState<ProductSupplier | null>(null);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [saveReason, setSaveReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.getCatalog({ 
          page, 
          limit: 20, 
          q: activeQuery,
          status: showDisabled ? 'ALL' : 'ACTIVE',
          _t: Date.now() // Cache Buster 
      });
      if (result.data) {
          setProducts(result.data);
          setTotalPages(result.totalPages);
          setTotalItems(result.total);
      } else {
          // Fallback if API returns array (legacy safety)
          if(Array.isArray(result)) {
             setProducts(result);
             setTotalPages(1);
             setTotalItems(result.length);
          }
      }
    } catch (error) {
      console.error("Error loading catalog:", error);
    } finally {
      setLoading(false);
    }
  }, [page, activeQuery, showDisabled]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleSearchTrigger = () => {
    setActiveQuery(searchInput);
    setPage(1); // Reset to page 1 on search
  };

  const handleResetSearch = () => {
    setSearchInput('');
    setActiveQuery('');
    setPage(1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
        handleSearchTrigger();
    }
  };

  const getActivePrice = (suppliers: ProductSupplier[] = []): number => {
    // Priority: Default > First Active > 0
    const def = suppliers.find(s => s.isDefault);
    if (def) return def.purchasePrice;
    
    const active = suppliers.find(s => s.isActive);
    return active ? active.purchasePrice : 0;
  };

  const calculateSalePriceHT = (purchasePrice: number, margin: number): number => {
    return purchasePrice * (1 + margin / 100);
  };

  const calculatePriceTTC = (salePriceHT: number, vat: number): number => {
    return salePriceHT * (1 + vat / 100);
  };

  const calculateUnitPriceTTC = (priceTTC: number, units: number): number => {
    return units > 0 ? priceTTC / units : 0;
  };

  const handleEdit = (product: ProductDefinition) => {
    setFormData({ ...product });
    setViewMode('form');
  };

  const handleSave = async () => {
    if (!formData.id) return;

    // Validation: Cannot save as "Active" if no suppliers/prices configured
    if (formData.isEnabled) {
         const hasValidSupplier = formData.suppliers && formData.suppliers.some(s => s.id && s.purchasePrice > 0 && s.isActive);
         if (!hasValidSupplier) {
             alert("Veuillez configurer les prix par fournisseur !");
             return;
         }
    }

    // Detect if prices changed
    const original = products.find(p => p.id === formData.id);
    const isPriceDirty = original && formData.suppliers?.some(s => {
            const orig = original.suppliers?.find((os: any) => os.id === s.id);
            if (!orig) return false; 
            // Check numeric diffs (safety cast)
            return (Number(s.purchasePrice) !== Number(orig.purchasePrice)) ||
                   (Number(s.margin) !== Number(orig.margin)) ||
                   (Number(s.vat) !== Number(orig.vat));
    });

    if (isPriceDirty) {
        setSaveReason('');
        setShowSavePrompt(true);
    } else {
        await executeSave();
    }
  };

  const executeSave = async (reason?: string) => {
      if (!formData.id) return;
      setIsSaving(true);
      try {
          // Embed reason in formData if present, assuming API will pick it up or Parent handles it
          // Note: TypeScript might complain if ProductDefinition doesn't have reason. 
          // We cast to any to pass pure data through.
          await onUpdateProduct({ ...formData, reason } as any);
          
          // CRITICAL FIX: Race Condition Protection
          // Wait 200ms to ensure SQLite WAL flushes and index updates properly before reading back
          await new Promise(resolve => setTimeout(resolve, 200));

          await fetchProducts();
          setViewMode('list');
          setShowSavePrompt(false);
      } finally {
          setIsSaving(false);
      }
  };

  const handleAddSupplier = () => {
    const newSupplier: ProductSupplier = {
      id: '',
      name: '',
      purchasePrice: 0,
      margin: 0,
      vat: 0,
      isActive: true,
      isDefault: (formData.suppliers?.length || 0) === 0,
      priceVersions: []
    };
    setFormData({
      ...formData,
      suppliers: [...(formData.suppliers || []), newSupplier]
    });
  };

  const updateSupplier = (index: number, field: keyof ProductSupplier, value: any) => {
    const newSuppliers = [...(formData.suppliers || [])];
    if (field === 'isActive' && value === true) {
      newSuppliers.forEach(s => s.isActive = false);
    }

    // Morocco Pricing Rules
    const isMorocco = (user as any)?.client_country === 'MAROC';
    const isMedicament = (formData.type as string) === ProductType.DRUG || (formData.type as string) === 'MEDICAMENT' || (formData.type as string) === 'Médicament';
    const ph = formData.marketInfo?.ph;

    // Apply baseline update first
    newSuppliers[index] = { ...newSuppliers[index], [field]: value };
    
    // Then correct if needed
    if (isMorocco && isMedicament && ph && ph > 0) {
        let s = newSuppliers[index];
        
        // 1. Force VAT to 0
        s.vat = 0;

        // 2. Synch Price & Margin
        if (field === 'purchasePrice') {
             // Changing Purchase Price -> Update Margin
             // PH = Sale TTC (since VAT=0)
             // PH = Purchase * (1 + Margin/100)
             if (s.purchasePrice > 0) {
                  const calculatedMargin = ((ph / s.purchasePrice) - 1) * 100;
                  s.margin = parseFloat(calculatedMargin.toFixed(2));
             } else {
                 s.margin = 0;
             }
        } else if (field === 'margin') {
            // Changing Margin -> Update Purchase Price
            // Purchase = PH / (1 + Margin/100)
            const marginFactor = 1 + (s.margin || 0) / 100;
            if (marginFactor !== 0) {
                 const calculatedPurchase = ph / marginFactor;
                 s.purchasePrice = parseFloat(calculatedPurchase.toFixed(2));
            }
        } else {
             // Any other change (or init) -> Ensure consistency if values present
             // Default to preserving Purchase Price and calculating Margin if mismatched?
             // Or strict lock. Let's just re-run Purchase Price logic to ensure sync
             // But checking specifically for VAT change or Init
             if (s.purchasePrice > 0) {
                  // Re-calc margin to match PH
                  const calculatedMargin = ((ph / s.purchasePrice) - 1) * 100;
                  s.margin = parseFloat(calculatedMargin.toFixed(2));
             }
        }
        }

    // 3. Update Derived Values (HT, TTC)
    const updatedS = newSuppliers[index];
    const purchase = parseFloat(updatedS.purchasePrice as any) || 0;
    const margin = parseFloat(updatedS.margin as any) || 0;
    const vat = parseFloat(updatedS.vat as any) || 0;

    const derivedHT = purchase * (1 + margin / 100);
    const derivedTTC = derivedHT * (1 + vat / 100);
    
    updatedS.salePriceHT = parseFloat(derivedHT.toFixed(2));
    updatedS.salePriceTTC = parseFloat(derivedTTC.toFixed(2));

    setFormData({ ...formData, suppliers: newSuppliers });
  };

  const removeSupplier = (index: number) => {
    const newSuppliers = [...(formData.suppliers || [])];
    newSuppliers.splice(index, 1);
    if (newSuppliers.length > 0 && !newSuppliers.some(s => s.isActive)) {
      newSuppliers[0].isActive = true;
    }
    setFormData({ ...formData, suppliers: newSuppliers });
  };

  const activePurchasePrice = getActivePrice(formData.suppliers);
  const salePriceHT = calculateSalePriceHT(activePurchasePrice, formData.profitMargin || 0);
  const priceTTC = calculatePriceTTC(salePriceHT, formData.vatRate || 0);
  const unitPriceTTC = calculateUnitPriceTTC(priceTTC, formData.unitsPerBox || 1);

  // Use products directly as server handles filtering
  const visibleProducts = products;

  if (viewMode === 'list') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center space-x-2 w-full md:w-auto">
             <div className="relative flex-1 md:w-96">
                <input
                  type="text"
                  placeholder="Rechercher (Nom ou Code)..."
                  className="w-full pl-4 pr-10 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                {searchInput && (
                    <button 
                        onClick={handleResetSearch} 
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                        <X size={16} />
                    </button>
                )}
             </div>
             <button 
                onClick={handleSearchTrigger}
                className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors"
                title="Rechercher"
            >
                <Search size={20} />
             </button>
          </div>
          
          <div className="flex items-center space-x-3 bg-white p-2 rounded-lg border border-slate-200">
             <label className="flex items-center space-x-2 text-sm text-slate-600 cursor-pointer select-none">
                <span className="text-xs font-semibold uppercase text-slate-500 mr-2">Affichage</span>
                <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                    <input 
                        type="checkbox" 
                        name="toggle" 
                        id="toggle" 
                        checked={showDisabled}
                        onChange={e => setShowDisabled(e.target.checked)}
                        className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 right-5"
                        style={{ top: 0, transition: 'right 0.2s' }}
                    />
                    <label 
                        htmlFor="toggle" 
                        className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer ${showDisabled ? 'bg-blue-500' : 'bg-slate-300'}`}
                    ></label>
                </div>
                <span>Inactifs</span>
             </label>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
             <div className="p-12 flex justify-center text-slate-500">
                 Chargement...
             </div>
          ) : (
          <>
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-semibold tracking-wider">
              <tr>
                <th className="px-6 py-4">Statut</th>
                <th className="px-6 py-4">Code</th>
                <th className="px-6 py-4">Produit</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleProducts.map(product => {
                return (
                  <tr 
                    key={product.id} 
                    className={`hover:bg-slate-50 transition-colors ${!product.isEnabled ? 'bg-slate-50/50' : ''}`}
                  >
                    <td className="px-6 py-4">
                      {product.isEnabled ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                           Actif
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500">
                           Inactif
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                       <div className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded w-fit">
                          {product.sahtyCode || product.code || '-'}
                       </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg flex-shrink-0
                            ${product.type === ProductType.DRUG ? 'bg-blue-50 text-blue-600' :
                            product.type === ProductType.DEVICE ? 'bg-purple-50 text-purple-600' : 'bg-amber-50 text-amber-600'}`}>
                          {product.type === ProductType.DRUG ? <Pill size={16} /> :
                            product.type === ProductType.DEVICE ? <Stethoscope size={16} /> : <Box size={16} />}
                        </div>
                        <div>
                           <div className="font-bold text-slate-800 text-sm">{product.name}</div>
                           <span className="text-xs text-slate-400">{product.type}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                       <button 
                          onClick={() => handleEdit(product)} 
                          className="bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 p-2 rounded-lg transition-all shadow-sm group"
                          title="Configurer ce produit"
                        >
                          <Edit2 size={16} className="group-hover:scale-110 transition-transform" />
                       </button>
                    </td>
                  </tr>
                );
              })}
              {visibleProducts.length === 0 && (
                  <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400 bg-slate-50/50 italic">
                          Aucun produit trouvé.
                      </td>
                  </tr>
              )}
            </tbody>
          </table>
          <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-sm text-slate-500">
                  Affichage de <span className="font-bold">{visibleProducts.length}</span> sur <span className="font-bold">{totalItems}</span> produits
              </div>
              <div className="flex items-center space-x-2">
                  <button 
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-2 border border-slate-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                      <ChevronLeft size={16} />
                  </button>
                  <span className="text-sm font-medium text-slate-600">
                      Page {page} sur {totalPages}
                  </span>
                  <button 
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="p-2 border border-slate-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                      <ChevronRight size={16} />
                  </button>
              </div>
          </div>
          </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-right duration-200">

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Configuration du Produit
          </h2>
          <p className="text-slate-500 text-sm">Définissez vos conditions d'achat et la visibilité locale.</p>
        </div>
        <div className="flex space-x-3">
          <button onClick={() => setViewMode('list')} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors">
            Annuler
          </button>
          <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-bold shadow-sm transition-colors flex items-center space-x-2">
            <Save size={18} />
            <span>Enregistrer Config</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        
        {/* 1. HEADER & ACTIVATE TOGGLE */}
        <div className="bg-slate-50 p-6 border-b border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <div className="flex items-center gap-3 mb-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                        formData.type === ProductType.DRUG ? 'bg-blue-100 text-blue-700 border-blue-200' :
                        formData.type === ProductType.DEVICE ? 'bg-purple-100 text-purple-700 border-purple-200' : 
                        'bg-amber-100 text-amber-700 border-amber-200'
                    }`}>
                        {formData.type}
                    </span>
                    <span className="font-mono text-xs text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {formData.sahtyCode || formData.code}
                    </span>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 leading-tight">
                    {formData.name}
                </h2>
                {formData.brandName && (
                    <div className="text-sm font-medium text-slate-500 mt-1">
                        Spécialité: <span className="text-slate-700">{formData.brandName}</span>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-4 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                <div className="flex flex-col items-end mr-2">
                    <label htmlFor="isEnabled" className="text-sm font-bold text-slate-800 cursor-pointer select-none">
                        Produit Actif
                    </label>
                    <span className="text-[10px] text-slate-400">
                        {formData.isEnabled ? 'Visible en stock' : 'Masqué partout'}
                    </span>
                </div>
                <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out">
                    <input
                        type="checkbox"
                        id="isEnabled"
                        checked={formData.isEnabled}
                        onChange={(e) => {
                            const newValue = e.target.checked;
                            if (newValue) {
                                // Validation Rule: Must have at least 1 supplier with valid price
                                const hasValidSupplier = formData.suppliers && formData.suppliers.some(s => s.purchasePrice > 0);
                                if (!hasValidSupplier) {
                                    alert("Impossible d'activer ce produit : Vous devez ajouter au moins un fournisseur et définir un prix d'achat.");
                                    return;
                                }
                            }
                            setFormData({ ...formData, isEnabled: newValue });
                        }}
                        className="peer absolute block w-6 h-6 rounded-full bg-white border-4 border-slate-300 appearance-none cursor-pointer checked:right-0 right-6 checked:border-emerald-500 mb-0"
                        style={{ top: 0, transition: 'all 0.3s' }}
                    />
                    <label 
                        htmlFor="isEnabled" 
                        className={`block overflow-hidden h-6 rounded-full cursor-pointer transition-colors duration-300 ${formData.isEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                    ></label>
                </div>
            </div>
        </div>

        {/* 2. INFO GRID: SPECS vs MARKET (ONLY FOR DRUGS) */}
        {((formData.type as string) === ProductType.DRUG || (formData.type as string) === 'MEDICAMENT' || (formData.type as string) === 'Médicament' || (formData.type as string) === 'DRUG') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            
            {/* LEFT: Technical Specs */}
            <div className="lg:col-span-2 p-6 space-y-6">
                 <h3 className="font-bold text-slate-800 flex items-center text-sm uppercase tracking-wide mb-4">
                    <Box className="mr-2 text-slate-400" size={16} /> Fiche Technique (Global)
                </h3>
                
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                     <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Forme</label>
                        <div className="text-sm font-medium text-slate-700">{formData.form || '-'}</div>
                     </div>
                     <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Conditionnement</label>
                        <div className="text-sm font-medium text-slate-700">{formData.presentation || '-'}</div>
                     </div>
                     <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Unités / Boîte</label>
                        <div className="text-sm font-medium text-slate-700">{formData.unitsPerBox}</div>
                     </div>
                     <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Fabricant</label>
                        <div className="text-sm font-medium text-slate-700">{formData.manufacturer || '-'}</div>
                     </div>
                </div>

                {/* DCI Strip */}
                {formData.dciComposition && formData.dciComposition.length > 0 && (
                     <div className="bg-slate-50 rounded border border-slate-100 p-3">
                         <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Composition DCI</label>
                         <div className="flex flex-wrap gap-2">
                            {formData.dciComposition.map((comp, i) => (
                                <div key={i} className="flex items-center text-xs bg-white border border-slate-200 rounded px-2 py-1 shadow-sm">
                                    <span className="font-semibold text-slate-700 mr-1">{comp.name}</span>
                                    <span className="text-slate-500 bg-slate-50 px-1 rounded">{comp.dosage} {comp.unit}</span>
                                </div>
                            ))}
                         </div>
                     </div>
                )}
            </div>

            {/* RIGHT: Market Context */}
            <div className="bg-slate-50/50 p-6">
                <h3 className="font-bold text-slate-800 flex items-center text-sm uppercase tracking-wide mb-4">
                    <DollarSign className="mr-2 text-emerald-500" size={16} /> Données Marché
                </h3>
                
                 {formData.marketInfo ? (
                    <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-white rounded border border-slate-200 shadow-sm">
                            <span className="text-xs font-bold text-slate-500 uppercase">Prix Public (PPV)</span>
                            <span className="font-mono font-bold text-slate-800">{formData.marketInfo.ppv?.toFixed(2)} Dhs</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-emerald-50 rounded border border-emerald-100 shadow-sm ring-1 ring-emerald-500/20">
                            <span className="text-xs font-bold text-emerald-700 uppercase">Prix Hospitalier (PH)</span>
                            <span className="font-mono font-bold text-emerald-800 text-lg">{formData.marketInfo.ph?.toFixed(2)} Dhs</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-white rounded border border-slate-200 shadow-sm opacity-75">
                            <span className="text-xs font-bold text-slate-400 uppercase">Prix Fab. HT (PFHT)</span>
                            <span className="font-mono font-medium text-slate-600">{formData.marketInfo.pfht?.toFixed(2)} Dhs</span>
                        </div>
                    </div>
                 ) : (
                     <div className="text-sm text-slate-400 italic text-center py-4">
                         Aucune donnée marché disponible.
                     </div>
                 )}
            </div>
        </div>
        )}

        {/* 3. PRICING CARDS - REDESIGNED */}
        <div className="border-t border-slate-200 bg-slate-50 p-6">
             <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="font-bold text-lg text-slate-900 flex items-center">
                        Tarification & Fournisseurs
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                        Gérez les prix d'achat et les marges par fournisseur.
                    </p>
                </div>
                <button 
                    onClick={handleAddSupplier} 
                    className="flex items-center space-x-2 text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-sm transition-colors font-medium"
                >
                    <PlusIcon size={16} />
                    <span>Ajouter un Fournisseur</span>
                </button>
            </div>

            {/* Price Version Warning */}
            {(() => {
                const original = products.find(p => p.id === formData.id);
                const isPriceDirty = original && formData.suppliers?.some(s => {
                     const orig = original.suppliers?.find((os: any) => os.id === s.id);
                     if (!orig) return false; 
                     return (s.purchasePrice !== orig.purchasePrice) ||
                            (s.margin !== orig.margin) ||
                            (s.vat !== orig.vat);
                });

                if (isPriceDirty) {
                    return (
                        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start text-blue-800 shadow-sm">
                            <Info className="flex-shrink-0 mr-3 mt-0.5" size={20} />
                            <div className="text-sm">
                                <strong className="font-bold">Modification de prix détectée</strong>
                                <p className="mt-1 opacity-90">Une nouvelle version du prix sera créée lors de l'enregistrement. L'historique des anciens prix sera conservé.</p>
                            </div>
                        </div>
                    );
                }
                return null;
            })()}

            <div className="space-y-4">
                {formData.suppliers?.length === 0 && (
                    <div className="px-6 py-12 text-center border-2 border-dashed border-slate-300 rounded-xl bg-slate-50/50">
                        <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Box size={24} />
                        </div>
                        <p className="text-slate-500 font-medium">Aucun fournisseur configuré</p>
                        <p className="text-xs text-slate-400 mt-1">Cliquez sur "Ajouter un Fournisseur" pour commencer.</p>
                    </div>
                )}

                {formData.suppliers?.map((supplier, idx) => {
                     const originalProduct = products.find(p => p.id === formData.id);
                     // A supplier is persisted if it exists in the original product's supplier list
                     const isPersisted = originalProduct?.suppliers?.some(os => os.id === supplier.id);

                     const otherSelectedIds = formData.suppliers
                        ?.filter((s, i) => i !== idx && globalSuppliers.some(gs => gs.id === s.id))
                        .map(s => s.id) || [];

                    const isMorocco = (user as any)?.client_country === 'MAROC';
                    const isMedicament = (formData.type as string) === ProductType.DRUG || (formData.type as string) === 'MEDICAMENT' || (formData.type as string) === 'Médicament';
                    const ph = formData.marketInfo?.ph;
                    const isLocked = isMorocco && isMedicament && ph && ph > 0;

                    const pPrice = supplier.purchasePrice || 0;
                    const margin = supplier.margin || 0;
                    const vat = isLocked ? 0 : (supplier.vat || 0);
                    
                    let saleHT = calculateSalePriceHT(pPrice, margin);
                    let saleTTC = calculatePriceTTC(saleHT, vat);

                    if (isLocked) {
                        saleTTC = ph;
                        saleHT = ph; // Since VAT is 0
                    }

                    const supplierOptions = globalSuppliers.map(gs => ({
                        value: gs.id,
                        label: gs.name,
                        disabled: otherSelectedIds.includes(gs.id)
                    }));
                    const currentValue = globalSuppliers.some(gs => gs.id === supplier.id) ? supplier.id : '';

                    return (
                        <div key={idx} className={`bg-white rounded-xl border transition-all duration-200 overflow-hidden
                            ${supplier.isActive ? 'border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300' : 'border-slate-100 bg-slate-50 opacity-75 grayscale-[0.5]'}`}>
                            
                            {/* Card Header: Supplier Identity & Controls */}
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border-b border-slate-100 bg-slate-50/50 gap-4">
                                <div className="flex-1 w-full sm:w-auto">
                                    {isPersisted ? (
                                        <div className="flex items-center space-x-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                                                {supplier.name.charAt(0)}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-800 text-base">{supplier.name}</h4>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                     <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                                        Fournisseur Enregistré
                                                     </span>
                                                     {isPersisted && (
                                                         <button
                                                            onClick={() => setHistorySupplier(supplier)}
                                                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                                         >
                                                             <History size={12} /> Historique
                                                         </button>
                                                     )}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="max-w-xs">
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Sélectionner un fournisseur</label>
                                            <SearchableSelect
                                                options={supplierOptions}
                                                value={currentValue}
                                                onChange={(newValue) => {
                                                    const selectedName = globalSuppliers.find(s => s.id === newValue)?.name || '';
                                                    const newSuppliers = [...(formData.suppliers || [])];
                                                    newSuppliers[idx] = { ...newSuppliers[idx], id: newValue, name: selectedName };
                                                    setFormData({ ...formData, suppliers: newSuppliers });
                                                }}
                                                placeholder="Rechercher..."
                                                className="w-full"
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center space-x-4 w-full sm:w-auto justify-end">
                                    {/* Active Toggle */}
                                    <label className="flex items-center cursor-pointer select-none group">
                                        <div className="mr-3 text-right hidden sm:block">
                                            <div className={`text-xs font-bold ${supplier.isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                {supplier.isActive ? 'Actif pour les commandes' : 'Désactivé'}
                                            </div>
                                            <div className="text-[10px] text-slate-400">
                                                {supplier.isActive ? 'Visible dans les appros' : 'Ne sera pas proposé'}
                                            </div>
                                        </div>
                                        <div className="relative">
                                            <input 
                                                type="checkbox" 
                                                checked={supplier.isActive} 
                                                onChange={() => {
                                                    const newSuppliers = [...(formData.suppliers || [])];
                                                    newSuppliers[idx].isActive = !newSuppliers[idx].isActive;
                                                    setFormData({ ...formData, suppliers: newSuppliers });
                                                }}
                                                className="sr-only" 
                                            />
                                            <div className={`block w-10 h-6 rounded-full transition-colors ${supplier.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                            <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${supplier.isActive ? 'translate-x-4' : ''}`}></div>
                                        </div>
                                    </label>

                                    {/* Delete Button - ONLY for NEW suppliers */}
                                    {!isPersisted && (
                                        <div className="pl-4 border-l border-slate-200">
                                            <button 
                                                onClick={() => removeSupplier(idx)}
                                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Supprimer ce fournisseur (Non enregistré)"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Card Body: Pricing Matrix */}
                            <div className="p-4 grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-6 items-end">
                                
                                {/* 1. Purchase Price */}
                                <div className="col-span-1">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                                        Prix Achat (HT)
                                    </label>
                                    <div className="relative group focus-within:ring-2 ring-blue-500 rounded-lg transition-all">
                                        <input
                                            type="number" min="0" step="0.01"
                                            value={supplier.purchasePrice}
                                            onChange={(e) => updateSupplier(idx, 'purchasePrice', parseFloat(e.target.value) || 0)}
                                            className="w-full pl-3 pr-8 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-mono font-bold text-lg outline-none focus:border-blue-500 transition-colors"
                                            placeholder="0.00"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium pointer-events-none">Dhs</span>
                                    </div>
                                </div>

                                {/* 2. Margin */}
                                <div className="col-span-1">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 flex items-center justify-between">
                                        <span>Marge</span>
                                        <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 rounded">%</span>
                                    </label>
                                    <div className="relative">
                                         <input
                                            type="number" step="0.1"
                                            value={supplier.margin || 0}
                                            onChange={(e) => updateSupplier(idx, 'margin', parseFloat(e.target.value) || 0)}
                                            className="w-full px-3 py-2.5 bg-blue-50/30 border border-blue-200 text-blue-700 font-mono font-bold text-lg rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all text-center"
                                        />
                                    </div>
                                </div>

                                {/* 3. Sale HT (Derived) */}
                                <div className="col-span-1 opacity-75">
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">
                                        P. Vente (HT)
                                    </label>
                                    <div className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 text-slate-500 font-mono text-lg rounded-lg text-right">
                                        {saleHT.toFixed(2)}
                                    </div>
                                </div>

                                {/* 4. VAT */}
                                <div className="col-span-1">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 flex items-center justify-between">
                                        <span>TVA</span>
                                        {isLocked && <Lock size={10} className="text-slate-400" />}
                                    </label>
                                    <div className="relative">
                                         <input
                                            type="number" min="0" step="0.1"
                                            readOnly={isLocked}
                                            value={vat}
                                            onChange={(e) => updateSupplier(idx, 'vat', parseFloat(e.target.value) || 0)}
                                            className={`w-full px-3 py-2.5 border rounded-lg font-mono text-lg text-center outline-none transition-colors
                                                ${isLocked 
                                                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' 
                                                    : 'bg-white border-slate-300 text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500'}`}
                                        />
                                        {!isLocked && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs text-xs font-medium pointer-events-none">%</span>}
                                    </div>
                                </div>

                                {/* 5. Sale TTC (Derived - Hero) */}
                                <div className="col-span-2 md:col-span-1">
                                    <label className="block text-xs font-bold text-emerald-600 uppercase mb-1.5">
                                        P. Vente (TTC)
                                    </label>
                                    <div className={`w-full px-3 py-2.5 border rounded-lg font-mono font-bold text-xl text-right shadow-sm flex items-center justify-end gap-2
                                         ${isLocked ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-emerald-50/30 border-emerald-200 text-emerald-700'}`}>
                                        <span>{saleTTC.toFixed(2)}</span>
                                        <span className="text-xs font-medium opacity-60">Dhs</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );

                })}
            </div>
            
            <div className="mt-6 flex gap-3 text-xs text-slate-500 bg-blue-50/50 p-4 rounded-lg border border-blue-100/50">
                 <Calculator size={16} className="text-blue-500 mt-0.5" />
                 <div>
                    <p className="leading-relaxed">
                        Tous les fournisseurs marqués comme <strong>Actifs</strong> seront visibles pour le réapprovisionnement.
                        <br/>Les marges sont calculées automatiquement : <code>P.Vente = P.Achat × (1 + Marge%)</code>
                    </p>
                    { (user as any)?.client_country === 'MAROC' && 
                        <p className="mt-2 text-emerald-700 font-medium flex items-center gap-1">
                             <Lock size={10} /> Mode Maroc : Le prix de vente public (PPM/PH) est verrouillé par la régulation.
                        </p>
                    }
                 </div>
            </div>
        </div>

      </div>

      {/* History Modal */}
      {historySupplier && (
          <PriceHistoryModal supplier={historySupplier as any} onClose={() => setHistorySupplier(null)} />
      )}

      {/* Save Reason Prompt Modal */}
      {showSavePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                    <FileText className="text-blue-600" />
                    Motif de la modification
                </h3>
                <p className="text-slate-500 text-sm mb-4">
                    Vous avez modifié des prix. Veuillez indiquer une raison pour l'historique (ex: "Hausse tarif laboratoire", "Négociation", "Erreur saisie").
                </p>
                <textarea 
                    autoFocus
                    className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px]"
                    placeholder="Saisissez un motif..."
                    value={saveReason}
                    onChange={e => setSaveReason(e.target.value)}
                />
                <div className="flex justify-end space-x-3 mt-6">
                    <button 
                        onClick={() => setShowSavePrompt(false)}
                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                    >
                        Annuler
                    </button>
                    <button 
                        onClick={() => executeSave(saveReason || "Mise à jour tarifaire")}
                        className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-bold shadow-sm transition-colors flex items-center gap-2"
                        disabled={isSaving}
                    >
                        {isSaving ? 'Enregistrement...' : <>
                            <CheckCircle size={16} /> Confirmé
                        </>}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
