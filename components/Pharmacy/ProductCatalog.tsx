import React, { useState, useEffect, useCallback } from 'react';
import { ProductDefinition, ProductType, ProductSupplier, PharmacySupplier } from '../../types/pharmacy';
import { useAuth } from '../../context/AuthContext';
import {
  Search, Edit2, Save, X, Box, Pill, Stethoscope,
  DollarSign, Calculator, ChevronLeft, ChevronRight, RotateCcw, 
  Plus as PlusIcon, Lock, Info, History, FileText, CheckCircle
} from 'lucide-react';
import { SearchableSelect } from './SearchableSelect';
import { api } from '../../services/api';

interface ProductCatalogProps {
  suppliers: PharmacySupplier[];
  onAddProduct: (product: ProductDefinition) => void;
  onUpdateProduct: (product: ProductDefinition) => void;
}

const PriceHistoryModal = ({ supplier, onClose }: { supplier: ProductSupplier, onClose: () => void }) => {
    // Sort versions desc
    const versions = [...(supplier.priceVersions || [])].sort((a, b) => new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime());

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
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
                                <th className="px-4 py-3">P. Achat</th>
                                <th className="px-4 py-3">P. Vente</th>
                                <th className="px-4 py-3">Auteur</th>
                                <th className="px-4 py-3">Motif</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {versions.map((v) => (
                                <tr key={v.id} className={!v.validTo ? "bg-blue-50/30" : ""}>
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-slate-700">
                                            {new Date(v.validFrom).toLocaleDateString('fr-FR')}
                                        </div>
                                        <div className="text-[10px] text-slate-400">
                                            {new Date(v.validFrom).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 font-mono">
                                        {v.purchasePrice.toFixed(2)}
                                    </td>
                                    <td className="px-4 py-3 font-mono text-emerald-600 font-medium">
                                        {v.salePriceTTC.toFixed(2)}
                                    </td>
                                    <td className="px-4 py-3">
                                        {v.createdBy || '-'}
                                    </td>
                                    <td className="px-4 py-3 text-slate-500 italic truncate max-w-[150px]" title={v.reason}>
                                        {v.reason || '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    )}
                </div>
                 <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50">
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
          status: showDisabled ? 'ALL' : 'ACTIVE' 
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

    // Detect if prices changed
    const original = products.find(p => p.id === formData.id);
    const isPriceDirty = original && formData.suppliers?.some(s => {
            const orig = original.suppliers?.find((os: any) => os.id === s.id);
            if (!orig) return false; 
            // Check numeric diffs
            return (s.purchasePrice !== orig.purchasePrice) ||
                   (s.margin !== orig.margin) ||
                   (s.vat !== orig.vat);
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
      isDefault: (formData.suppliers?.length || 0) === 0
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

        {/* 3. PRICING MATRIX TABLE */}
        <div className="border-t border-slate-200 bg-slate-50 p-6">
             <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg text-slate-900 flex items-center">
                    Tarification & Fournisseurs
                </h3>
                <button 
                    onClick={handleAddSupplier} 
                    className="flex items-center space-x-2 text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow-sm transition-colors font-medium"
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
                     if (!orig) return false; // Ignore new suppliers (they are Version 1)
                     return (s.purchasePrice !== orig.purchasePrice) ||
                            (s.margin !== orig.margin) ||
                            (s.vat !== orig.vat);
                });

                if (isPriceDirty) {
                    return (
                        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md flex items-start text-blue-800 mx-1">
                            <Info className="flex-shrink-0 mr-2 mt-0.5" size={18} />
                            <div className="text-sm">
                                <strong>Note : Cette modification créera une nouvelle version du prix pour ce fournisseur.</strong>
                                <br/>Les factures passées et les historiques ne seront pas affectés.
                            </div>
                        </div>
                    );
                }
                return null;
            })()}

            <div className="bg-white border boundary-slate-200 rounded-lg shadow-sm overflow-visible">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                        <tr>
                            <th className="px-4 py-3 text-center w-16">Défaut</th>
                            <th className="px-4 py-3 min-w-[200px]">Fournisseur</th>
                            <th className="px-4 py-3 text-right w-40">P. Achat (HT)</th>
                            <th className="px-4 py-3 text-right w-32">Marge %</th>
                            <th className="px-4 py-3 text-right w-32 bg-slate-50/80 text-slate-400">P. Vente HT</th>
                            <th className="px-4 py-3 text-right w-24">TVA %</th>
                            <th className="px-4 py-3 text-right w-40 text-emerald-700">P. Vente TTC</th>
                            <th className="px-4 py-3 w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {formData.suppliers?.length === 0 && (
                            <tr>
                                <td colSpan={8} className="px-6 py-8 text-center text-slate-400 italic">
                                    Aucun fournisseur configuré. Cliquez sur "Ajouter" pour commencer.
                                </td>
                            </tr>
                        )}
                        {formData.suppliers?.map((supplier, idx) => {
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
                                <tr key={idx} className={`group hover:bg-slate-50 transition-colors ${supplier.isDefault ? 'bg-emerald-50/30' : ''}`}>
                                    <td className="px-4 py-3 text-center align-middle">
                                         <input
                                            type="radio"
                                            name="defaultSupplier"
                                            checked={!!supplier.isDefault}
                                            onChange={() => {
                                                const newS = formData.suppliers?.map((s, i) => ({ ...s, isDefault: i === idx })) || [];
                                                setFormData({ ...formData, suppliers: newS });
                                            }}
                                            className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                            title="Définir comme fournisseur principal"
                                        />
                                    </td>
                                    <td className="px-4 py-3 align-middle">
                                         <SearchableSelect
                                            options={supplierOptions}
                                            value={currentValue}
                                            onChange={(newValue) => {
                                                const selectedName = globalSuppliers.find(s => s.id === newValue)?.name || '';
                                                const newSuppliers = [...(formData.suppliers || [])];
                                                newSuppliers[idx] = { ...newSuppliers[idx], id: newValue, name: selectedName };
                                                setFormData({ ...formData, suppliers: newSuppliers });
                                            }}
                                            placeholder="Choisir..."
                                            className="w-full text-sm"
                                        />
                                    </td>
                                    <td className="px-4 py-3 align-middle">
                                        <div className="relative">
                                            <input
                                                type="number" min="0" step="0.01"
                                                value={supplier.purchasePrice}
                                                onChange={(e) => updateSupplier(idx, 'purchasePrice', parseFloat(e.target.value) || 0)}
                                                className="w-full pl-8 pr-2 py-1.5 border border-slate-300 rounded text-right font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 align-middle">
                                        <div className="relative">
                                             <input
                                                type="number" step="0.1"
                                                value={supplier.margin || 0}
                                                onChange={(e) => updateSupplier(idx, 'margin', parseFloat(e.target.value) || 0)}
                                                className="w-full text-right border border-blue-200 bg-blue-50/20 text-blue-700 font-bold rounded px-2 pr-6 py-1.5 text-sm font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">%</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 align-middle text-right">
                                         <div className="text-sm font-mono text-slate-500 bg-slate-100/50 px-2 py-1.5 rounded border border-transparent">
                                            {saleHT.toFixed(2)}
                                         </div>
                                    </td>
                                    <td className="px-4 py-3 align-middle text-right">
                                         <input
                                            type="number" min="0" step="0.1"
                                            readOnly={isLocked}
                                            value={vat}
                                            onChange={(e) => updateSupplier(idx, 'vat', parseFloat(e.target.value) || 0)}
                                            className={`w-full text-right border rounded px-2 py-1.5 text-sm font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:ring-2 focus:ring-blue-500 outline-none
                                                ${isLocked ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'border-slate-300'}`}
                                        />
                                    </td>
                                    <td className="px-4 py-3 align-middle text-right">
                                         <div className={`text-sm font-bold font-mono px-2 py-1.5 rounded flex items-center justify-end gap-2
                                            ${isLocked ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'text-slate-800'}`}>
                                            {isLocked && <Lock size={12} className="opacity-50" />}
                                            {saleTTC.toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">Dhs</span>
                                         </div>
                                    </td>
                                    <td className="px-4 py-3 align-middle text-center">
                                        <button 
                                            onClick={() => removeSupplier(idx)}
                                            className="text-slate-300 hover:text-red-500 transition-colors p-1"
                                        >
                                            <X size={18} />
                                        </button>
                                        <button 
                                            onClick={() => setHistorySupplier(supplier)}
                                            className="text-blue-300 hover:text-blue-600 transition-colors p-1 ml-1"
                                            title="Voir l'historique des prix"
                                        >
                                            <History size={18} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            
            <div className="mt-4 flex gap-3 text-xs text-slate-500 bg-blue-50/50 p-3 rounded border border-blue-100/50">
                 <Calculator size={14} className="text-blue-500 mt-0.5" />
                 <p>
                    Le prix affiché dans le tableau de bord sera basé sur le fournisseur sélectionné par <strong>Défaut</strong>. 
                    Les marges sont calculées automatiquement en fonction du Prix Achat saisi.
                    { (user as any)?.client_country === 'MAROC' && 
                        <span className="block mt-1 text-emerald-700 font-medium">
                            * Pour les médicaments (Maroc), le prix de vente est automatiquement aligné sur le Prix Hospitalier (PH).
                        </span>
                    }
                 </p>
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
