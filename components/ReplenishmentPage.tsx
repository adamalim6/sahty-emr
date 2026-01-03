import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api'; 
import { Package, Clock, Send, AlertTriangle, CheckCircle, Search, History, Archive, Plus, X, CheckSquare, Square } from 'lucide-react';

interface Service {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  code: string;
  quantity: number; 
}

interface StockLocation {
  id: string;
  name: string;
}

interface RequestItem {
  productId: string;
  productName: string;
  quantity: number;
  targetLocationId: string;
}

export const ReplenishmentPage: React.FC = () => {
  const { user } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  
  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [serviceLocations, setServiceLocations] = useState<StockLocation[]>([]);
  const [requestItems, setRequestItems] = useState<RequestItem[]>([]);
  const [history, setHistory] = useState<any[]>([]); 
  
  // UI State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [modalSelectedIds, setModalSelectedIds] = useState<string[]>([]);
  
  // Fetch Initial Data (Services)
  useEffect(() => {
    const fetchServices = async () => {
      try {
        const allServices = await api.getServices(); 
        const myServices = allServices.filter((s: any) => user?.service_ids?.includes(s.id));
        setServices(myServices);
        
        if (myServices.length > 0) {
          setSelectedServiceId(myServices[0].id);
        }
      } catch (err) {
        console.error("Error fetching services", err);
        setError("Impossible de charger vos services.");
      } finally {
        setLoading(false);
      }
    };
    fetchServices();
  }, [user]);

  // Fetch Context Data when Service Changes
  useEffect(() => {
    if (!selectedServiceId) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      // Reset current list when switching service? - Usually yes to avoid mismatch
      setRequestItems([]);

      try {
        const catalog = await api.getCatalog();
        setProducts(catalog);

        const locs = await api.getLocations(selectedServiceId, 'SERVICE');
        setServiceLocations(locs);

        const reqs = await api.getReplenishmentRequests(); 
        setHistory(reqs.filter((r: any) => r.service_id === selectedServiceId));

      } catch (err) {
        console.error("Error fetching context data", err);
        setError("Erreur lors du chargement des données.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedServiceId]);


  // --- MODAL LOGIC ---

  const handleOpenModal = () => {
      setModalSelectedIds([]); // Reset selection
      setModalSearch('');
      setShowModal(true);
  };

  const toggleProductSelection = (productId: string) => {
      if (modalSelectedIds.includes(productId)) {
          setModalSelectedIds(modalSelectedIds.filter(id => id !== productId));
      } else {
          setModalSelectedIds([...modalSelectedIds, productId]);
      }
  };

  const handleConfirmSelection = () => {
      const newItems: RequestItem[] = modalSelectedIds.map(id => {
          const product = products.find(p => p.id === id);
          return {
              productId: id,
              productName: product?.name || 'Inconnu',
              quantity: 1, // Default
              targetLocationId: '' // User must select
          };
      });

      setRequestItems([...requestItems, ...newItems]);
      setShowModal(false);
  };

  const filteredProducts = useMemo(() => {
      return products.filter(p => 
          p.name.toLowerCase().includes(modalSearch.toLowerCase()) || 
          p.code.toLowerCase().includes(modalSearch.toLowerCase())
      );
  }, [products, modalSearch]);


  // --- LIST LOGIC ---

  const updateItem = (index: number, field: keyof RequestItem, value: any) => {
    const newItems = [...requestItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setRequestItems(newItems);
  };

  const removeItem = (index: number) => {
    setRequestItems(requestItems.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
     if (requestItems.length === 0) return;
     if (!selectedServiceId) return;

     // Validation
     const invalid = requestItems.some(i => !i.productId || !i.targetLocationId || i.quantity <= 0);
     if (invalid) {
         setError("Veuillez remplir correctement toutes les lignes (Quantité et Emplacement sont obligatoires).");
         return;
     }

     try {
       setLoading(true);
       const selectedService = services.find(s => s.id === selectedServiceId);
       
       // Construct User Name correctly based on AuthContext type
       const userName = (user as any).firstName && (user as any).lastName 
           ? `${(user as any).firstName} ${(user as any).lastName}`
           : (user as any).prenom && (user as any).nom 
               ? `${(user as any).prenom} ${(user as any).nom}`
               : (user as any).username || 'Utilisateur';

       await api.createReplenishmentRequest({
         service_id: selectedServiceId,
         serviceName: selectedService?.name || 'Service Inconnu',
         requesterName: userName,
         requesterId: user?.id,
         items: requestItems,
         created_by: user?.id
       });
       setSuccess("Demande envoyée avec succès !");
       setRequestItems([]); 
       // Refresh history
       const reqs = await api.getReplenishmentRequests();
       setHistory(reqs.filter((r: any) => r.service_id === selectedServiceId));
       setActiveTab('history');
     } catch (err) {
       console.error("Error creating request", err);
       setError("Erreur lors de la création de la demande.");
     } finally {
       setLoading(false);
     }
  };

  if (!user) return null;

  return (
    <div className="space-y-6 relative">
      
      {/* Header & Service Selector */}
      <div className="flex justify-between items-center">
        <div>
           <h1 className="text-2xl font-bold text-slate-800">Réapprovisionnement</h1>
           <p className="text-slate-500">Demandes de stock vers la pharmacie centrale.</p>
        </div>
        
        <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm flex items-center space-x-2">
            <span className="text-sm font-medium text-slate-500">Service :</span>
            {services.length > 0 ? (
                <select 
                   value={selectedServiceId}
                   onChange={(e) => setSelectedServiceId(e.target.value)}
                   className="font-bold text-indigo-600 bg-transparent border-none focus:ring-0 cursor-pointer"
                >
                    {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            ) : (
                <span className="text-red-500 font-bold text-sm">Aucun service assigné</span>
            )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center">
            <AlertTriangle className="mr-2" /> {error}
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 text-emerald-600 p-4 rounded-lg flex items-center">
            <CheckCircle className="mr-2" /> {success}
            <button onClick={() => setSuccess(null)} className="ml-auto text-sm underline">Fermer</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-4 border-b border-slate-200">
          <button 
             onClick={() => setActiveTab('new')}
             className={`pb-3 px-2 font-medium transition-colors border-b-2 ${activeTab === 'new' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
             <div className="flex items-center space-x-2">
                <Send size={18} />
                <span>Nouvelle Demande</span>
             </div>
          </button>
          <button 
             onClick={() => setActiveTab('history')}
             className={`pb-3 px-2 font-medium transition-colors border-b-2 ${activeTab === 'history' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
             <div className="flex items-center space-x-2">
                <History size={18} />
                <span>Historique</span>
             </div>
          </button>
      </div>

      {/* NEW REQUEST TAB */}
      {activeTab === 'new' && (
         <div className="space-y-6">
             {services.length === 0 ? (
                 <div className="text-center py-10 text-slate-500">
                     Vous n'êtes assigné à aucun service. Contactez l'administrateur.
                 </div>
             ) : serviceLocations.length === 0 ? (
                 <div className="text-center py-10 text-orange-500 bg-orange-50 rounded-lg border border-orange-100">
                     <AlertTriangle className="mx-auto h-8 w-8 mb-2" />
                     <p className="font-medium">Aucun emplacement de stock configuré pour {services.find(s=>s.id===selectedServiceId)?.name}.</p>
                     <p className="text-sm mt-1">Veuillez configurer les emplacements dans Paramètres de Service.</p>
                 </div>
             ) : (
                <>
                  {/* Action Bar */}
                  <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                      <div className="text-slate-600 font-medium">
                          {requestItems.length === 0 ? 'Aucun produit ajouté' : `${requestItems.length} produit(s) dans la demande`}
                      </div>
                      <button 
                         onClick={handleOpenModal}
                         disabled={products.length === 0}
                         className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors flex items-center shadow-lg shadow-indigo-200 disabled:opacity-50"
                      >
                          <Plus className="mr-2 h-5 w-5" />
                          Ajouter un produit
                      </button>
                  </div>

                  {/* Empty Catalog Warning */}
                  {products.length === 0 && (
                      <div className="bg-yellow-50 text-yellow-800 p-4 rounded-lg flex items-center border border-yellow-200">
                           <AlertTriangle className="mr-2 h-5 w-5" />
                           Aucun produit n'est disponible dans le catalogue de votre établissement.
                      </div>
                  )}

                  {/* Items List */}
                  <div className="space-y-3">
                     {requestItems.map((item, idx) => (
                         <div key={idx} className="flex flex-col md:flex-row md:items-center space-y-3 md:space-y-0 md:space-x-4 bg-white p-5 rounded-xl shadow-sm border border-slate-200 animate-in fade-in slide-in-from-top-2">
                             
                             {/* Product Info */}
                             <div className="flex-1">
                                 <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Produit</label>
                                 <div className="font-semibold text-slate-800 text-lg">{item.productName}</div>
                                 <div className="text-xs text-slate-500">ID: {item.productId}</div>
                             </div>

                             {/* Quantity */}
                             <div className="w-full md:w-32">
                                 <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Quantité</label>
                                 <input 
                                     type="number" 
                                     min="1"
                                     value={item.quantity}
                                     onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value))}
                                     className="w-full rounded-lg border-slate-300 font-medium text-slate-900 focus:border-indigo-500 focus:ring-indigo-500"
                                 />
                             </div>

                             {/* Destination */}
                             <div className="w-full md:w-64">
                                 <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Emplacement de Stock</label>
                                 <select 
                                     value={item.targetLocationId}
                                     onChange={(e) => updateItem(idx, 'targetLocationId', e.target.value)}
                                     className={`w-full rounded-lg text-sm font-medium focus:border-indigo-500 focus:ring-indigo-500 ${!item.targetLocationId ? 'border-red-300 text-slate-500' : 'border-slate-300 text-slate-900'}`}
                                 >
                                    <option value="">-- Sélectionner --</option>
                                    {serviceLocations.map(l => (
                                        <option key={l.id} value={l.id}>{l.name}</option>
                                    ))}
                                 </select>
                             </div>

                             {/* Actions */}
                             <div className="pt-4 md:pt-0">
                                 {/* Spacer label to align with inputs if needed, or simple centered button */}
                                 <button onClick={() => removeItem(idx)} className="text-slate-400 hover:text-red-500 p-2 rounded-full hover:bg-slate-50 transition-colors">
                                     <X size={20} />
                                 </button>
                             </div>
                         </div>
                     ))}
                  </div>

                  {/* Footer Stats & Submit */}
                  {requestItems.length > 0 && (
                      <div className="flex justify-end pt-6">
                           <button 
                              onClick={handleSubmit}
                              disabled={loading || requestItems.some(i => i.quantity <=0 || !i.targetLocationId)}
                              className="px-8 py-3 bg-slate-900 text-white hover:bg-black rounded-xl font-bold text-lg shadow-xl shadow-slate-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-all transform active:scale-95"
                           >
                               {loading ? 'Envoi...' : 'Envoyer la demande'}
                               <Send className="ml-3 h-5 w-5" />
                           </button>
                      </div>
                  )}
                </>
             )}
         </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === 'history' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
               {history.length === 0 ? (
                   <div className="p-10 text-center text-slate-500 italic">Aucune demande trouvée pour ce service.</div>
               ) : (
                   <table className="min-w-full divide-y divide-slate-200">
                       <thead className="bg-slate-50">
                           <tr>
                               <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                               <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Demandeur</th>
                               <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Produits</th>
                               <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Statut</th>
                           </tr>
                       </thead>
                       <tbody className="bg-white divide-y divide-slate-200">
                           {history.map((req: any) => (
                               <tr key={req.id} className="hover:bg-slate-50">
                                   <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                       {new Date(req.created_at || Date.now()).toLocaleDateString()}
                                   </td>
                                   <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 font-medium">
                                       Vous {/* Assuming self for now, or fetch user name map */}
                                   </td>
                                   <td className="px-6 py-4 text-sm text-slate-600">
                                       {req.items?.length || 0} articles
                                   </td>
                                   <td className="px-6 py-4 whitespace-nowrap">
                                       <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${req.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                           {req.status || 'EN_ATTENTE'}
                                       </span>
                                   </td>
                               </tr>
                           ))}
                       </tbody>
                   </table>
               )}
          </div>
      )}


      {/* --- PRODUCT SELECTION MODAL --- */}
      {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setShowModal(false)} />
              
              <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  {/* Modal Header */}
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <div>
                          <h2 className="text-xl font-bold text-slate-800">Sélectionner les produits</h2>
                          <p className="text-sm text-slate-500">Cochez les produits à ajouter à la demande.</p>
                      </div>
                      <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors">
                          <X size={24} />
                      </button>
                  </div>

                  {/* Modal Search */}
                  <div className="p-4 border-b border-slate-100 bg-white sticky top-0 z-10">
                      <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
                          <input 
                              type="text" 
                              placeholder="Rechercher par nom ou code..." 
                              value={modalSearch}
                              onChange={(e) => setModalSearch(e.target.value)}
                              className="w-full pl-10 pr-4 py-3 rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 bg-slate-50"
                              autoFocus
                          />
                      </div>
                  </div>

                  {/* Modal List */}
                  <div className="flex-1 overflow-y-auto p-2">
                       {products.length === 0 ? (
                           <div className="p-10 text-center text-slate-500">Catalogue vide.</div>
                       ) : filteredProducts.length === 0 ? (
                           <div className="p-10 text-center text-slate-500">Aucun produit trouvé.</div>
                       ) : (
                           <div className="space-y-1">
                               {filteredProducts.map(p => {
                                   const isAlreadyAdded = requestItems.some(item => item.productId === p.id);
                                   const isSelected = modalSelectedIds.includes(p.id);

                                   return (
                                       <div 
                                          key={p.id}
                                          onClick={() => !isAlreadyAdded && toggleProductSelection(p.id)}
                                          className={`
                                              group flex items-center p-4 rounded-xl cursor-pointer transition-all border
                                              ${isAlreadyAdded 
                                                  ? 'opacity-50 cursor-not-allowed bg-slate-50 border-transparent' 
                                                  : isSelected 
                                                      ? 'bg-indigo-50 border-indigo-200 shadow-sm' 
                                                      : 'bg-white border-transparent hover:bg-slate-50'
                                              }
                                          `}
                                       >
                                           <div className={`
                                               mr-4 flex-shrink-0 h-6 w-6 rounded-md border flex items-center justify-center transition-colors
                                               ${isAlreadyAdded 
                                                   ? 'bg-slate-200 border-slate-300 text-slate-400' 
                                                   : isSelected 
                                                       ? 'bg-indigo-600 border-indigo-600 text-white' 
                                                       : 'border-slate-300 text-transparent group-hover:border-slate-400'
                                               }
                                           `}>
                                               <CheckSquare size={14} className={isSelected || isAlreadyAdded ? 'opacity-100' : 'opacity-0'} />
                                           </div>
                                           
                                           <div className="flex-1">
                                               <div className={`font-semibold ${isAlreadyAdded ? 'text-slate-500' : 'text-slate-800'}`}>{p.name}</div>
                                               <div className="text-xs text-slate-400 flex items-center space-x-2">
                                                   <span>Code: {p.code}</span>
                                                   {isAlreadyAdded && <span className="bg-slate-200 text-slate-600 px-1.5 rounded text-[10px] font-bold">DÉJÀ AJOUTÉ</span>}
                                               </div>
                                           </div>
                                       </div>
                                   );
                               })}
                           </div>
                       )}
                  </div>

                  {/* Modal Footer */}
                  <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
                      <div className="text-sm font-medium text-slate-600">
                          {modalSelectedIds.length} produit(s) sélectionné(s)
                      </div>
                      <div className="flex space-x-3">
                          <button 
                             onClick={() => setShowModal(false)}
                             className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
                          >
                              Annuler
                          </button>
                          <button 
                             onClick={handleConfirmSelection}
                             disabled={modalSelectedIds.length === 0}
                             className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-md shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                          >
                              Ajouter à la demande
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};
