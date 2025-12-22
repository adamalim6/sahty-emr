import React, { useState, useMemo } from 'react';
import { Search, X, AlertTriangle } from 'lucide-react';
import { ProductDefinition, InventoryItem } from '../../types/pharmacy';

interface SubstitutionModalProps {
    isOpen: boolean;
    onClose: () => void;
    originalProductId: string;
    onSelectProduct: (newProductId: string) => void;
    catalog: ProductDefinition[];
    inventory: InventoryItem[];
}

export const SubstitutionModal: React.FC<SubstitutionModalProps> = ({ isOpen, onClose, originalProductId, onSelectProduct, catalog, inventory }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const originalProduct = catalog.find(p => p.id === originalProductId);

    // Filter products:
    // 1. Must be different from original
    // 2. Must match search term
    // 3. OPTIONAL: Should have stock? "afficher uniquement les produits having quantity > 0 dans le Stock Système"
    const availableSubstitutes = useMemo(() => {
        return catalog.filter(product => {
            if (product.id === originalProductId) return false;

            // Stock check
            const hasStock = inventory.some(i => i.productId === product.id && !i.serviceId && i.theoreticalQty > 0);
            if (!hasStock) return false;

            const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesSearch;
        });
    }, [catalog, inventory, originalProductId, searchTerm]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
                <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
                    <div>
                        <h3 className="font-bold text-lg text-slate-800">Substituer un Produit</h3>
                        <p className="text-xs text-slate-500">Remplacement pour : {originalProduct?.name}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                </div>

                <div className="p-4 border-b bg-white">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Rechercher un produit de substitution..."
                            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {availableSubstitutes.length === 0 ? (
                        <div className="text-center py-8 text-slate-400">
                            <AlertTriangle size={32} className="mx-auto mb-2 opacity-50" />
                            <p>Aucun produit disponible en stock pour la substitution.</p>
                        </div>
                    ) : (
                        availableSubstitutes.map(product => {
                            const stock = inventory.filter(i => i.productId === product.id && !i.serviceId).reduce((acc, i) => acc + i.theoreticalQty, 0);
                            return (
                                <button
                                    key={product.id}
                                    onClick={() => onSelectProduct(product.id)}
                                    className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-all group"
                                >
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-slate-700 group-hover:text-blue-700">{product.name}</span>
                                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">Stock: {stock}</span>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>

                <div className="p-4 border-t bg-slate-50 text-right">
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-700 font-medium text-sm">Annuler</button>
                </div>
            </div>
        </div>
    );
};
