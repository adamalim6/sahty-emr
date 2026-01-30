import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth, UserType } from '../../context/AuthContext';
import { Plus, Search, Trash2, Send, AlertCircle, Box, Pill, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';

interface DemandItem {
    product_id: string;
    product_name: string;
    qty_requested: number;
    unitsPerBox: number;
    unitType: 'BOX' | 'UNIT';
    target_stock_location_id?: string;
}

const DemandBuilder: React.FC = () => {
    const { user } = useAuth();
    const [services, setServices] = useState<any[]>([]);
    const [selectedServiceId, setSelectedServiceId] = useState<string>('');
    const [priority, setPriority] = useState<'ROUTINE' | 'URGENT'>('ROUTINE');
    const [locations, setLocations] = useState<any[]>([]);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [items, setItems] = useState<DemandItem[]>([]);
    
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadServices();
    }, []);

    useEffect(() => {
        if (selectedServiceId) {
            loadLocations(selectedServiceId);
        } else {
            setLocations([]);
        }
    }, [selectedServiceId]);

    const loadServices = async () => {
        try {
            const allServices = await api.getServices();
            // Filter services user has access to
            const userServices = user?.service_ids || [];
            const accessible = allServices.filter((s: any) => userServices.includes(s.id) || user?.user_type === UserType.TENANT_SUPERADMIN);
            setServices(accessible);
            if (accessible.length > 0) setSelectedServiceId(accessible[0].id);
        } catch (error) {
            console.error(error);
            toast.error('Erreur chargement services');
        }
    };
    
    const loadLocations = async (serviceId: string) => {
        try {
            // Fetch locations specifically for this service (accessible to EMR users)
            const locs = await api.getServiceLocations(serviceId);
            setLocations(locs || []);
        } catch (e) {
            console.error("Error loading locations", e);
        }
    };

    const handleSearch = async (term: string) => {
        setSearchTerm(term);
        if (term.length < 2) {
            setSearchResults([]);
            return;
        }
        try {
            const res = await api.getStockDemandCatalog({ q: term, limit: 10, status: 'ACTIVE' });
            setSearchResults(res.data || []);
        } catch (error) {
            console.error(error);
        }
    };

    const addItem = (product: any) => {
        if (items.find(i => i.product_id === product.id)) {
            toast.error('Produit déjà dans la liste');
            return;
        }
        
        const unitsPerBox = product.unitsPerBox || 1;
        // Default location logic: prefer first available or empty
        const defaultLoc = locations.length > 0 ? locations[0].id : undefined;
        
        setItems([...items, { 
            product_id: product.id, 
            product_name: product.name, 
            qty_requested: 1,
            unitsPerBox: unitsPerBox,
            unitType: 'BOX', // Default to BOX as requested
            target_stock_location_id: defaultLoc
        }]);
        setSearchResults([]);
        setSearchTerm('');
    };

    const updateQty = (index: number, qty: number) => {
        const newItems = [...items];
        newItems[index].qty_requested = qty;
        setItems(newItems);
    };

    const updateLocation = (index: number, locationId: string) => {
        const newItems = [...items];
        newItems[index].target_stock_location_id = locationId;
        setItems(newItems);
    };

    const toggleUnitType = (index: number) => {
        const newItems = [...items];
        const current = newItems[index].unitType;
        newItems[index].unitType = current === 'BOX' ? 'UNIT' : 'BOX';
        setItems(newItems);
    };

    const removeItem = (index: number) => {
        const newItems = [...items];
        newItems.splice(index, 1);
        setItems(newItems);
    };

    const handleSubmit = async () => {
        if (!selectedServiceId) {
            toast.error('Veuillez sélectionner un service');
            return;
        }
        if (items.length === 0) {
            toast.error('La liste est vide');
            return;
        }
        // Validate Locations
        if (items.some(i => !i.target_stock_location_id)) {
             toast.error('Veuillez sélectionner un emplacement cible pour tous les produits');
             return;
        }

        setLoading(true);
        try {
            const payload = {
                service_id: selectedServiceId,
                priority: priority,
                items: items.map(i => {
                    // Convert to units if BOX is selected
                    const finalQty = i.unitType === 'BOX' ? (i.qty_requested * i.unitsPerBox) : i.qty_requested;
                    return { 
                        product_id: i.product_id, 
                        qty_requested: finalQty,
                        target_stock_location_id: i.target_stock_location_id
                    };
                }),
                requested_by: user?.username
            };
            
            await api.createStockDemand(payload);
            toast.success('Demande envoyée avec succès');
            setItems([]);
            // Redirect or refresh?
        } catch (error: any) {
            toast.error(error.message || 'Erreur lors de l\'envoi');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-5xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold mb-6 text-slate-800 flex items-center gap-2">
                <Plus className="w-6 h-6 text-blue-600" />
                Nouvelle Demande de Stock
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Service Demandeur</label>
                    <select 
                        value={selectedServiceId}
                        onChange={(e) => setSelectedServiceId(e.target.value)}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">Sélectionner un service...</option>
                        {services.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Priorité</label>
                    <select 
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as any)}
                        className={`w-full p-2 border rounded-lg focus:ring-2 ${priority === 'URGENT' ? 'border-red-300 bg-red-50 text-red-700' : ''}`}
                    >
                        <option value="ROUTINE">Routine</option>
                        <option value="URGENT">URGENT</option>
                    </select>
                </div>
            </div>

            {/* Product Search */}
            <div className="mb-6 relative">
                <label className="block text-sm font-medium text-slate-700 mb-1">Ajouter un produit</label>
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                        <input 
                            type="text"
                            placeholder="Rechercher (DCI, Nom commercial...)"
                            value={searchTerm}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="w-full pl-10 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
                
                {searchResults.length > 0 && (
                    <div className="absolute z-10 w-full bg-white mt-1 border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {searchResults.map(product => (
                            <div 
                                key={product.id}
                                onClick={() => addItem(product)}
                                className="p-3 hover:bg-slate-50 cursor-pointer border-b last:border-0 flex justify-between items-center"
                            >
                                <div>
                                    <div className="font-medium text-slate-800">{product.name}</div>
                                    <div className="text-xs text-slate-500">{product.dci}</div>
                                </div>
                                <Plus className="w-4 h-4 text-blue-600" />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Item List Table */}
            <div className="mb-8 border rounded-lg overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b">
                        <tr>
                            <th className="p-3 font-semibold text-slate-700">Produit</th>
                            <th className="p-3 font-semibold text-slate-700 w-48">Destination</th>
                            <th className="p-3 font-semibold text-slate-700 w-32">Type</th>
                            <th className="p-3 font-semibold text-slate-700 w-32">Quantité</th>
                            <th className="p-3 font-semibold text-slate-700 w-16"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {items.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-slate-400 italic">
                                    Aucun produit ajouté. Utilisez la recherche ci-dessus.
                                </td>
                            </tr>
                        ) : (
                            items.map((item, idx) => (
                                <tr key={item.product_id} className="hover:bg-slate-50 bg-white">
                                    <td className="p-3">
                                        <div className="font-medium text-slate-800">{item.product_name}</div>
                                        <div className="text-xs text-slate-400">
                                            {item.unitsPerBox > 1 ? `1 Boite = ${item.unitsPerBox} Unités` : 'Unitaire'}
                                        </div>
                                    </td>
                                    <td className="p-3">
                                        <div className="relative">
                                            <MapPin className="absolute left-2 top-2.5 w-4 h-4 text-slate-400" />
                                            <select
                                                value={item.target_stock_location_id || ''}
                                                onChange={(e) => updateLocation(idx, e.target.value)}
                                                className="w-full pl-8 p-2 border border-slate-200 rounded-lg text-sm bg-white"
                                            >
                                                {locations.length === 0 && <option value="">Aucun emplacement</option>}
                                                {locations.map(loc => (
                                                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </td>
                                    <td className="p-3">
                                        {item.unitsPerBox > 1 ? (
                                             <button 
                                                onClick={() => toggleUnitType(idx)}
                                                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium border ${
                                                    item.unitType === 'BOX' 
                                                    ? 'bg-blue-50 text-blue-700 border-blue-200' 
                                                    : 'bg-slate-50 text-slate-600 border-slate-200'
                                                }`}
                                             >
                                                {item.unitType === 'BOX' ? (
                                                    <><Box className="w-3.5 h-3.5" /> Boites</>
                                                ) : (
                                                    <><Pill className="w-3.5 h-3.5" /> Unités</>
                                                )}
                                             </button>
                                        ) : (
                                            <span className="text-slate-400 text-xs italic">Unité</span>
                                        )}
                                    </td>
                                    <td className="p-3">
                                        <input 
                                            type="number" 
                                            min="1"
                                            value={item.qty_requested}
                                            onChange={(e) => updateQty(idx, parseInt(e.target.value) || 1)}
                                            className="w-full p-1 border rounded text-center"
                                        />
                                    </td>
                                    <td className="p-3 text-right">
                                        <button 
                                            onClick={() => removeItem(idx)}
                                            className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="flex justify-end pt-4 border-t">
                <button 
                    onClick={handleSubmit}
                    disabled={loading || items.length === 0}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
                >
                    {loading ? 'Envoi...' : (
                        <>
                            <Send className="w-4 h-4" />
                            Envoyer la Demande
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default DemandBuilder;
