import React, { useState, useMemo } from 'react';
import { ProductDefinition, ProductType, ProductSupplier, Molecule, DosageUnit, PharmacySupplier, UnitType } from '../../types/pharmacy';
import {
  Search, Edit2, Save, X, Box, Pill, Stethoscope,
  DollarSign, Calculator, Eye, EyeOff
} from 'lucide-react';
import { SearchableSelect } from './SearchableSelect';

interface ProductCatalogProps {
  products: ProductDefinition[];
  suppliers: PharmacySupplier[];
  onAddProduct: (product: ProductDefinition) => void; // Deprecated/Unused for tenants
  onUpdateProduct: (product: ProductDefinition) => void;
}

export const ProductCatalog: React.FC<ProductCatalogProps> = ({ products, suppliers: globalSuppliers, onUpdateProduct }) => {
  const [viewMode, setViewMode] = useState<'list' | 'form'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [showDisabled, setShowDisabled] = useState(true);

  const [formData, setFormData] = useState<Partial<ProductDefinition>>({});

  const getActivePrice = (suppliers: ProductSupplier[] = []): number => {
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

  const handleSave = () => {
    if (!formData.id) return;

    // Call update - backend will only update config (prices, enabled, suppliers)
    // We pass the full object but backend ignores read-only fields
    onUpdateProduct(formData as ProductDefinition);
    setViewMode('list');
  };

  const handleAddSupplier = () => {
    const newSupplier: ProductSupplier = {
      id: '', // Empty initially
      name: '',
      purchasePrice: 0,
      isActive: (formData.suppliers?.length || 0) === 0
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

    newSuppliers[index] = { ...newSuppliers[index], [field]: value };
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

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code.toLowerCase().includes(searchTerm.toLowerCase()); // Use code
    
    // If searching, ignore visibility toggle (Show all matches)
    if (searchTerm) return matchesSearch;

    const matchesVisibility = showDisabled ? true : p.isEnabled;
    return matchesSearch && matchesVisibility;
  });

  if (viewMode === 'list') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm w-full md:w-96 flex items-center">
            <Search className="text-slate-400 mr-2" size={20} />
            <input
              type="text"
              placeholder="Rechercher (Nom ou Code)..."
              className="outline-none w-full text-black bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex items-center space-x-3">
             <label className="flex items-center space-x-2 text-sm text-slate-600 cursor-pointer select-none">
                <input 
                    type="checkbox" 
                    checked={showDisabled} 
                    onChange={e => setShowDisabled(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Voir produits non activés</span>
             </label>
          </div>
        </div>

        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map(product => {
            const pPrice = getActivePrice(product.suppliers);
            const pHT = calculateSalePriceHT(pPrice, product.profitMargin);
            const pTTC = calculatePriceTTC(pHT, product.vatRate);

            return (
              <div key={product.id} className={`bg-white rounded-xl border shadow-sm p-5 hover:shadow-md transition-shadow relative ${!product.isEnabled ? 'opacity-75 border-slate-200 bg-slate-50' : 'border-slate-200'}`}>
                
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg 
                        ${product.type === ProductType.DRUG ? 'bg-blue-50 text-blue-600' :
                        product.type === ProductType.DEVICE ? 'bg-purple-50 text-purple-600' : 'bg-amber-50 text-amber-600'}`}>
                      {product.type === ProductType.DRUG ? <Pill size={20} /> :
                        product.type === ProductType.DEVICE ? <Stethoscope size={20} /> : <Box size={20} />}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">{product.name}</h3>
                      <div className="text-xs text-slate-400 font-mono">{product.code}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {!product.isEnabled && (
                        <span className="px-2 py-1 bg-slate-100 text-slate-500 text-xs rounded-full font-medium border border-slate-200">
                            Non Activé
                        </span>
                    )}
                    <button onClick={() => handleEdit(product)} className="text-slate-400 hover:text-blue-600 p-1 rounded-full hover:bg-slate-100 transition-colors">
                        <Edit2 size={18} />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-slate-600">
                  <div className="flex justify-between">
                    <span>Type:</span>
                    <span className="font-medium">{product.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Unité:</span>
                    <span className="font-medium">{product.unit} ({product.unitsPerBox})</span>
                  </div>
                  
                  <div className="border-t border-slate-100 my-2 pt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-400 uppercase">Prix Public (TTC)</span>
                      <span className="font-bold text-lg text-emerald-600">€{pTTC.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
             <div className="absolute top-0 right-0 bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500 rounded-bl-lg">
                GLOBAL (Lecture Seule)
             </div>
            <h3 className="font-bold text-slate-800 mb-4 flex items-center">
              <Box className="mr-2 text-slate-500" size={18} /> Informations Produit
            </h3>
            <div className="space-y-4 opacity-80 pointer-events-none">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Code</label>
                  <input type="text" readOnly value={formData.code} className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-600 font-mono text-sm" />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Type</label>
                    <input type="text" readOnly value={formData.type} className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-600 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Nom du Produit</label>
                <input
                  type="text"
                  readOnly
                  value={formData.name || ''}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-800 font-bold"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Unité</label>
                  <input type="text" readOnly value={formData.unit} className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-600 text-sm" />
                </div>
                <div>
                   <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Unités / Boîte</label>
                   <input type="number" readOnly value={formData.unitsPerBox} className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-600 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Fabricant</label>
                <input type="text" readOnly value={formData.manufacturer || '-'} className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-600 text-sm" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-blue-200 shadow-sm ring-1 ring-blue-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-blue-800 flex items-center">
                <DollarSign className="mr-2 text-emerald-500" size={18} /> Vos Fournisseurs & Coûts
              </h3>
              <button onClick={handleAddSupplier} className="text-xs bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded text-blue-700 font-medium transition-colors">
                + Ajouter Fournisseur
              </button>
            </div>

            <div className="space-y-3">
              {formData.suppliers?.length === 0 && (
                <p className="text-sm text-slate-400 italic">Aucun fournisseur configuré. Ajoutez-en un pour définir votre prix d'achat.</p>
              )}

              {formData.suppliers?.map((supplier, idx) => {
                const otherSelectedIds = formData.suppliers
                  ?.filter((s, i) => i !== idx && globalSuppliers.some(gs => gs.id === s.id))
                  .map(s => s.id) || [];

                const supplierOptions = globalSuppliers.map(gs => ({
                  value: gs.id,
                  label: gs.name + (gs.source === 'GLOBAL' ? ' (Global)' : '') + (otherSelectedIds.includes(gs.id) ? ' (Déjà ajouté)' : ''),
                  disabled: otherSelectedIds.includes(gs.id)
                }));

                const currentValue = globalSuppliers.some(gs => gs.id === supplier.id) ? supplier.id : '';

                return (
                  <div key={idx} className={`flex items-center space-x-3 p-3 rounded-lg border ${supplier.isActive ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                    <input
                      type="radio"
                      checked={supplier.isActive}
                      onChange={() => updateSupplier(idx, 'isActive', true)}
                      className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      title="Définir comme fournisseur par défaut"
                    />
                    <div className="flex-1">
                      <SearchableSelect
                        options={supplierOptions}
                        value={currentValue}
                        onChange={(newValue) => {
                          const selectedName = globalSuppliers.find(s => s.id === newValue)?.name || '';
                          const newSuppliers = [...(formData.suppliers || [])];
                          newSuppliers[idx] = { ...newSuppliers[idx], id: newValue, name: selectedName };
                          setFormData({ ...formData, suppliers: newSuppliers });
                        }}
                        placeholder="Sélectionner un fournisseur..."
                        className="w-full"
                      />
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="text-slate-400 text-sm">€</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Prix Achat"
                        value={supplier.purchasePrice}
                        onChange={(e) => updateSupplier(idx, 'purchasePrice', parseFloat(e.target.value))}
                        className="w-24 bg-white border border-slate-300 rounded px-2 py-1 text-sm text-black font-mono text-right outline-none focus:border-blue-400"
                      />
                    </div>
                    <button onClick={() => removeSupplier(idx)} className="text-slate-400 hover:text-red-500 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 text-white p-6 rounded-xl shadow-lg border border-slate-700">
            <h3 className="font-bold mb-4 flex items-center">
              <Calculator className="mr-2 text-blue-400" size={18} /> Simulation Prix
            </h3>

            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Prix Achat Actif</span>
                <span className="font-mono text-slate-200">€{activePurchasePrice.toFixed(2)}</span>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center text-sm">
                  <label className="text-blue-300 font-medium">Marge (%)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.profitMargin}
                    onChange={(e) => setFormData({ ...formData, profitMargin: parseFloat(e.target.value) })}
                    className="w-20 bg-white border border-white rounded px-2 py-1 text-right text-black font-bold text-sm outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-700">
                <span className="text-slate-400">Prix Vente (HT)</span>
                <span className="font-mono font-medium">€{salePriceHT.toFixed(2)}</span>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center text-sm">
                  <label className="text-blue-300 font-medium">TVA (%)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.vatRate}
                    onChange={(e) => setFormData({ ...formData, vatRate: parseFloat(e.target.value) })}
                    className="w-20 bg-white border border-white rounded px-2 py-1 text-right text-black font-bold text-sm outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              </div>

              <div className="bg-blue-600 rounded-lg p-3 flex justify-between items-center mt-4">
                <span className="font-bold text-sm">PRIX FINAL (TTC)</span>
                <span className="font-bold text-xl font-mono">€{priceTTC.toFixed(2)}</span>
              </div>
               <div className="flex justify-between items-center mt-1">
                    <span className="text-xs text-blue-200">Prix Unitaire ({formData.unitsPerBox} ut)</span>
                    <span className="font-mono text-xs text-white">
                        €{unitPriceTTC.toFixed(3)}
                    </span>
                </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="isEnabled"
                checked={formData.isEnabled}
                onChange={(e) => setFormData({ ...formData, isEnabled: e.target.checked })}
                className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="isEnabled" className="font-bold text-slate-800 cursor-pointer select-none">
                 Activer Produit
              </label>
            </div>
            <p className="text-xs text-slate-500 mt-2 ml-8">
                Si désactivé, ce produit ne sera pas visible pour la dispensation ou le réapprovisionnement dans votre pharmacie.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
