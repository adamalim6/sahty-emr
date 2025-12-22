import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { ProductDefinition, ReplenishmentRequest, ReplenishmentStatus, StockLocation } from '../../types/pharmacy';
import { Plus, Search, ShoppingCart, MapPin, X, Save, Check } from 'lucide-react';

interface CartItem {
    product: ProductDefinition;
    quantity: number;
    targetLocationId: string;
}

export const ReplenishmentPage: React.FC = () => {
    const [catalog, setCatalog] = useState<ProductDefinition[]>([]);
    const [locations, setLocations] = useState<StockLocation[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [catalogData, locationsData] = await Promise.all([
                api.getCatalog(),
                api.getEmrLocations()
            ]);
            setCatalog(catalogData);
            setLocations(locationsData);
        } catch (error) {
            console.error("Failed to load data", error);
        } finally {
            setLoading(false);
        }
    };

    const addToCart = (product: ProductDefinition) => {
        if (cart.find(item => item.product.id === product.id)) return;
        setCart([...cart, {
            product,
            quantity: 1,
            targetLocationId: locations.length > 0 ? locations[0].id : ''
        }]);
    };

    const removeFromCart = (productId: string) => {
        setCart(cart.filter(item => item.product.id !== productId));
    };

    const updateCartItem = (productId: string, updates: Partial<CartItem>) => {
        setCart(cart.map(item =>
            item.product.id === productId ? { ...item, ...updates } : item
        ));
    };

    const handleBulkLocationAssign = (locationId: string) => {
        setCart(cart.map(item => ({ ...item, targetLocationId: locationId })));
    };

    const handleSubmit = async () => {
        if (cart.length === 0) return;
        setSubmitting(true);
        try {
            const request: Partial<ReplenishmentRequest> = {
                requesterId: 'CURRENT_USER', // TODO: Get from context
                requesterName: 'Infirmier EMR', // TODO: Get from context
                serviceName: 'Service Médecine', // TODO: Get from context
                status: ReplenishmentStatus.PENDING,
                items: cart.map(item => ({
                    productId: item.product.id,
                    productName: item.product.name,
                    quantityRequested: item.quantity,
                    targetLocationId: item.targetLocationId
                }))
            };

            await api.createReplenishmentRequest(request);
            setSuccessMessage("Demande envoyée avec succès !");
            setCart([]);
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (error) {
            console.error("Failed to create request", error);
            alert("Erreur lors de l'envoi de la demande.");
        } finally {
            setSubmitting(false);
        }
    };

    const filteredCatalog = catalog.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return <div className="p-8 text-center">Chargement...</div>;

    return (
        <div className="flex h-full gap-6 p-6 bg-slate-50">
            {/* Catalog Section */}
            <div className="flex-1 flex flex-col min-w-0 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                    <h2 className="text-lg font-semibold text-slate-800 mb-4">Catalogue Pharmacie</h2>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Rechercher un produit..."
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {filteredCatalog.map(product => {
                        const inCart = cart.some(item => item.product.id === product.id);
                        return (
                            <div key={product.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-100 transition-colors">
                                <div>
                                    <div className="font-medium text-slate-900">{product.name}</div>
                                    <div className="text-sm text-slate-500">Stock Dispo: {product.currentStock || 'N/A'}</div>
                                </div>
                                <button
                                    onClick={() => addToCart(product)}
                                    disabled={inCart}
                                    className={`p-2 rounded-lg transition-colors ${inCart ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                                >
                                    {inCart ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Cart Section */}
            <div className="w-[400px] flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-2 mb-1">
                        <ShoppingCart className="w-5 h-5 text-slate-700" />
                        <h2 className="text-lg font-semibold text-slate-800">Panier de Commande</h2>
                    </div>
                    <div className="text-sm text-slate-500">{cart.length} articles</div>
                </div>

                {cart.length > 0 && locations.length > 0 && (
                    <div className="px-4 py-3 bg-blue-50/50 border-b border-blue-100 flex items-center justify-between">
                        <span className="text-sm text-blue-700 font-medium">Affecter à tous:</span>
                        <select
                            className="text-sm border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            onChange={(e) => handleBulkLocationAssign(e.target.value)}
                        >
                            <option value="">Sélectionner...</option>
                            {locations.map(loc => (
                                <option key={loc.id} value={loc.id}>{loc.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                            <ShoppingCart className="w-12 h-12 mb-3 opacity-20" />
                            <p>Votre panier est vide</p>
                        </div>
                    ) : (
                        cart.map((item, index) => (
                            <div key={item.product.id} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm relative group">
                                <button
                                    onClick={() => removeFromCart(item.product.id)}
                                    className="absolute right-2 top-2 p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <X className="w-4 h-4" />
                                </button>

                                <div className="font-medium text-slate-900 pr-6 mb-2">{item.product.name}</div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-slate-500 block mb-1">Quantité</label>
                                        <input
                                            type="number"
                                            min="1"
                                            className="w-full text-sm border-slate-200 rounded px-2 py-1"
                                            value={item.quantity}
                                            onChange={(e) => updateCartItem(item.product.id, { quantity: parseInt(e.target.value) || 1 })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 block mb-1">Emplacement</label>
                                        <select
                                            className="w-full text-sm border-slate-200 rounded px-2 py-1"
                                            value={item.targetLocationId}
                                            onChange={(e) => updateCartItem(item.product.id, { targetLocationId: e.target.value })}
                                        >
                                            <option value="">Sélectionner</option>
                                            {locations.map(loc => (
                                                <option key={loc.id} value={loc.id}>{loc.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50">
                    {successMessage && (
                        <div className="mb-3 p-2 bg-green-100 text-green-700 text-sm rounded flex items-center gap-2">
                            <Check className="w-4 h-4" /> {successMessage}
                        </div>
                    )}
                    <button
                        onClick={handleSubmit}
                        disabled={cart.length === 0 || submitting}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors"
                    >
                        {submitting ? 'Envoi...' : <><Save className="w-5 h-5" /> Envoyer la demande</>}
                    </button>
                </div>
            </div>
        </div>
    );
};
