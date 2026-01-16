
import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Plus, Search, Package, Edit2, Trash2, Box, X } from 'lucide-react';
import { ProductDefinition, ProductType, UnitType, DCI } from '../../types/pharmacy';
import { DCIModal } from './DCIModal';
import { DCISelector } from './DCISelector';

export const GlobalProductManager: React.FC = () => {
    const [products, setProducts] = useState<ProductDefinition[]>([]);
    const [dcis, setDcis] = useState<DCI[]>([]); // Store DCIs
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<ProductDefinition | null>(null);
    
    // DCI Modal State
    const [isDciModalOpen, setIsDciModalOpen] = useState(false);
    
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
    }, []);

    const loadData = async () => {
        try {
            const [productsData, dcisData] = await Promise.all([
                api.getGlobalProducts(),
                api.getGlobalDCIs()
            ]);
            setProducts(productsData);
            setDcis(dcisData);
        } catch (e) {
            console.error('Failed to load global data', e);
        } finally {
            setLoading(false);
        }
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
        setFormData({ ...formData, dciComposition: [...currentComposition, { dciId: newDci.id, dosage: 0, unit: 'mg' }] });
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
                if (!item.dosage || item.dosage <= 0) {
                    setError("Le dosage doit être supérieur à 0 pour chaque DCI.");
                    return;
                }
            }
        }

        try {
            // Clean payload
            const payload = { ...formData };
            if (payload.type !== ProductType.DRUG) {
                 delete payload.dciComposition; // Remove DCIs if not drug
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

    // Filter Logic...

    const filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sahtyCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.manufacturer?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) return <div className="p-8 text-center text-slate-500">Chargement...</div>;

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                {/* ... Header ... */}
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
                />
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
                        {filteredProducts.map(product => (
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
                                                const dci = dcis.find(d => d.id === item.dciId);
                                                return dci ? (
                                                    <span key={item.dciId} className="text-xs text-slate-600">
                                                        <span className="font-medium">{dci.name}</span> {item.dosage}{item.unit}
                                                    </span>
                                                ) : null;
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
                            {/* 1. Désignation & 2. Type */}
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

                            {/* 3. Code Sahty & 4. Code GTIN */}
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

                            {/* Spécialité (Brand Name) */}
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
                            
                            {/* Fabricant (kept as secondary info) */}
                            <div>
                                <label className="block text-sm font-medium mb-1 text-slate-700">Fabricant</label>
                                <input 
                                    type="text" 
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                    value={formData.manufacturer}
                                    onChange={e => setFormData({...formData, manufacturer: e.target.value})}
                                />
                            </div>

                            {/* Maroc Specific Fields */}
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-4">
                                <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2">Infos Spécifiques Maroc</h3>
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

                           {/* DCI Selector - ONLY FOR DRUGS */}
                            {formData.type === ProductType.DRUG && (
                                <DCISelector 
                                    availableDCIs={dcis}
                                    value={formData.dciComposition || []}
                                    onChange={(newComposition) => setFormData({ ...formData, dciComposition: newComposition })}
                                    onAddNew={() => setIsDciModalOpen(true)}
                                />
                            )}
                            
                            {/* Hidden/Defaulted Fields (Unit) */}
                            {/* We removed Unit Selection, default is always Box. We kept Units Per Box as it might still be relevant? 
                                "on suppose qu'un produit est toujours stocké dans une boite."
                                Usually "Units per Box" is still useful to know (e.g. 30 tablets in a box). 
                                I will keep "Unités / Boîte" but remove "Unité de Stock" selector.
                            */}
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

            {/* Shared DCI Modal */}
            <DCIModal 
                isOpen={isDciModalOpen} 
                onClose={() => setIsDciModalOpen(false)} 
                onSuccess={handleDciSuccess} 
            />
        </div>
    );
};

