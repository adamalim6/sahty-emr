
import React, { useState, useMemo } from 'react';
import { 
  InventoryItem, ProductDefinition, PartnerInstitution, DeliveryNote, Supplier,
  StockOutType, DestructionReason, StockOutItem, StockOutTransaction
} from '../../types/pharmacy';
import { 
  ArrowLeft, Search, Archive, Truck, Building2, Flame, 
  AlertTriangle, FileText, Trash2, Check, Plus, Calendar, Hash, User, Clock
} from 'lucide-react';

interface StockOutManagerProps {
  systemItems: InventoryItem[];
  partners: PartnerInstitution[];
  deliveryNotes: DeliveryNote[];
  products: ProductDefinition[];
  onConfirmStockOut: (transaction: StockOutTransaction) => void;
  stockOutHistory: StockOutTransaction[];
}

export const StockOutManager: React.FC<StockOutManagerProps> = ({
  systemItems,
  partners,
  deliveryNotes,
  products,
  onConfirmStockOut,
  stockOutHistory
}) => {
  const [mode, setMode] = useState<StockOutType | null>(null);
  
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedDNId, setSelectedDNId] = useState('');
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [destructionReason, setDestructionReason] = useState<DestructionReason>(DestructionReason.DAMAGE);
  
  const [cart, setCart] = useState<StockOutItem[]>([]);
  
  const [itemSearch, setItemSearch] = useState('');

  const suppliers = useMemo(() => {
    const map = new Map();
    products.forEach(p => p.suppliers?.forEach(s => map.set(s.id, s.name)));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [products]);

  const availableItems = useMemo(() => {
    let items = systemItems.filter(i => i.theoreticalQty > 0);

    if (itemSearch) {
      const lower = itemSearch.toLowerCase();
      items = items.filter(i => 
        i.name.toLowerCase().includes(lower) || 
        i.batchNumber.toLowerCase().includes(lower) ||
        i.id.toLowerCase().includes(lower)
      );
    }

    if (mode === StockOutType.SUPPLIER_RETURN && selectedDNId) {
      const dn = deliveryNotes.find(d => d.id === selectedDNId);
      if (dn) {
        const productIds = dn.items.map(i => i.productId);
        items = items.filter(i => productIds.includes(i.productId));
      }
    } else if (mode === StockOutType.DESTRUCTION && destructionReason === DestructionReason.EXPIRY) {
      const today = new Date();
      items = items.filter(i => new Date(i.expiryDate) < today);
    }

    return items;
  }, [systemItems, itemSearch, mode, selectedDNId, destructionReason, deliveryNotes]);

  const addToCart = (item: InventoryItem, qty: number) => {
    if (qty <= 0) return;
    if (qty > item.theoreticalQty) return alert(`La quantité max est ${item.theoreticalQty}`);
    
    const existingIdx = cart.findIndex(c => c.inventoryItemId === item.id);
    if (existingIdx >= 0) {
      const newCart = [...cart];
      newCart[existingIdx].quantityToRemove = qty;
      setCart(newCart);
    } else {
      setCart([...cart, {
        inventoryItemId: item.id,
        productId: item.productId,
        productName: item.name,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
        quantityToRemove: qty
      }]);
    }
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(c => c.inventoryItemId !== id));
  };

  const handleConfirm = () => {
    if (cart.length === 0) return alert("Le panier est vide");

    const transaction: StockOutTransaction = {
      id: `OUT-${Date.now()}`,
      date: new Date(),
      type: mode!,
      createdBy: 'Utilisateur Actuel',
      items: cart,
      supplierId: mode === StockOutType.SUPPLIER_RETURN ? selectedSupplierId : undefined,
      deliveryNoteRef: mode === StockOutType.SUPPLIER_RETURN ? selectedDNId : undefined,
      partnerId: mode === StockOutType.OUTGOING_LOAN ? selectedPartnerId : undefined,
      destructionReason: mode === StockOutType.DESTRUCTION ? destructionReason : undefined
    };

    if (window.confirm(`Confirmer la sortie de ${cart.length} articles du stock ? Cette action est irréversible.`)) {
      onConfirmStockOut(transaction);
      setCart([]);
      setMode(null);
    }
  };

  const renderIconForType = (type: StockOutType) => {
    switch (type) {
        case StockOutType.SUPPLIER_RETURN: return <Truck size={20} className="text-blue-500" />;
        case StockOutType.OUTGOING_LOAN: return <Building2 size={20} className="text-indigo-500" />;
        case StockOutType.DESTRUCTION: return <Flame size={20} className="text-red-500" />;
    }
  };

  if (!mode) {
    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        
        <div>
           <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4">Créer Nouvelle Transaction</h3>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <button onClick={() => setMode(StockOutType.SUPPLIER_RETURN)} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:border-blue-400 hover:shadow-md transition-all text-left group">
                 <div className="flex justify-between items-start mb-4">
                    <div className="bg-blue-50 text-blue-600 p-3 rounded-full group-hover:bg-blue-600 group-hover:text-white transition-colors">
                       <Truck size={24} />
                    </div>
                    <Plus size={20} className="text-slate-300 group-hover:text-blue-500" />
                 </div>
                 <h3 className="font-bold text-slate-900 mb-1">Retour Fournisseur</h3>
                 <p className="text-xs text-slate-500">Retourner articles endommagés ou refusés.</p>
              </button>

              <button onClick={() => setMode(StockOutType.OUTGOING_LOAN)} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-400 hover:shadow-md transition-all text-left group">
                 <div className="flex justify-between items-start mb-4">
                    <div className="bg-indigo-50 text-indigo-600 p-3 rounded-full group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                       <Building2 size={24} />
                    </div>
                    <Plus size={20} className="text-slate-300 group-hover:text-indigo-500" />
                 </div>
                 <h3 className="font-bold text-slate-900 mb-1">Prêt Sortant</h3>
                 <p className="text-xs text-slate-500">Prêter du stock à un partenaire externe.</p>
              </button>

              <button onClick={() => setMode(StockOutType.DESTRUCTION)} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:border-red-400 hover:shadow-md transition-all text-left group">
                 <div className="flex justify-between items-start mb-4">
                    <div className="bg-red-50 text-red-600 p-3 rounded-full group-hover:bg-red-600 group-hover:text-white transition-colors">
                       <Flame size={24} />
                    </div>
                    <Plus size={20} className="text-slate-300 group-hover:text-red-500" />
                 </div>
                 <h3 className="font-bold text-slate-900 mb-1">Bon de Destruction</h3>
                 <p className="text-xs text-slate-500">Éliminer stock périmé ou endommagé.</p>
              </button>
           </div>
        </div>

        <div>
           <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide">Transactions Récentes</h3>
           </div>
           
           {stockOutHistory.length === 0 ? (
              <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200 rounded-xl">
                 Aucune activité de sortie récente.
              </div>
           ) : (
              <div className="flex space-x-4 overflow-x-auto pb-4">
                 {stockOutHistory.sort((a,b) => b.date.getTime() - a.date.getTime()).map(txn => (
                    <div key={txn.id} className="flex-shrink-0 w-72 bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                       <div className="flex justify-between items-start mb-3">
                          <div className="bg-slate-50 p-2 rounded-lg">
                             {renderIconForType(txn.type)}
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase
                             ${txn.type === StockOutType.DESTRUCTION ? 'bg-red-50 text-red-700' :
                               txn.type === StockOutType.OUTGOING_LOAN ? 'bg-indigo-50 text-indigo-700' : 'bg-blue-50 text-blue-700'}`}>
                             {txn.type}
                          </span>
                       </div>
                       
                       <div className="mb-3">
                          <h4 className="font-bold text-slate-900 text-sm">{txn.id}</h4>
                          <div className="flex items-center space-x-2 text-xs text-slate-500 mt-1">
                             <Calendar size={12} />
                             <span>{txn.date.toLocaleDateString()}</span>
                          </div>
                       </div>
                       
                       <div className="border-t border-slate-100 pt-3 mt-3 flex justify-between items-center text-xs text-slate-500">
                          <div className="flex items-center space-x-1">
                             <User size={12} />
                             <span>{txn.createdBy}</span>
                          </div>
                          <button className="text-blue-600 hover:underline">Voir PDF</button>
                       </div>
                    </div>
                 ))}
              </div>
           )}
        </div>
      </div>
    );
  }

  const renderConfig = () => {
    if (mode === StockOutType.SUPPLIER_RETURN) {
       return (
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
               <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fournisseur</label>
               <select 
                 className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
                 value={selectedSupplierId}
                 onChange={e => setSelectedSupplierId(e.target.value)}
               >
                 <option value="">-- Choisir Fournisseur --</option>
                 {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
               </select>
            </div>
            <div>
               <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Réf. Bon Livraison</label>
               <select 
                 className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
                 value={selectedDNId}
                 onChange={e => setSelectedDNId(e.target.value)}
                 disabled={!selectedSupplierId}
               >
                 <option value="">-- Choisir BL --</option>
                 {deliveryNotes.map(dn => (
                    <option key={dn.id} value={dn.id}>{dn.id} ({new Date(dn.date).toLocaleDateString()})</option>
                 ))}
               </select>
            </div>
         </div>
       );
    }

    if (mode === StockOutType.OUTGOING_LOAN) {
      return (
         <div className="mb-6">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Institution Partenaire</label>
            <select 
               className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white max-w-md"
               value={selectedPartnerId}
               onChange={e => setSelectedPartnerId(e.target.value)}
            >
               <option value="">-- Choisir Partenaire --</option>
               {partners.map(p => <option key={p.id} value={p.id}>{p.name} ({p.type})</option>)}
            </select>
         </div>
      );
    }

    if (mode === StockOutType.DESTRUCTION) {
       return (
         <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg">
            <div className="flex items-center mb-2">
               <AlertTriangle size={18} className="text-red-600 mr-2" />
               <h3 className="font-bold text-red-900">Contrôles de Destruction</h3>
            </div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Raison de la Destruction</label>
            <select 
               className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white max-w-md"
               value={destructionReason}
               onChange={e => setDestructionReason(e.target.value as DestructionReason)}
            >
               {Object.values(DestructionReason).map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {destructionReason === DestructionReason.EXPIRY && (
               <p className="text-xs text-red-600 mt-2 font-medium">
                  Note : La liste ci-dessous est filtrée pour ne montrer QUE les produits périmés.
               </p>
            )}
         </div>
       );
    }
  };

  const isConfigValid = () => {
    if (mode === StockOutType.SUPPLIER_RETURN) return selectedSupplierId && selectedDNId;
    if (mode === StockOutType.OUTGOING_LOAN) return selectedPartnerId;
    if (mode === StockOutType.DESTRUCTION) return true;
    return false;
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-right duration-200">
      <div className="flex items-center space-x-4">
         <button onClick={() => { setMode(null); setCart([]); }} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
            <ArrowLeft size={20} />
         </button>
         <div>
            <h2 className="text-xl font-bold text-slate-900">{mode}</h2>
            <p className="text-slate-500 text-sm">Configurez les détails et sélectionnez les produits à sortir.</p>
         </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
         {renderConfig()}

         {isConfigValid() ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               
               <div className="lg:col-span-2 space-y-4">
                  <div className="flex items-center bg-slate-50 p-2 rounded-lg border border-slate-200">
                     <Search className="text-slate-400 ml-2" size={18} />
                     <input 
                       className="bg-transparent outline-none w-full ml-3 text-sm"
                       placeholder="Rechercher dans le stock système..."
                       value={itemSearch}
                       onChange={e => setItemSearch(e.target.value)}
                     />
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-hidden max-h-[500px] overflow-y-auto">
                     <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-xs sticky top-0">
                           <tr>
                              <th className="px-4 py-3">Produit</th>
                              <th className="px-4 py-3">Lot / Exp</th>
                              <th className="px-4 py-3 text-center">Dispo</th>
                              <th className="px-4 py-3 text-right">Action</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {availableItems.length === 0 ? (
                              <tr>
                                 <td colSpan={4} className="p-8 text-center text-slate-400">
                                    Aucun article correspondant trouvé.
                                 </td>
                              </tr>
                           ) : (
                              availableItems.map(item => {
                                 const inCart = cart.find(c => c.inventoryItemId === item.id);
                                 const remaining = item.theoreticalQty;

                                 return (
                                    <tr key={item.id} className="hover:bg-slate-50">
                                       <td className="px-4 py-3">
                                          <div className="font-bold text-slate-900">{item.name}</div>
                                          <div className="text-xs text-slate-500">{item.location}</div>
                                       </td>
                                       <td className="px-4 py-3">
                                          <div className="flex items-center space-x-1">
                                             <Hash size={12} className="text-slate-400" />
                                             <span className="font-mono">{item.batchNumber}</span>
                                          </div>
                                          <div className="flex items-center space-x-1 text-xs text-slate-500">
                                             <Calendar size={12} />
                                             <span>{item.expiryDate}</span>
                                          </div>
                                       </td>
                                       <td className="px-4 py-3 text-center font-bold text-slate-700">
                                          {remaining}
                                       </td>
                                       <td className="px-4 py-3 text-right">
                                          {inCart ? (
                                             <div className="flex items-center justify-end space-x-2">
                                                <input 
                                                   type="number" 
                                                   min="1" max={remaining}
                                                   value={inCart.quantityToRemove}
                                                   onChange={(e) => addToCart(item, parseInt(e.target.value))}
                                                   className="w-16 border rounded text-center py-1 text-blue-600 font-bold"
                                                />
                                                <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-600">
                                                   <Trash2 size={16} />
                                                </button>
                                             </div>
                                          ) : (
                                             <button 
                                                onClick={() => addToCart(item, 1)}
                                                className="bg-white border border-slate-300 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 text-slate-600 px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                                             >
                                                Sélectionner
                                             </button>
                                          )}
                                       </td>
                                    </tr>
                                 );
                              })
                           )}
                        </tbody>
                     </table>
                  </div>
               </div>

               <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 h-fit">
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center">
                     <Archive size={18} className="mr-2 text-slate-500" /> Articles à Sortir
                  </h3>

                  {cart.length === 0 ? (
                     <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-lg">
                        Sélectionnez des articles dans la liste pour les ajouter ici.
                     </div>
                  ) : (
                     <div className="space-y-3 mb-6">
                        {cart.map(item => (
                           <div key={item.inventoryItemId} className="bg-white p-3 rounded border border-slate-200 shadow-sm text-sm">
                              <div className="font-bold text-slate-800">{item.productName}</div>
                              <div className="flex justify-between items-center mt-1 text-xs text-slate-500">
                                 <span>Lot: {item.batchNumber}</span>
                                 <span className="font-bold text-red-600">-{item.quantityToRemove} unités</span>
                              </div>
                           </div>
                        ))}
                     </div>
                  )}
                  
                  <div className="border-t border-slate-200 pt-4 mt-4">
                     <button 
                        onClick={handleConfirm}
                        disabled={cart.length === 0}
                        className={`w-full py-3 rounded-lg font-bold shadow-sm flex items-center justify-center space-x-2 transition-all
                           ${cart.length > 0 ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                     >
                        <FileText size={18} />
                        <span>Générer PDF & Mettre à jour Stock</span>
                     </button>
                  </div>
               </div>

            </div>
         ) : (
            <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
               Veuillez compléter la configuration ci-dessus pour commencer à sélectionner des produits.
            </div>
         )}
      </div>
    </div>
  );
};
