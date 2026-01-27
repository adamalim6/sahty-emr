
import React, { useState, useMemo, useRef } from 'react';
import { PurchaseOrder, POStatus, ProductDefinition, POItem, DeliveryNote, ProcessingStatus, PharmacySupplier } from '../../types/pharmacy';
import {
   Plus, Search, FileText, Truck, ChevronRight, ArrowLeft,
   CheckCircle2, Clock, AlertCircle, ShoppingCart, PackagePlus,
   Download, FileCheck, User, X, Camera, ScanLine, Loader2, Check
} from 'lucide-react';
import { extractDeliveryNoteData } from '../../services/pharmacyGemini';
import { useAuth } from '../../context/AuthContext';

interface StockEntryProps {
   purchaseOrders: PurchaseOrder[];
   products: ProductDefinition[];
   deliveryNotes: DeliveryNote[];
   suppliers: PharmacySupplier[];
   onCreatePO: (po: PurchaseOrder) => void;
   onReceiveDelivery: (poId: string, deliveryNote: DeliveryNote) => void;
}

export const StockEntry: React.FC<StockEntryProps> = ({
   purchaseOrders,
   products,
   deliveryNotes = [],
   suppliers,
   onCreatePO,
   onReceiveDelivery
}) => {
   const { user } = useAuth();
   const [view, setView] = useState<'list' | 'create' | 'detail' | 'receive'>('list');
   const [activePO, setActivePO] = useState<PurchaseOrder | null>(null);

   const [newPOSupplier, setNewPOSupplier] = useState('');
   const [newPOItems, setNewPOItems] = useState<{ productId: string, qty: number, unitPrice: number }[]>([]);
   const [productSearch, setProductSearch] = useState('');

   const [supplierError, setSupplierError] = useState(false);
   const [productsError, setProductsError] = useState(false);

   const [deliveryItems, setDeliveryItems] = useState<Record<string, number>>({});
   const [deliveryNoteRef, setDeliveryNoteRef] = useState('');
   const [refError, setRefError] = useState(false);

   const [isScanning, setIsScanning] = useState(false);
   const fileInputRef = useRef<HTMLInputElement>(null);

   const [selectedDeliveryNote, setSelectedDeliveryNote] = useState<DeliveryNote | null>(null);

   // DEBUG: Check data flow
   useMemo(() => {
       console.log("--- StockEntry DEBUG ---");
       console.log("Suppliers Prop Count:", suppliers.length);
       console.log("Products Prop Count:", products.length);
       if (products.length > 0) {
           const sample = products[0];
           console.log("Sample Product:", sample.name, "Suppliers:", sample.suppliers);
       }
       const activeSuppliers = suppliers.filter(s => products.some(p => p.suppliers?.some(ps => ps.id === s.id)));
       console.log("Filtered Active Suppliers:", activeSuppliers.length);
       if (activeSuppliers.length === 0 && suppliers.length > 0) {
           console.warn("MISMATCH DETECTED: Suppliers exist but none match product links.");
           if (products.length > 0 && products[0].suppliers?.length > 0) {
                console.log("Comparison - Product Supplier ID:", products[0].suppliers[0].id, "Type:", typeof products[0].suppliers[0].id);
                console.log("Comparison - Global Supplier ID:", suppliers[0].id, "Type:", typeof suppliers[0].id);
           }
       }
   }, [suppliers, products]);

   const handleCreatePO = () => {
      if (!newPOSupplier) {
         alert("Veuillez sélectionner un fournisseur.");
         setSupplierError(true);
         return;
      }

      if (newPOItems.length === 0) {
         alert("Veuillez sélectionner au moins un produit.");
         setProductsError(true);
         return;
      }

      const supplierName = suppliers.find(s => s.id === newPOSupplier)?.name || 'Inconnu';

      // Calculate Total Amount (Optional, but good for data)
      // const totalAmount = newPOItems.reduce((sum, item) => sum + (item.qty * item.unitPrice), 0);

      const po: PurchaseOrder = {
         id: `BC-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`,
         supplierId: newPOSupplier,
         supplierName: supplierName,
         date: new Date(),
         status: POStatus.DRAFT,
         items: newPOItems.map(i => {
            const prod = products.find(p => p.id === i.productId);
            const unitsPerBox = prod?.unitsPerBox || 1;
            // User inputs Box Price, but we store Unit Price in DB (since Qty is Units)
            // storedUnitPrice = boxPrice / unitsPerBox
            const computedUnitPrice = i.unitPrice / unitsPerBox;
            
            return {
               productId: i.productId,
               orderedQty: i.qty,
               deliveredQty: 0,
               unitPrice: computedUnitPrice
            };
         })
      };

      onCreatePO(po);
      setNewPOItems([]);
      setNewPOSupplier('');
      setSupplierError(false);
      setProductsError(false);
      setView('list');
   };

   const addItemToPO = (productId: string) => {
      const existing = newPOItems.find(i => i.productId === productId);
      if (existing) return;

      // Seed Price from Catalog (Active Price Version)
      const product = products.find(p => p.id === productId);
      const supplierInfo = product?.suppliers.find(s => s.id === newPOSupplier);
      const seededPrice = supplierInfo?.purchasePrice || 0;

      const unitsPerBox = product?.unitsPerBox || 1;
      setNewPOItems([...newPOItems, { productId, qty: unitsPerBox, unitPrice: seededPrice }]);
      setProductsError(false);
   };

   const updatePOItemQty = (productId: string, qty: number) => {
      setNewPOItems(newPOItems.map(i => i.productId === productId ? { ...i, qty } : i));
   };

   const updatePOItemPrice = (productId: string, price: number) => {
      setNewPOItems(newPOItems.map(i => i.productId === productId ? { ...i, unitPrice: price } : i));
   };

   const removePOItem = (productId: string) => {
      setNewPOItems(newPOItems.filter(i => i.productId !== productId));
   };
   const handleStartReceive = (po: PurchaseOrder) => {
      setActivePO(po);
      const initial: Record<string, number> = {};
      po.items.forEach(i => initial[i.productId] = 0);
      setDeliveryItems(initial);
      setDeliveryNoteRef('');
      setRefError(false);
      setView('receive');
   };

   const handleSubmitDelivery = () => {
      if (!activePO) return;

      if (!deliveryNoteRef.trim()) {
         alert("Veuillez entrer la référence du Bon de Livraison.");
         setRefError(true);
         setTimeout(() => setRefError(false), 2000);
         return;
      }

      const itemsToReceive = [];
      for (const item of activePO.items) {
         const deliveredNow = deliveryItems[item.productId] || 0;
         if (deliveredNow < 0) return;

         const remaining = item.orderedQty - item.deliveredQty;
         if (deliveredNow > remaining) {
            alert(`Impossible de livrer ${deliveredNow} pour ${item.productId}. Max autorisé : ${remaining}.`);
            return;
         }

         if (deliveredNow > 0) {
            itemsToReceive.push({
               productId: item.productId,
               deliveredQty: deliveredNow
            });
         }
      }

      if (itemsToReceive.length === 0) {
         alert("Veuillez saisir une quantité reçue pour au moins un produit.");
         return;
      }

      const dn: DeliveryNote = {
         id: deliveryNoteRef,
         poId: activePO.id,
         date: new Date(),
         createdBy: user?.username || 'Utilisateur Inconnu',
         grnReference: deliveryNoteRef,
         status: ProcessingStatus.PENDING,
         items: itemsToReceive
      };

      onReceiveDelivery(activePO.id, dn);
      setView('list');
      setActivePO(null);
   };

   const handleScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !activePO) return;

      setIsScanning(true);

      try {
         const reader = new FileReader();
         reader.readAsDataURL(file);
         reader.onload = async () => {
            const base64 = reader.result as string;
            const rawBase64 = base64.split(',')[1];

            const expectedProducts = activePO.items.map(item => {
               const pDef = products.find(p => p.id === item.productId);
               return { id: item.productId, name: pDef?.name || item.productId };
            });

            const result = await extractDeliveryNoteData(rawBase64, expectedProducts);

            if (result.reference) {
               setDeliveryNoteRef(result.reference);
               setRefError(false);
            }

            const newDeliveryItems = { ...deliveryItems };
            let warningMsg = '';

            result.quantities.forEach(q => {
               const poItem = activePO.items.find(i => i.productId === q.productId);
               if (poItem) {
                  const remaining = poItem.orderedQty - poItem.deliveredQty;
                  if (q.qty > remaining) {
                     newDeliveryItems[q.productId] = remaining;
                     warningMsg += `\n- ${q.productId}: Scanné ${q.qty}, plafonné à ${remaining}`;
                  } else {
                     newDeliveryItems[q.productId] = q.qty;
                  }
               }
            });

            setDeliveryItems(newDeliveryItems);

            if (warningMsg) {
               alert(`Scan terminé avec ajustements :${warningMsg}`);
            }

            setIsScanning(false);
         };
      } catch (error) {
         console.error(error);
         alert("Échec du scan du Bon de Livraison.");
         setIsScanning(false);
      }

      e.target.value = '';
   };

   const handleScanClick = () => {
      fileInputRef.current?.click();
   };

   const renderStatus = (status: POStatus) => {
      switch (status) {
         case POStatus.DRAFT:
            return <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-medium border border-slate-200">Brouillon</span>;
         case POStatus.ORDERED:
            return <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-medium border border-blue-200">Commandé</span>;
         case POStatus.PARTIAL:
            return <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-xs font-medium border border-amber-200">Partiel</span>;
         case POStatus.COMPLETED:
            return <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-xs font-medium border border-emerald-200">Terminé</span>;
      }
   };

   if (view === 'create') {
      return (
         <div className="space-y-6 animate-in slide-in-from-right duration-200">
            <div className="flex items-center space-x-4 mb-6">
               <button onClick={() => setView('list')} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                  <ArrowLeft size={20} />
               </button>
               <h2 className="text-xl font-bold text-slate-900">Créer un Bon de Commande</h2>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm max-w-4xl">
               <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Fournisseur</label>
                  <select
                     value={newPOSupplier}
                     onChange={(e) => {
                        setNewPOSupplier(e.target.value);
                        if (e.target.value) setSupplierError(false);
                     }}
                     className={`w-full bg-slate-50 border rounded-lg px-4 py-2.5 text-slate-900 outline-none focus:ring-2 focus:ring-blue-100 ${supplierError ? 'border-red-500 ring-2 ring-red-200 bg-red-50' : 'border-slate-300'}`}
                  >
                     <option value="">-- Choisir Fournisseur --</option>
                     {suppliers
                        .filter(s => products.some(p => p.suppliers?.some(ps => ps.id === s.id)))
                        .map(s => (
                        <option key={s.id} value={s.id}>
                           {s.name} {s.source === 'GLOBAL' ? '(Global)' : ''}
                        </option>
                     ))}
                  </select>
               </div>

               <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Ajouter Produits</label>
                  <div className="flex space-x-2 mb-4">
                     <div className={`flex-1 bg-slate-50 border rounded-lg flex items-center px-3 ${productsError ? 'border-red-500 ring-2 ring-red-200 bg-red-50' : 'border-slate-300'}`}>
                        <Search className={`mr-2 ${productsError ? 'text-red-400' : 'text-slate-400'}`} size={18} />
                        <input
                           type="text"
                           placeholder="Rechercher un produit..."
                           className="bg-transparent w-full py-2.5 outline-none text-slate-900"
                           value={productSearch}
                           onChange={(e) => setProductSearch(e.target.value)}
                        />
                     </div>
                  </div>

                  {productSearch && (
                     <div className="bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto mb-4">
                        {products
                           .filter(p =>
                              p.name.toLowerCase().includes(productSearch.toLowerCase()) &&
                              p.suppliers?.some(s => s.id === newPOSupplier)
                           )
                           .map(p => {
                              const isAdded = newPOItems.some(i => i.productId === p.id);
                              return (
                                 <div
                                    key={p.id}
                                    onClick={() => addItemToPO(p.id)}
                                    className={`p-3 cursor-pointer border-b border-slate-50 last:border-0 flex justify-between items-center transition-colors
                                  ${isAdded ? 'bg-emerald-50' : 'hover:bg-blue-50'}`}
                                 >
                                    <span className={`font-medium ${isAdded ? 'text-emerald-800' : 'text-slate-800'}`}>{p.name}</span>
                                    {isAdded ? <Check size={16} className="text-emerald-600" /> : <Plus size={16} className="text-blue-500" />}
                                 </div>
                              );
                           })}
                     </div>
                  )}

                  {newPOItems.length > 0 && (
                     <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-left text-sm">
                           <thead className="bg-slate-50 text-slate-500">
                              <tr>
                                 <th className="px-4 py-3 font-medium">Produit</th>
                                 <th className="px-4 py-3 font-medium w-32 text-center">Qté (Boîtes)</th>
                                 <th className="px-4 py-3 font-medium w-36 text-center">Prix Achat / Boîte (HT)</th>
                                 <th className="px-4 py-3 font-medium w-32 text-right">Total</th>
                                 <th className="px-4 py-3 font-medium w-16"></th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                              {newPOItems.map(item => {
                                 const prod = products.find(p => p.id === item.productId);
                                 const unitsPerBox = prod?.unitsPerBox || 1;
                                 const qtyBoxes = item.qty / unitsPerBox;
                                 
                                 return (
                                    <tr key={item.productId} className="bg-white">
                                       <td className="px-4 py-3 font-medium text-slate-900">
                                          {prod?.name || item.productId}
                                          <div className="text-xs text-slate-500 font-normal">
                                             Conditionnement: {unitsPerBox} {prod?.unit === 'Boîte' ? 'Unités/Boîte' : 'Unités'}
                                          </div>
                                       </td>
                                       <td className="px-4 py-3 text-center">
                                          <input
                                             type="number"
                                             min="1"
                                             step="1"
                                             value={qtyBoxes} 
                                             onChange={(e) => updatePOItemQty(item.productId, (parseInt(e.target.value) || 0) * unitsPerBox)}
                                             className="w-20 text-center border border-slate-300 rounded py-1.5 bg-white text-slate-900 font-medium focus:ring-2 focus:ring-blue-100 outline-none"
                                          />
                                       </td>
                                       <td className="px-4 py-3 text-center">
                                          <input
                                             type="number"
                                             min="0"
                                             step="0.01"
                                             value={item.unitPrice}
                                             onChange={(e) => updatePOItemPrice(item.productId, parseFloat(e.target.value) || 0)}
                                             className="w-28 text-center border border-slate-300 rounded py-1.5 bg-white text-slate-900 font-medium focus:ring-2 focus:ring-blue-100 outline-none"
                                          />
                                       </td>
                                       <td className="px-4 py-3 text-right font-medium text-slate-700">
                                          {(qtyBoxes * item.unitPrice).toFixed(2)} Dhs
                                       </td>
                                       <td className="px-4 py-3 text-center">
                                          <button onClick={() => removePOItem(item.productId)} className="text-red-400 hover:text-red-600">
                                             <X size={18} />
                                          </button>
                                       </td>
                                    </tr>
                                 );
                              })}
                           </tbody>
                        </table>
                     </div>
                  )}
               </div>

               <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                   <div className="text-lg font-bold text-slate-800">
                       Total Estimé: <span className="text-blue-600">{newPOItems.reduce((sum, i) => {
                           const prod = products.find(p => p.id === i.productId);
                           const unitsPerBox = prod?.unitsPerBox || 1;
                           return sum + ((i.qty / unitsPerBox) * i.unitPrice);
                       }, 0).toFixed(2)} Dhs</span>
                   </div>
                  <button
                     onClick={handleCreatePO}
                     className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-bold shadow-sm transition-colors flex items-center space-x-2"
                  >
                     <CheckCircle2 size={18} />
                     <span>Générer Bon de Commande</span>
                  </button>
               </div>
            </div>
         </div>
      );
   }

   if (view === 'receive' && activePO) {
      return (
         <div className="space-y-6 animate-in slide-in-from-right duration-200">
            <input
               type="file"
               ref={fileInputRef}
               onChange={handleScan}
               accept="image/*"
               className="hidden"
            />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
               <div className="flex items-center space-x-4">
                  <button onClick={() => setView('detail')} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                     <ArrowLeft size={20} />
                  </button>
                  <h2 className="text-xl font-bold text-slate-900">Réceptionner Livraison</h2>
               </div>

               <button
                  onClick={handleScanClick}
                  disabled={isScanning}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors shadow-sm
               ${isScanning ? 'bg-purple-100 text-purple-700 cursor-wait' : 'bg-purple-600 text-white hover:bg-purple-700'}`}
               >
                  {isScanning ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
                  <span>{isScanning ? 'Analyse en cours...' : 'Scanner / Uploader BL'}</span>
               </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 max-w-4xl">
               <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-6 border-b border-slate-100 gap-4">
                  <div className="bg-blue-50 text-blue-800 px-4 py-3 rounded-lg flex items-start space-x-3 max-w-lg">
                     <Truck className="mt-1 flex-shrink-0" size={20} />
                     <div>
                        <p className="font-bold text-sm uppercase mb-1">Réception pour {activePO.id}</p>
                        <p className="text-xs opacity-90">Entrez les quantités livrées. Les articles seront envoyés en <span className="font-bold">Quarantaine</span> pour contrôle.</p>
                     </div>
                  </div>

                  <div className="flex items-center space-x-2 w-full md:w-auto">
                     <div className={`flex items-center bg-slate-50 border rounded-lg px-3 py-2 transition-all duration-300 ${refError ? 'border-red-500 ring-2 ring-red-200 bg-red-50' : 'border-slate-300 focus-within:ring-2 focus-within:ring-blue-100'}`}>
                        <span className="text-xs font-bold text-slate-400 mr-2">RÉF:</span>
                        <input
                           type="text"
                           placeholder="N° Bon Livraison..."
                           value={deliveryNoteRef}
                           onChange={(e) => {
                              setDeliveryNoteRef(e.target.value);
                              if (refError) setRefError(false);
                           }}
                           className={`bg-transparent outline-none text-sm font-medium w-40 ${refError ? 'text-red-900 placeholder-red-300' : 'text-slate-900'}`}
                        />
                     </div>
                  </div>
               </div>

               <div className="space-y-4">
                  {activePO.items.map(item => {
                     const prod = products.find(p => p.id === item.productId);
                     const unitsPerBox = prod?.unitsPerBox || 1;
                     
                     const orderedBoxes = Math.ceil(item.orderedQty / unitsPerBox);
                     const deliveredBoxes = Math.ceil(item.deliveredQty / unitsPerBox);
                     const remaining = item.orderedQty - item.deliveredQty;
                     const remainingBoxes = Math.ceil(remaining / unitsPerBox);

                     const isFullyDelivered = remaining <= 0;

                     if (isFullyDelivered) return null;

                     const currentValUnits = deliveryItems[item.productId] || 0;
                     const currentValBoxes = currentValUnits / unitsPerBox;

                     return (
                        <div key={item.productId} className="flex flex-col md:flex-row items-center justify-between p-4 bg-white border border-slate-200 rounded-lg hover:border-blue-200 transition-colors">
                           <div className="mb-4 md:mb-0 w-full">
                              <h4 className="font-bold text-slate-900">{prod?.name}</h4>
                              <div className="text-xs text-slate-500 font-normal">
                                 Conditionnement: {unitsPerBox} {prod?.unit === 'Boîte' ? 'Unités/Boîte' : 'Unités'}
                              </div>
                              <div className="flex text-xs text-slate-500 mt-1 space-x-3">
                                 <span>Commandé: <span className="font-medium text-slate-700">{orderedBoxes} Bts</span></span>
                                 <span>Déjà Livré: <span className="font-medium text-slate-700">{deliveredBoxes} Bts</span></span>
                                 <span className="text-blue-600 font-bold">Reste à Livrer: {remainingBoxes} Bts</span>
                              </div>
                           </div>

                           <div className="flex flex-col items-center md:items-end w-full md:w-auto">
                              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Livré (Boîtes)</label>
                              <input
                                 type="number"
                                 min="0"
                                 max={remainingBoxes}
                                 step="1"
                                 value={currentValBoxes || ''} 
                                 onChange={(e) => {
                                    const valBoxes = parseInt(e.target.value) || 0;
                                    const valUnits = valBoxes * unitsPerBox;
                                    
                                    if (valUnits <= remaining) {
                                       setDeliveryItems({ ...deliveryItems, [item.productId]: valUnits });
                                    } else {
                                       alert(`Ne peut pas excéder le reste à livrer de ${remainingBoxes} boîtes`);
                                    }
                                 }}
                                 className="w-full md:w-32 bg-white text-black border border-slate-300 rounded-lg py-2 px-3 text-center font-bold text-lg outline-none focus:ring-2 focus:ring-blue-100 shadow-sm"
                              />
                           </div>
                        </div>
                     );
                  })}
               </div>

               <div className="mt-8 flex justify-end space-x-3 pt-6 border-t border-slate-100">
                  <button
                     onClick={() => setView('detail')}
                     className="px-6 py-2.5 text-slate-600 font-medium hover:bg-slate-50 rounded-lg transition-colors"
                  >
                     Annuler
                  </button>
                  <button
                     onClick={handleSubmitDelivery}
                     className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm flex items-center space-x-2"
                  >
                     <PackagePlus size={18} />
                     <span>Valider & Envoyer en Quarantaine</span>
                  </button>
               </div>
            </div>
         </div>
      );
   }

   if (view === 'detail' && activePO) {
      const poDeliveryNotes = deliveryNotes.filter(n => n.poId === activePO.id).sort((a, b) => b.date.getTime() - a.date.getTime());

      return (
         <div className="space-y-8 animate-in slide-in-from-right duration-200">
            <div className="flex items-center space-x-4">
               <button onClick={() => { setView('list'); setActivePO(null); }} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                  <ArrowLeft size={20} />
               </button>
               <div>
                  <h2 className="text-2xl font-bold text-slate-900 flex items-center">
                     {activePO.id}
                     <span className="ml-3">{renderStatus(activePO.status)}</span>
                  </h2>
                  <p className="text-slate-500 text-sm mt-1">
                     Fournisseur: <span className="font-medium text-slate-700">{activePO.supplierName}</span> • Créé le: {activePO.date.toLocaleDateString()}
                  </p>
               </div>

               {activePO.status !== POStatus.COMPLETED && (
                  <button
                     onClick={() => handleStartReceive(activePO)}
                     className="ml-auto bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-bold shadow-sm flex items-center space-x-2 transition-colors"
                  >
                     <Truck size={18} />
                     <span>Réceptionner Livraison</span>
                  </button>
               )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               <div className="lg:col-span-2">
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                     <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                        <h3 className="font-bold text-slate-800">Produits Commandés</h3>
                     </div>
                     <table className="w-full text-left text-sm">
                        <thead className="text-slate-500 bg-slate-50/50 border-b border-slate-100">
                           <tr>
                              <th className="px-6 py-3 font-semibold uppercase text-xs tracking-wider">Produit</th>
                              <th className="px-6 py-3 font-semibold uppercase text-xs tracking-wider text-center">Qté Comm. (Bts)</th>
                              <th className="px-6 py-3 font-semibold uppercase text-xs tracking-wider text-center">Qté Livrée (Bts)</th>
                              <th className="px-6 py-3 font-semibold uppercase text-xs tracking-wider text-center">Reste (Bts)</th>
                              <th className="px-6 py-3 font-semibold uppercase text-xs tracking-wider text-right">Statut</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {activePO.items.map(item => {
                              const prod = products.find(p => p.id === item.productId);
                              const unitsPerBox = prod?.unitsPerBox || 1;
                              const remaining = item.orderedQty - item.deliveredQty;
                              const status = remaining === 0 ? 'Complet' : item.deliveredQty > 0 ? 'Partiel' : 'En attente';
                              
                              const orderedBoxes = Math.ceil(item.orderedQty / unitsPerBox);
                              const deliveredBoxes = Math.ceil(item.deliveredQty / unitsPerBox);
                              const remainingBoxes = Math.ceil(remaining / unitsPerBox);

                              return (
                                 <tr key={item.productId} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-900">
                                       {prod?.name || item.productId}
                                       <div className="text-xs text-slate-500 font-normal">
                                          Condit: {unitsPerBox}
                                       </div>
                                    </td>
                                    <td className="px-6 py-4 text-center text-slate-600">{orderedBoxes}</td>
                                    <td className="px-6 py-4 text-center font-medium text-blue-600">{deliveredBoxes}</td>
                                    <td className="px-6 py-4 text-center font-bold text-slate-800">{remainingBoxes}</td>
                                    <td className="px-6 py-4 text-right">
                                       <span className={`text-xs font-bold flex items-center justify-end
                                        ${status === 'Complet' ? 'text-emerald-600' : status === 'Partiel' ? 'text-amber-600' : 'text-slate-400'}`}>
                                          {status === 'Complet' ? <CheckCircle2 size={14} className="mr-1" /> : <Clock size={14} className="mr-1" />}
                                          {status}
                                       </span>
                                    </td>
                                 </tr>
                              );
                           })}
                        </tbody>
                     </table>
                  </div>
               </div>

               <div>
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 h-full">
                     <h3 className="font-bold text-slate-800 mb-4 flex items-center">
                        <FileText className="mr-2 text-slate-500" size={18} /> Historique Livraisons
                     </h3>

                     {poDeliveryNotes.length === 0 ? (
                        <div className="text-center py-8 text-slate-400">
                           <p className="text-sm italic">Aucune livraison reçue pour le moment.</p>
                        </div>
                     ) : (
                        <div className="space-y-4">
                           {poDeliveryNotes.map(note => (
                              <div
                                 key={note.id}
                                 onClick={() => setSelectedDeliveryNote(note)}
                                 className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 cursor-pointer transition-all group"
                              >
                                 <div className="flex justify-between items-start mb-2">
                                    <span className="font-bold text-slate-800 text-sm">{note.id}</span>
                                    <span className="text-xs text-slate-500">{note.date.toLocaleDateString()}</span>
                                 </div>
                                 <div className="flex items-center text-xs text-slate-500 mb-3 space-x-2">
                                    <User size={12} />
                                    <span>{note.createdBy || 'Utilisateur'}</span>
                                 </div>
                                 <div className="flex justify-end items-end">
                                    <span className="text-xs font-medium text-blue-600 group-hover:underline">Voir Détails</span>
                                 </div>
                              </div>
                           ))}
                        </div>
                     )}
                  </div>
               </div>
            </div>

            {selectedDeliveryNote && (
               <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                     <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                        <div>
                           <h3 className="font-bold text-lg text-slate-900">Détails Bon de Livraison</h3>
                           <p className="text-sm text-slate-500">Réf: {selectedDeliveryNote.id}</p>
                        </div>
                        <button onClick={() => setSelectedDeliveryNote(null)} className="text-slate-400 hover:text-slate-600">
                           <X size={24} />
                        </button>
                     </div>

                     <div className="p-6">
                        <div className="flex justify-between items-center mb-6 bg-blue-50 p-4 rounded-lg border border-blue-100">
                           <div>
                              <div className="text-xs text-blue-600 uppercase font-bold mb-1">N° Bon Livraison</div>
                              <div className="text-lg font-mono font-bold text-blue-900">{selectedDeliveryNote.id}</div>
                           </div>
                           <button className="flex items-center space-x-2 bg-white text-blue-600 px-4 py-2 rounded border border-blue-200 hover:bg-blue-50 transition-colors shadow-sm">
                              <Download size={16} />
                              <span className="font-medium text-sm">Télécharger PDF</span>
                           </button>
                        </div>

                        <table className="w-full text-sm text-left">
                           <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                              <tr>
                                 <th className="px-4 py-2 font-medium">Produit</th>
                                 <th className="px-4 py-2 font-medium text-center">Total Commandé</th>
                                 <th className="px-4 py-2 font-medium text-center text-blue-600">Livré dans ce BL</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                              {selectedDeliveryNote.items.map((item, idx) => {
                                 const prod = products.find(p => p.id === item.productId);
                                 const poItem = activePO.items.find(i => i.productId === item.productId);

                                 return (
                                    <tr key={idx}>
                                       <td className="px-4 py-3 font-medium text-slate-900">{prod?.name || item.productId}</td>
                                       <td className="px-4 py-3 text-center text-slate-500">{poItem?.orderedQty || '-'}</td>
                                       <td className="px-4 py-3 text-center font-bold text-blue-700 bg-blue-50/50">{item.deliveredQty}</td>
                                    </tr>
                                 );
                              })}
                           </tbody>
                        </table>
                     </div>

                     <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 text-right">
                        <button onClick={() => setSelectedDeliveryNote(null)} className="text-slate-600 hover:text-slate-900 font-medium text-sm">Fermer</button>
                     </div>
                  </div>
               </div>
            )}
         </div>
      );
   }

   return (
      <div className="space-y-6">
         <div className="flex justify-between items-center">
            <div>
               <h2 className="text-xl font-bold text-slate-900">Bons de Commande</h2>
               <p className="text-slate-500 text-sm">Gérez les commandes et les réceptions.</p>
            </div>
            <button
               onClick={() => setView('create')}
               className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium shadow-sm transition-colors"
            >
               <Plus size={18} />
               <span>Créer Bon de Commande</span>
            </button>
         </div>

         <div className="bg-white shadow-sm border border-slate-200 rounded-xl overflow-hidden">
            {purchaseOrders.length === 0 ? (
               <div className="p-12 text-center text-slate-400">
                  <ShoppingCart size={40} className="mx-auto mb-4 text-slate-300" />
                  <p className="text-lg font-medium text-slate-600">Aucun Bon de Commande</p>
                  <p className="text-sm mb-6">Créez une nouvelle commande pour commencer.</p>
               </div>
            ) : (
               <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-xs">
                     <tr>
                        <th className="px-6 py-4">Réf. BC</th>
                        <th className="px-6 py-4">Fournisseur</th>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Articles</th>
                        <th className="px-6 py-4">Créé par</th>
                        <th className="px-6 py-4 text-right">Action</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {purchaseOrders.map(po => (
                        <tr key={po.id} onClick={() => { setActivePO(po); setView('detail'); }} className="hover:bg-slate-50 cursor-pointer transition-colors group">
                           <td className="px-6 py-4 font-bold text-slate-900">{po.id}</td>
                           <td className="px-6 py-4 font-medium text-slate-700">{po.supplierName || 'Inconnu'}</td>
                           <td className="px-6 py-4 text-slate-500">{po.date.toLocaleDateString()}</td>
                           <td className="px-6 py-4 text-slate-500">{po.items.length} Produits</td>
                           <td className="px-6 py-4 text-slate-600">
                              <div className="flex items-center">
                                  <User size={14} className="mr-2 text-slate-400" />
                                  {po.createdBy || '-'}
                              </div>
                           </td>
                           <td className="px-6 py-4 text-right">
                              <span className="text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end">
                                 Voir Détails <ChevronRight size={16} />
                              </span>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            )}
         </div>
      </div>
   );
};
