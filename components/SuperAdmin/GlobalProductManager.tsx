
import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import { Plus, Search, Package, Edit2, Trash2, Box, X, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { ProductDefinition, ProductType, UnitType, DCI } from '../../types/pharmacy';
import { DCIModal } from './DCIModal';
import { DCISelector } from './DCISelector';

const SearchableSelect = ({
  options,
  value,
  onChange,
  placeholder,
  className = ""
}: {
  options: { value: string, label: string }[],
  value: string,
  onChange: (val: string) => void,
  placeholder?: string,
  className?: string
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.parentElement?.parentElement?.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full">
      <div
        className={`flex items-center justify-between cursor-text bg-white border border-slate-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all ${className}`}
        onClick={() => {
          if (!isOpen) {
            setIsOpen(true);
            setSearchTerm('');
            inputRef.current?.focus();
          }
        }}
      >
        <input
          ref={inputRef}
          type="text"
          className="w-full bg-transparent outline-none truncate placeholder:text-slate-400 px-3 py-2 text-sm"
          placeholder={isOpen ? (options.find(o => o.value === value)?.label || placeholder) : ''}
          value={isOpen ? searchTerm : (options.find(o => o.value === value)?.label || value)}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            setSearchTerm('');
          }}
        />
        <div className="pr-3 flex items-center justify-center">
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2">
          {filteredOptions.length > 0 ? (
            filteredOptions.map(opt => (
              <button
                key={opt.value}
                type="button"
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors ${value === opt.value ? 'bg-blue-50/50 text-blue-700 font-medium' : 'text-slate-700'}`}
                onMouseDown={(e) => {
                  e.preventDefault(); 
                  onChange(opt.value);
                  setIsOpen(false);
                  setSearchTerm('');
                }}
              >
                {opt.label}
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-slate-500 text-center">Aucun résultat</div>
          )}
        </div>
      )}
    </div>
  );
};

export const GlobalProductManager: React.FC = () => {
    const [products, setProducts] = useState<ProductDefinition[]>([]);
    const [dcis, setDcis] = useState<DCI[]>([]); // Store DCIs
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeSearchQuery, setActiveSearchQuery] = useState('');
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [totalItems, setTotalItems] = useState(0); 
    const ITEMS_PER_PAGE = 20;
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<ProductDefinition | null>(null);
    
    // DCI Modal State
    const [isDciModalOpen, setIsDciModalOpen] = useState(false);
    
    // Units & Routes State
    const [units, setUnits] = useState<any[]>([]);
    const [routes, setRoutes] = useState<any[]>([]);
    
    const [formData, setFormData] = useState<Partial<ProductDefinition>>({
        sahtyCode: '',
        code: '',
        name: '',
        type: ProductType.DRUG,
        unit: UnitType.BOX,
        unitsPerBox: 1,
        manufacturer: '',
        description: '',
        dciComposition: [] 
    });
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, [currentPage, activeSearchQuery]); // Reload when page or active query changes
    
    const handleSearch = () => {
        setActiveSearchQuery(searchQuery);
        setCurrentPage(1);
    };

    const handleReset = () => {
        setSearchQuery('');
        setActiveSearchQuery('');
        setCurrentPage(1);
    };

    const loadData = async () => {
        setLoading(true);
        try {
            // Fetch Products (Paginated)
            const productsRes: any = await api.getGlobalProducts({
                page: currentPage,
                limit: ITEMS_PER_PAGE,
                q: activeSearchQuery
            });
            
            if (productsRes.data && Array.isArray(productsRes.data)) {
                setProducts(productsRes.data);
                setTotalPages(productsRes.totalPages || 0);
                setTotalItems(productsRes.total || 0);
            } else {
                setProducts(productsRes);
            }

            // Fetch Units & Routes
            const [unitsRes, routesRes] = await Promise.all([
                api.getGlobalUnits(),
                api.getGlobalRoutes()
            ]);
            setUnits(unitsRes || []);
            setRoutes(routesRes || []);
            
        } catch (e) {
            console.error('Failed to load global data', e);
        } finally {
            setLoading(false);
        }
    };
    
    // Load DCIs for selector (simple fetch all for now or optimize later)
    const loadDciList = async () => {
         try {
             // For the selector we probably need a search-based fetch.
             // But for now let's just fetch first batch or all?
             // If we use paginated API without params, it returns page 1.
             // Existing DCISelector probably expects full list.
             // Let's handle this later. For now, Product list speed is priority.
         } catch(e) {}
    };

    const handleOpenModal = (product?: ProductDefinition) => {
        setError(null);
        if (product) {
            setEditingProduct(product);
            setFormData({ ...product, dciComposition: product.dciComposition || [] });
        } else {
            setEditingProduct(null);
            // Generate temporary Sahty Code
            const tempSahtyCode = 'SAH-' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
            setFormData({
                sahtyCode: tempSahtyCode,
                code: '',
                name: '',
                type: ProductType.DRUG,
                unit: UnitType.BOX,
                unitsPerBox: 1,
                manufacturer: '',
                description: '',
                dciComposition: []
            });
        }
        setIsModalOpen(true);
    };

    const handleDciSuccess = (newDci: DCI) => {
        // Refresh DCI list
        setDcis(prev => [...prev, newDci]);
        
        // Auto-select the new DCI with default dosage
        const currentComposition = formData.dciComposition || [];
        const mgUnit = units.find(u => u.code.toLowerCase() === 'mg') || units[0];
        setFormData({ ...formData, dciComposition: [...currentComposition, { 
            dciId: newDci.id, 
            amount_value: 0, 
            amount_unit_id: mgUnit ? mgUnit.id : '' 
        }] });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        
        // Frontend Validation
        if (formData.type === ProductType.DRUG) {
            if (!formData.dciComposition || formData.dciComposition.length === 0) {
                setError("La sélection d'au moins une DCI est OBLIGATOIRE pour un médicament.");
                return;
            }
            // Check dosages
            for (const item of formData.dciComposition) {
                if (!item.amount_value || item.amount_value <= 0) {
                    setError("La valeur de la quantité doit être supérieure à 0 pour chaque DCI.");
                    return;
                }
                if (!item.amount_unit_id) {
                    setError("L'unité de quantité est obligatoire pour chaque DCI.");
                    return;
                }
            }
        }

        try {
            // Clean payload
            const payload = { ...formData };
            if (payload.type !== ProductType.DRUG) {
                 delete payload.dciComposition; // Remove DCIs if not drug
                 delete payload.brandName;
                 delete payload.marketInfo;
                 delete payload.form;
                 delete payload.presentation;
            }

            if (editingProduct && editingProduct.id) {
                await api.updateGlobalProduct(editingProduct.id, payload);
            } else {
                await api.createGlobalProduct(payload);
            }
            setIsModalOpen(false);
            loadData(); // Reload all data
        } catch (err: any) {
            setError(err.message || 'Une erreur est survenue');
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce produit global ? Cela affectera tous les locataires qui l\'utilisent.')) return;
        try {
            await api.deleteGlobalProduct(id);
            loadData();
        } catch (e: any) {
            alert(e.message || 'Erreur lors de la suppression');
        }
    };

    // Filter Logic Removed (Server-side now)
    // const filteredProducts = ...

    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [priceHistory, setPriceHistory] = useState<any[]>([]);

    const handleOpenHistory = async (productId: string) => {
        try {
            const history = await api.getProductPriceHistory(productId);
            setPriceHistory(history);
            setIsHistoryModalOpen(true);
        } catch (e: any) {
            alert(e.message || 'Impossible de charger l\'historique');
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Chargement...</div>;

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* ... Existing JSX ... */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Package className="text-blue-600" />
                        Catalogue Global des Produits
                    </h1>
                    <p className="text-slate-500">Référentiel unique des produits médicamenteux et dispositifs médicaux</p>
                </div>
                <button 
                    onClick={() => handleOpenModal()}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors shadow-sm"
                >
                    <Plus size={20} />
                    <span>Nouveau Produit</span>
                </button>
            </div>

            {/* Search */}
            <div className="mb-6 relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                    type="text" 
                    placeholder="Rechercher un produit (Code, Nom, Fabricant)..." 
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                     {searchQuery && (
                        <button 
                            onClick={handleReset}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    )}
                    <button 
                        onClick={handleSearch}
                        className="p-1.5 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                    >
                        <Search size={18} />
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4 font-semibold text-slate-700">Code</th>
                            <th className="px-6 py-4 font-semibold text-slate-700">Désignation</th>
                            <th className="px-6 py-4 font-semibold text-slate-700">Type</th>
                            <th className="px-6 py-4 font-semibold text-slate-700">DCI(s)</th>
                            <th className="px-6 py-4 font-semibold text-slate-700">Conditionnement</th>
                            <th className="px-6 py-4 font-semibold text-slate-700 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {products.map(product => (
                            <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-mono text-xs text-slate-500">
                                    {product.sahtyCode}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="font-medium text-slate-900">{product.name}</div>
                                    <div className="text-xs text-slate-500 truncate max-w-xs">{product.description}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                                        ${product.type === ProductType.DRUG ? 'bg-purple-100 text-purple-800' : 
                                          product.type === ProductType.CONSUMABLE ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>
                                        {product.type}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">
                                    {product.dciComposition && product.dciComposition.length > 0 ? (
                                        <div className="flex flex-col gap-1">
                                            {product.dciComposition.map(item => {
                                                const dciName = item.name || dcis.find(d => d.id === item.dciId)?.name || 'DCI Inconnue';
                                                
                                                const amountUnit = units.find(u => u.id === item.amount_unit_id);
                                                const diluentUnit = units.find(u => u.id === item.diluent_volume_unit_id);

                                                let displayStr = '';
                                                if (item.amount_value > 0) {
                                                    displayStr += `${item.amount_value} ${amountUnit?.display || amountUnit?.code || ''}`;
                                                    if (item.diluent_volume_value && diluentUnit) {
                                                        displayStr += ` / ${item.diluent_volume_value} ${diluentUnit.display || diluentUnit.code}`;
                                                    }
                                                }

                                                return (
                                                    <span key={item.dciId} className="text-xs text-slate-600 block">
                                                        <span className="font-medium">{dciName}</span> {displayStr}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    ) : '-'}
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-600">
                                    {product.unit} ({product.unitsPerBox} ut/boîte)
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button 
                                        onClick={() => handleOpenModal(product)}
                                        className="text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50 transition-colors mr-2"
                                        title="Modifier"
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(product.id!)}
                                        className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 transition-colors"
                                        title="Supprimer"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {/* Pagination Controls */}
                 <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                    <div className="text-sm text-slate-500">
                        Affichage de <span className="font-medium">{products.length}</span> sur <span className="font-medium">{totalItems}</span> produits
                    </div>
                    <div className="flex items-center space-x-2">
                        <button 
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-2 rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft size={20} className="text-slate-600" />
                        </button>
                        <span className="text-sm font-medium text-slate-700">
                            Page {currentPage} sur {totalPages || 1}
                        </span>
                        <button 
                             onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                             disabled={currentPage >= totalPages}
                             className="p-2 rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronRight size={20} className="text-slate-600" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl max-w-3xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                             <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <Box className="text-blue-600" />
                                {editingProduct ? 'Modifier le produit global' : 'Nouveau produit global'}
                            </h2>
                             <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={24} />
                            </button>
                        </div>
                        
                        {error && (
                            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* ... Fields ... */}
                            <div className="grid grid-cols-3 gap-4">
                               <div className="col-span-2">
                                    <label className="block text-sm font-medium mb-1 text-slate-700">Désignation Produit <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text" 
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                        value={formData.name}
                                        onChange={e => setFormData({...formData, name: e.target.value})}
                                        required 
                                        placeholder="Ex: Paracétamol 500mg"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700">Type <span className="text-red-500">*</span></label>
                                    <select 
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                        value={formData.type}
                                        onChange={e => setFormData({...formData, type: e.target.value as ProductType})}
                                    >
                                        <option value={ProductType.DRUG}>Médicament</option>
                                        <option value={ProductType.CONSUMABLE}>Consommable</option>
                                        <option value={ProductType.DEVICE}>Dispositif Médical</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700 flex items-center justify-between">
                                        <span>Code Sahty</span>
                                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Généré auto</span>
                                    </label>
                                    <input 
                                        type="text" 
                                        className="w-full border border-slate-300 bg-slate-50 text-slate-500 rounded-lg px-3 py-2 outline-none font-mono"
                                        value={formData.sahtyCode || 'Généré après création'}
                                        readOnly
                                        disabled
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700">Code GTIN (ex-CIP/EAN)</label>
                                    <input 
                                        type="text" 
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                        value={formData.code}
                                        onChange={e => setFormData({...formData, code: e.target.value})}
                                        placeholder="Optionnel"
                                    />
                                </div>
                            </div>

                            {formData.type === ProductType.DRUG && (
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700">Spécialité (Nom commercial)</label>
                                    <input 
                                        type="text" 
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-800"
                                        value={formData.brandName || ''}
                                        onChange={e => setFormData({...formData, brandName: e.target.value})}
                                        placeholder="Ex: DOLIPRANE"
                                    />
                                </div>
                            )}
                            
                            <div>
                                <label className="block text-sm font-medium mb-1 text-slate-700">Fabricant</label>
                                <input 
                                    type="text" 
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                    value={formData.manufacturer}
                                    onChange={e => setFormData({...formData, manufacturer: e.target.value})}
                                />
                            </div>

                            {formData.type === ProductType.DRUG && (
                                <div className="grid grid-cols-2 gap-4">
                                     <div>
                                        <label className="block text-sm font-medium mb-1 text-slate-700">Forme Galénique</label>
                                        <input 
                                            type="text" 
                                            className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                            value={formData.form || ''}
                                            onChange={e => setFormData({...formData, form: e.target.value})}
                                            placeholder="Ex: Comprimé, Sirop..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1 text-slate-700">Conditionnement (Présentation)</label>
                                        <input 
                                            type="text" 
                                            className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                            value={formData.presentation || ''}
                                            onChange={e => setFormData({...formData, presentation: e.target.value})}
                                            placeholder="Ex: BOITE DE 30"
                                        />
                                    </div>
                                </div>
                            )}

                            {formData.type === ProductType.DRUG && (
                                <div className="grid grid-cols-2 gap-4">
                                     <div>
                                        <label className="block text-sm font-medium mb-1 text-slate-700">Unité par Défaut (Prescription)</label>
                                        <SearchableSelect
                                            options={units.map(u => ({ value: u.id, label: u.display || u.code }))}
                                            value={formData.defaultPrescUnit || ''}
                                            onChange={(val) => setFormData({...formData, defaultPrescUnit: val})}
                                            placeholder="Ex: comprimés, mL..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1 text-slate-700">Voie par Défaut (Prescription)</label>
                                        <SearchableSelect
                                            options={routes.filter(r => r.isActive).map(r => ({ value: r.id, label: r.label }))}
                                            value={formData.defaultPrescRoute || ''}
                                            onChange={(val) => setFormData({...formData, defaultPrescRoute: val})}
                                            placeholder="Sélectionner une voie..."
                                        />
                                    </div>
                                </div>
                            )}

                            {formData.type === ProductType.DRUG && (
                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-4">
                                    <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                                        <h3 className="text-sm font-semibold text-slate-900">Infos Spécifiques Maroc</h3>
                                        {editingProduct && (
                                            <button 
                                                type="button"
                                                onClick={() => handleOpenHistory(editingProduct.id!)}
                                                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                                Historique Prix
                                            </button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1 text-slate-700">PPV (Dhs)</label>
                                            <input 
                                                type="number" 
                                                step="0.01"
                                                className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                                value={formData.marketInfo?.ppv || ''}
                                                onChange={e => setFormData({
                                                    ...formData, 
                                                    marketInfo: { ...formData.marketInfo, ppv: parseFloat(e.target.value) }
                                                })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1 text-slate-700">PH (Dhs)</label>
                                            <input 
                                                type="number" 
                                                step="0.01"
                                                className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                                value={formData.marketInfo?.ph || ''}
                                                onChange={e => setFormData({
                                                    ...formData, 
                                                    marketInfo: { ...formData.marketInfo, ph: parseFloat(e.target.value) }
                                                })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1 text-slate-700">PFHT (Dhs)</label>
                                            <input 
                                                type="number" 
                                                step="0.01"
                                                className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                                value={formData.marketInfo?.pfht || ''}
                                                onChange={e => setFormData({
                                                    ...formData, 
                                                    marketInfo: { ...formData.marketInfo, pfht: parseFloat(e.target.value) }
                                                })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {formData.type === ProductType.DRUG && (
                                <DCISelector 
                                    value={formData.dciComposition || []}
                                    onChange={(newComposition) => setFormData({ ...formData, dciComposition: newComposition })}
                                    onAddNew={() => setIsDciModalOpen(true)}
                                    units={units}
                                />
                            )}
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700">Unités par Boîte</label>
                                    <input 
                                        type="number" 
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                        value={formData.unitsPerBox}
                                        onChange={e => setFormData({...formData, unitsPerBox: parseInt(e.target.value)})}
                                        min={1}
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end space-x-3 pt-6 border-t border-slate-100 mt-6">
                                <button 
                                    type="button" 
                                    onClick={() => setIsModalOpen(false)} 
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium"
                                >
                                    Annuler
                                </button>
                                <button 
                                    type="submit" 
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
                                >
                                    {editingProduct ? 'Enregistrer' : 'Créer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            {/* Price History Modal */}
            {isHistoryModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-xl">
                        <div className="flex justify-between items-center mb-6">
                             <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                Historique des Prix
                            </h2>
                             <button onClick={() => setIsHistoryModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={24} />
                            </button>
                        </div>
                        
                        <div className="overflow-hidden rounded-lg border border-slate-200">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold text-slate-700">Date Début</th>
                                        <th className="px-4 py-3 font-semibold text-slate-700">Date Fin</th>
                                        <th className="px-4 py-3 font-semibold text-slate-700 text-right">PPV</th>
                                        <th className="px-4 py-3 font-semibold text-slate-700 text-right">PH</th>
                                        <th className="px-4 py-3 font-semibold text-slate-700 text-right">PFHT</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {priceHistory.length > 0 ? (
                                        priceHistory.map(h => (
                                            <tr key={h.id} className="hover:bg-slate-50">
                                                <td className="px-4 py-3 text-slate-600">
                                                    {new Date(h.validFrom).toLocaleDateString()}
                                                </td>
                                                <td className="px-4 py-3 text-slate-600">
                                                     {h.validTo ? new Date(h.validTo).toLocaleDateString() : <span className="text-green-600 font-medium">Actuel</span>}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono">{h.ppv?.toFixed(2)}</td>
                                                <td className="px-4 py-3 text-right font-mono">{h.ph?.toFixed(2)}</td>
                                                <td className="px-4 py-3 text-right font-mono">{h.pfht?.toFixed(2)}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-8 text-center text-slate-500 italic">
                                                Aucun historique disponible
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        
                        <div className="mt-6 flex justify-end">
                            <button 
                                onClick={() => setIsHistoryModalOpen(false)}
                                className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors font-medium"
                            >
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Shared DCI Modal */}
            <DCIModal 
                isOpen={isDciModalOpen} 
                onClose={() => setIsDciModalOpen(false)} 
                onSuccess={handleDciSuccess} 
            />
        </div>
    );
};

