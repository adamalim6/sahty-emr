
import React, { useState, useMemo } from 'react';
import { ProductDefinition, ProductType, ProductSupplier, Molecule, DosageUnit, PharmacySupplier } from '../../types/pharmacy';
import {
  Plus, Search, Edit2, Trash2, Save, X, Box, Pill, Stethoscope,
  DollarSign, Calculator, ChevronDown, Check
} from 'lucide-react';
import { SearchableSelect } from './SearchableSelect';

interface ProductCatalogProps {
  products: ProductDefinition[];
  suppliers: PharmacySupplier[];
  onAddProduct: (product: ProductDefinition) => void;
  onUpdateProduct: (product: ProductDefinition) => void;
}

export const ProductCatalog: React.FC<ProductCatalogProps> = ({ products, suppliers: globalSuppliers, onAddProduct, onUpdateProduct }) => {
  const [viewMode, setViewMode] = useState<'list' | 'form'>('list');
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState<Partial<ProductDefinition>>({});
  const [activeSupplierId, setActiveSupplierId] = useState<string>('');

  // ... existing code ...
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

  const handleStartCreate = () => {
    setFormData({
      id: `PROD-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`,
      type: ProductType.DRUG,
      suppliers: [],
      molecules: [],
      profitMargin: 20,
      vatRate: 5.5,
      isSubdivisable: false,
      unitsPerPack: 30, // Default meaningful value
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    setViewMode('form');
  };

  const handleEdit = (product: ProductDefinition) => {
    setFormData({ ...product });
    setViewMode('form');
  };

  const handleSave = () => {
    if (!formData.name || !formData.id) {
      alert("Le nom et l'ID du produit sont obligatoires.");
      return;
    }

    if (formData.suppliers && formData.suppliers.length > 0) {
      const hasActive = formData.suppliers.some(s => s.isActive);
      if (!hasActive) {
        formData.suppliers[0].isActive = true;
      }
    }

    // Validation stricte pour les produits subdivisables
    if (formData.isSubdivisable && (!formData.unitsPerPack || formData.unitsPerPack <= 0)) {
      alert("Pour un produit subdivisable, le nombre d'unités par boîte est OBLIGATOIRE et doit être supérieur à 0.");
      return;
    }

    const finalProduct = {
      ...formData,
      subdivisionUnits: formData.unitsPerPack, // Keep for backward compatibility if needed, or remove if strictly following new type
      updatedAt: new Date(),
    } as ProductDefinition;

    const exists = products.find(p => p.id === finalProduct.id);
    if (exists) {
      onUpdateProduct(finalProduct);
    } else {
      onAddProduct(finalProduct);
    }
    setViewMode('list');
  };
  const handleAddSupplier = () => {
    const newSupplier: ProductSupplier = {
      id: `SUP-${Date.now()}`,
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

  const handleAddMolecule = () => {
    const newMol: Molecule = { id: `MOL-${Date.now()}`, name: '' };
    setFormData({ ...formData, molecules: [...(formData.molecules || []), newMol] });
  };

  const updateMolecule = (index: number, name: string) => {
    const newMols = [...(formData.molecules || [])];
    newMols[index].name = name;
    setFormData({ ...formData, molecules: newMols });
  };

  const removeMolecule = (index: number) => {
    const newMols = [...(formData.molecules || [])];
    newMols.splice(index, 1);
    setFormData({ ...formData, molecules: newMols });
  };

  const activePurchasePrice = getActivePrice(formData.suppliers);
  const salePriceHT = calculateSalePriceHT(activePurchasePrice, formData.profitMargin || 0);
  const priceTTC = calculatePriceTTC(salePriceHT, formData.vatRate || 0);
  const unitPriceTTC = calculateUnitPriceTTC(priceTTC, formData.unitsPerPack || 1);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (viewMode === 'list') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm w-full md:w-96 flex items-center">
            <Search className="text-slate-400 mr-2" size={20} />
            <input
              type="text"
              placeholder="Rechercher un produit..."
              className="outline-none w-full text-black bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={handleStartCreate}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium shadow-sm transition-all"
          >
            <Plus size={18} />
            <span>Ajouter Nouveau Produit</span>
          </button>
        </div>

        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map(product => {
            const pPrice = getActivePrice(product.suppliers);
            const pHT = calculateSalePriceHT(pPrice, product.profitMargin);
            const pTTC = calculatePriceTTC(pHT, product.vatRate);

            return (
              <div key={product.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow">
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
                      <div className="text-xs text-slate-400 font-mono">{product.id}</div>
                    </div>
                  </div>
                  <button onClick={() => handleEdit(product)} className="text-slate-400 hover:text-blue-600">
                    <Edit2 size={18} />
                  </button>
                </div>

                <div className="space-y-2 text-sm text-slate-600">
                  <div className="flex justify-between">
                    <span>Type:</span>
                    <span className="font-medium">{product.type}</span>
                  </div>
                  {product.type === ProductType.DRUG && (
                    <div className="flex justify-between">
                      <span>Classe:</span>
                      <span className="font-medium bg-slate-100 px-2 rounded text-xs">{product.therapeuticClass || 'N/A'}</span>
                    </div>
                  )}
                  <div className="border-t border-slate-100 my-2 pt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-400 uppercase">Prix Public (TTC)</span>
                      <span className="font-bold text-lg text-emerald-600">€{pTTC.toFixed(2)}</span>
                    </div>
                    {product.isSubdivisable && (
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-xs text-slate-400">Prix Unitaire ({product.unitsPerPack} unités)</span>
                        <span className="font-mono text-xs text-slate-600">
                          €{calculateUnitPriceTTC(pTTC, product.unitsPerPack || 1).toFixed(3)} /unité
                        </span>
                      </div>
                    )}
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
            {formData.id && products.some(p => p.id === formData.id) ? 'Modifier Produit' : 'Créer Nouveau Produit'}
          </h2>
          <p className="text-slate-500 text-sm">Remplissez les détails ci-dessous pour définir l'entrée du catalogue.</p>
        </div>
        <div className="flex space-x-3">
          <button onClick={() => setViewMode('list')} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors">
            Annuler
          </button>
          <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-bold shadow-sm transition-colors flex items-center space-x-2">
            <Save size={18} />
            <span>Enregistrer</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center">
              <Box className="mr-2 text-blue-500" size={18} /> Informations de Base
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Code Produit (Auto)</label>
                  <input type="text" disabled value={formData.id} className="w-full bg-slate-100 border border-slate-200 rounded px-3 py-2 text-slate-500 font-mono text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Type de Produit</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as ProductType })}
                    className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-black outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    {Object.values(ProductType).map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Nom du Produit</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-black font-medium outline-none focus:ring-2 focus:ring-blue-100 placeholder-slate-400"
                  placeholder="ex: Amoxicilline 500mg"
                />
              </div>
            </div>
          </div>

          {(formData.type === ProductType.DRUG || formData.type === 'Médicament') && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-in fade-in">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center">
                <Stethoscope className="mr-2 text-purple-500" size={18} /> Données Pharmaceutiques
              </h3>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Dosage</label>
                  <input
                    type="number"
                    value={formData.dosage || ''}
                    onChange={(e) => setFormData({ ...formData, dosage: parseFloat(e.target.value) })}
                    className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-black outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Unité</label>
                  <select
                    value={formData.dosageUnit || 'mg'}
                    onChange={(e) => setFormData({ ...formData, dosageUnit: e.target.value as DosageUnit })}
                    className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-black outline-none"
                  >
                    <option value="mg">mg</option>
                    <option value="g">g</option>
                    <option value="ml">ml</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Classe Thérapeutique</label>
                  <input
                    type="text"
                    list="classes"
                    value={formData.therapeuticClass || ''}
                    onChange={(e) => setFormData({ ...formData, therapeuticClass: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-black outline-none"
                  />
                  <datalist id="classes">
                    <option value="Antibiotiques" />
                    <option value="Analgésiques" />
                    <option value="Cardiologie" />
                    <option value="Psychotropes" />
                  </datalist>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Molécules</label>
                {formData.molecules?.map((mol, idx) => (
                  <div key={idx} className="flex space-x-2 mb-2">
                    <input
                      type="text"
                      value={mol.name}
                      onChange={(e) => updateMolecule(idx, e.target.value)}
                      className="flex-1 bg-white border border-slate-300 rounded px-3 py-1 text-sm text-black outline-none"
                      placeholder="Nom de la molécule"
                    />
                    <button onClick={() => removeMolecule(idx)} className="text-red-400 hover:text-red-600">
                      <X size={18} />
                    </button>
                  </div>
                ))}
                <button onClick={handleAddMolecule} className="text-xs text-blue-600 font-medium hover:underline flex items-center">
                  <Plus size={14} className="mr-1" /> Ajouter Molécule
                </button>
              </div>
            </div>
          )}

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 flex items-center">
                <DollarSign className="mr-2 text-emerald-500" size={18} /> Fournisseurs & Coûts
              </h3>
              <button onClick={handleAddSupplier} className="text-xs bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded text-slate-700 font-medium">
                + Ajouter Fournisseur
              </button>
            </div>

            <div className="space-y-3">
              {formData.suppliers?.length === 0 && (
                <p className="text-sm text-slate-400 italic">Aucun fournisseur ajouté.</p>
              )}



              {formData.suppliers?.map((supplier, idx) => {
                const otherSelectedIds = formData.suppliers
                  ?.filter((s, i) => i !== idx && globalSuppliers.some(gs => gs.id === s.id))
                  .map(s => s.id) || [];

                // Prepare options for the searchable select with disabled state logic
                const supplierOptions = globalSuppliers.map(gs => ({
                  value: gs.id,
                  label: gs.name + (otherSelectedIds.includes(gs.id) ? ' (Déjà ajouté)' : ''),
                  disabled: otherSelectedIds.includes(gs.id)
                }));

                const currentValue = globalSuppliers.some(gs => gs.id === supplier.id) ? supplier.id : '';

                return (
                  <div key={idx} className={`flex items-center space-x-3 p-3 rounded-lg border ${supplier.isActive ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                    <input
                      type="radio"
                      checked={supplier.isActive}
                      onChange={() => updateSupplier(idx, 'isActive', true)}
                      className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="flex-1">
                      <SearchableSelect
                        options={supplierOptions}
                        value={currentValue}
                        onChange={(newValue) => {
                          const selectedName = globalSuppliers.find(s => s.id === newValue)?.name || '';

                          // Atomic update
                          const newSuppliers = [...(formData.suppliers || [])];
                          newSuppliers[idx] = {
                            ...newSuppliers[idx],
                            id: newValue,
                            name: selectedName
                          };
                          setFormData({ ...formData, suppliers: newSuppliers });
                        }}
                        placeholder="Sélectionner un fournisseur"
                        className="w-full"
                      />
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="text-slate-400 text-sm">€</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Prix"
                        value={supplier.purchasePrice}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val >= 0) {
                            updateSupplier(idx, 'purchasePrice', val);
                          } else if (e.target.value === '') {
                            updateSupplier(idx, 'purchasePrice', 0);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === '-' || e.key === 'e') {
                            e.preventDefault();
                          }
                        }}
                        className="w-24 bg-white border border-slate-300 rounded px-2 py-1 text-sm text-black font-mono text-right outline-none focus:border-blue-400"
                      />
                    </div>
                    <button onClick={() => removeSupplier(idx)} className="text-slate-400 hover:text-red-500">
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
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val >= 0) {
                        setFormData({ ...formData, profitMargin: val });
                      } else if (e.target.value === '') {
                        setFormData({ ...formData, profitMargin: 0 });
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === '-' || e.key === 'e') {
                        e.preventDefault();
                      }
                    }}
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
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val >= 0) {
                        setFormData({ ...formData, vatRate: val });
                      } else if (e.target.value === '') {
                        setFormData({ ...formData, vatRate: 0 });
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === '-' || e.key === 'e') {
                        e.preventDefault();
                      }
                    }}
                    className="w-20 bg-white border border-white rounded px-2 py-1 text-right text-black font-bold text-sm outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              </div>

              <div className="bg-blue-600 rounded-lg p-3 flex justify-between items-center mt-4">
                <span className="font-bold text-sm">PRIX FINAL (TTC)</span>
                <span className="font-bold text-xl font-mono">€{priceTTC.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center space-x-3 mb-4">
              <input
                type="checkbox"
                id="subdiv"
                checked={formData.isSubdivisable}
                onChange={(e) => setFormData({ ...formData, isSubdivisable: e.target.checked })}
                className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="subdiv" className="font-bold text-slate-800 cursor-pointer select-none">Produit Subdivisable</label>
            </div>

            {formData.isSubdivisable && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Unités par Boîte</label>
                  <input
                    type="number"
                    value={formData.unitsPerPack || ''}
                    onChange={(e) => setFormData({ ...formData, unitsPerPack: parseInt(e.target.value) })}
                    className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-black outline-none focus:border-blue-400"
                    placeholder="ex: 30"
                    min="1"
                    onKeyDown={(e) => {
                      if (e.key === '-' || e.key === 'e') {
                        e.preventDefault();
                      }
                    }}
                  />
                </div>

                <div className="bg-slate-50 p-3 rounded border border-slate-100 flex justify-between items-center">
                  <span className="text-sm text-slate-500">Prix Unitaire (TTC)</span>
                  <span className="font-bold text-slate-800 font-mono">€{unitPriceTTC.toFixed(3)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
