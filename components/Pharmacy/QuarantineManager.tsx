import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
   DeliveryNote, ProductDefinition, StockLocation, ProcessingStatus,
   ProductType, ReturnReason, BatchEntry, ReturnEntry, ProductProcessData,
   QuarantineSessionResult, PurchaseOrder
} from '../../types/pharmacy';
import {
   CheckCircle2, AlertCircle, PackageCheck, Truck, Calendar,
   MapPin, Hash, Plus, X, QrCode, ArrowRight, ClipboardList, ShieldAlert,
   ChevronRight, Printer, Search, Building2, ChevronLeft, Eye, History
} from 'lucide-react';
import { CustomDatePicker } from '../Shared/CustomDatePicker';
import { QRPrintingModal, PrintProduct } from './QRPrintingModal';
import { generateQuarantineReport } from '../../services/pdfService';

interface QuarantineManagerProps {
   deliveryNotes: DeliveryNote[];
   products: ProductDefinition[];
   locations: StockLocation[];
   onProcessNote: (result: QuarantineSessionResult) => void;
   purchaseOrders: PurchaseOrder[];
}

export const QuarantineManager: React.FC<QuarantineManagerProps> = ({
   deliveryNotes,
   products,
   locations,
   onProcessNote,
   purchaseOrders
}) => {
   const { user } = useAuth();
   const [activeTab, setActiveTab] = useState<'todo' | 'done'>('todo');
   const [selectedNote, setSelectedNote] = useState<DeliveryNote | null>(null);
   const [selectedHistoryNote, setSelectedHistoryNote] = useState<DeliveryNote | null>(null);
   const [searchTerm, setSearchTerm] = useState('');
   const [productSearch, setProductSearch] = useState('');

   const [processData, setProcessData] = useState<Record<string, ProductProcessData>>({});
   
   // Printing State
   const [showPrintModal, setShowPrintModal] = useState(false);
   const [printData, setPrintData] = useState<PrintProduct[]>([]);

   useEffect(() => {
      if (selectedNote && selectedNote.status === ProcessingStatus.PENDING) {
         const initialData: Record<string, ProductProcessData> = {};
         selectedNote.items.forEach(item => {
            initialData[item.productId] = {
               productId: item.productId,
               deliveredQty: item.deliveredQty,
               batches: [],
               returns: []
            };
         });
         setProcessData(initialData);
      }
   }, [selectedNote]);

   const addBatch = (productId: string) => {
      const current = processData[productId];
      const pharmacyLocations = locations.filter(l => l.scope === 'PHARMACY');
      const newBatch: BatchEntry = {
         batchNumber: '',
         expiryDate: '',
         quantity: 0,
         locationId: pharmacyLocations[0]?.name || ''
      };

      setProcessData({
         ...processData,
         [productId]: { ...current, batches: [...current.batches, newBatch] }
      });
   };

   const updateBatch = (productId: string, index: number, field: keyof BatchEntry, value: any) => {
      const current = processData[productId];
      const newBatches = [...current.batches];
      newBatches[index] = { ...newBatches[index], [field]: value };

      setProcessData({
         ...processData,
         [productId]: { ...current, batches: newBatches }
      });
   };

   const removeBatch = (productId: string, index: number) => {
      const current = processData[productId];
      const newBatches = [...current.batches];
      newBatches.splice(index, 1);

      setProcessData({
         ...processData,
         [productId]: { ...current, batches: newBatches }
      });
   };

   const addReturn = (productId: string) => {
      const current = processData[productId];
      const newReturn: ReturnEntry = {
         quantity: 0,
         reason: ReturnReason.DAMAGED,
         notes: ''
      };

      setProcessData({
         ...processData,
         [productId]: { ...current, returns: [...current.returns, newReturn] }
      });
   };

   const updateReturn = (productId: string, index: number, field: keyof ReturnEntry, value: any) => {
      const current = processData[productId];
      const newReturns = [...current.returns];
      newReturns[index] = { ...newReturns[index], [field]: value };

      setProcessData({
         ...processData,
         [productId]: { ...current, returns: newReturns }
      });
   };

   const removeReturn = (productId: string, index: number) => {
      const current = processData[productId];
      const newReturns = [...current.returns];
      newReturns.splice(index, 1);

      setProcessData({
         ...processData,
         [productId]: { ...current, returns: newReturns }
      });
   };

   const isValid = () => {
      if (!selectedNote) return false;

      return selectedNote.items.every(item => {
         const data = processData[item.productId];
         if (!data) return false;

         const totalBatch = data.batches.reduce<number>((sum, b) => sum + (b.quantity || 0), 0);
         const totalReturn = data.returns.reduce((sum, r) => sum + (r.quantity || 0), 0);

         if (totalBatch + totalReturn !== item.deliveredQty) return false;

         const batchesValid = data.batches.every(b => {
             const product = products.find(p => p.id === item.productId);
             const isDrug = product?.type === ProductType.DRUG;

             if (b.quantity <= 0 || !b.locationId) return false;
             if (!isDrug) return true;

             // Expiry Validation
             if (!b.batchNumber || !b.expiryDate) return false;
             
             // Check Past Date
             const today = new Date(new Date().setHours(0, 0, 0, 0));
             const expiry = new Date(b.expiryDate);
             if (expiry < today) return false;

             return true;
         });

         const returnsValid = data.returns.every(r => r.quantity > 0 && r.reason);
         return batchesValid && returnsValid;
      });
   };

   const handleValidate = () => {
      if (!isValid() || !selectedNote) return;

      const result: QuarantineSessionResult = {
         noteId: selectedNote.id,
         processedDate: new Date(),
         processedBy: user?.username || 'Utilisateur Inconnu',
         items: Object.values(processData)
      };

      // Generate Print Data
      const generatedPrintData: PrintProduct[] = result.items
          .filter(item => {
              // Only print stickers for drugs or items with batches
              return item.batches.length > 0; 
          })
          .map(item => {
              const product = products.find(p => p.id === item.productId);
              return {
                  productName: product?.name || item.productId,
                  productId: item.productId,
                  batches: item.batches.map((batch, bIdx) => ({
                      batchNumber: batch.batchNumber,
                      expiryDate: batch.expiryDate,
                      packs: Array.from({ length: batch.quantity }).map((_, pIdx) => ({
                          productName: product?.name || item.productId,
                          productId: item.productId,
                          batchNumber: batch.batchNumber, 
                          expiryDate: batch.expiryDate,
                          // Generate Mock Serialized ID
                          serializedPackId: `SPK-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}-${bIdx}${pIdx}`
                      }))
                  }))
              };
          });

      if (generatedPrintData.length > 0) {
          setPrintData(generatedPrintData);
          setShowPrintModal(true);
      }

      onProcessNote(result);
      setSelectedNote(null);
   };

   const renderToDoTab = () => {
      let todoNotes = deliveryNotes.filter(n => n.status !== ProcessingStatus.PROCESSED);

      // Universal Search
      if (searchTerm) {
         const lowerTerm = searchTerm.toLowerCase();
         todoNotes = todoNotes.filter(n => {
            const supplierName = purchaseOrders.find(po => po.id === n.poId)?.supplierName || '';
            const inId = n.id.toLowerCase().includes(lowerTerm); // User BL Ref
            const inPO = n.poId.toLowerCase().includes(lowerTerm);
            const inSupplier = supplierName.toLowerCase().includes(lowerTerm);
            return inId || inPO || inSupplier;
         });
      }

      // Product Search
      if (productSearch) {
         const lowerProd = productSearch.toLowerCase();
         todoNotes = todoNotes.filter(n => {
            return n.items.some(item => {
               const pName = products.find(p => p.id === item.productId)?.name || item.productId;
               return pName.toLowerCase().includes(lowerProd);
            });
         });
      }

      return (
         <div className="space-y-6">
            <div className="hidden md:flex items-center space-x-4 mb-4">
               <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                     type="text"
                     placeholder="Rechercher par Réf BL, BC ou Fournisseur..."
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                     className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
               </div>
               <div className="relative flex-1">
                  <PackageCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                     type="text"
                     placeholder="Filtrer par produit..."
                     value={productSearch}
                     onChange={(e) => setProductSearch(e.target.value)}
                     className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
               </div>
            </div>

            {todoNotes.length === 0 ? (
               <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
                  <PackageCheck size={48} className="mx-auto text-slate-300 mb-4" />
                  <p className="text-slate-500 font-medium">
                     {searchTerm || productSearch ? 'Aucun résultat trouvé.' : 'Toutes les livraisons ont été traitées.'}
                  </p>
               </div>
            ) : (
               <div className="flex space-x-4 overflow-x-auto pb-4">
                  {todoNotes.map(note => {
                     const supplierName = purchaseOrders.find(po => po.id === note.poId)?.supplierName || 'Fournisseur Inconnu';
                     return (
                        <button
                           key={note.id}
                           onClick={() => setSelectedNote(note)}
                           className={`flex-shrink-0 w-72 text-left p-4 rounded-xl border transition-all duration-200
                        ${selectedNote?.id === note.id
                                 ? 'bg-blue-600 text-white shadow-lg ring-2 ring-blue-200 border-blue-600'
                                 : 'bg-white text-slate-600 hover:border-blue-400 border-slate-200 shadow-sm'}`}
                        >
                           <div className="flex justify-between items-start mb-2">
                              <span className="font-bold text-sm">Réf: {note.grnReference || note.id}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full border
                           ${selectedNote?.id === note.id ? 'bg-blue-500 border-blue-400 text-blue-50' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                                 {new Date(note.date).toLocaleDateString()}
                              </span>
                           </div>
                           <div className={`text-xs mb-3 space-y-1 ${selectedNote?.id === note.id ? 'text-blue-100' : 'text-slate-400'}`}>
                              <div>PO: {note.poId}</div>
                              <div className="flex items-center space-x-1 font-medium">
                                 <Building2 size={10} />
                                 <span>{supplierName}</span>
                              </div>
                           </div>
                           <div className="flex items-center space-x-2">
                              <Truck size={16} />
                              <span className="font-medium">{note.items.length} Produits</span>
                           </div>
                        </button>
                     );
                  })}
               </div>
            )}

            {selectedNote && (
               <div className="bg-white rounded-xl shadow-lg border border-slate-200 animate-in fade-in slide-in-from-bottom-4">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                     <div>
                        <h3 className="font-bold text-xl text-slate-900">Traitement Livraison {selectedNote.grnReference || selectedNote.id}</h3>
                        <p className="text-slate-500 text-sm">Assignez lots et emplacements pour injecter le stock.</p>
                     </div>
                     <div className="flex items-center space-x-3">
                        <button
                           disabled={!isValid()}
                           onClick={handleValidate}
                           className={`px-6 py-2.5 rounded-lg font-bold flex items-center space-x-2 transition-all
                        ${isValid()
                                 ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-200'
                                 : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                        >
                           <CheckCircle2 size={20} />
                           <span>Valider & Injecter Stock</span>
                        </button>
                        <button
                           onClick={() => setSelectedNote(null)}
                           className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                           <X size={24} />
                        </button>
                     </div>
                  </div>

                  <div className="p-6 space-y-8">
                     {selectedNote.items.map(item => {
                        const product = products.find(p => p.id === item.productId);
                        if (!product) return null;

                        const isDrug = product.type === ProductType.DRUG;
                        const data = processData[item.productId] || { productId: item.productId, deliveredQty: 0, batches: [], returns: [] };

                        const totalBatch = data.batches.reduce((sum: number, b: BatchEntry) => sum + (b.quantity || 0), 0);
                        const totalReturn = data.returns.reduce((sum: number, r: ReturnEntry) => sum + (r.quantity || 0), 0);
                        const totalAssigned = totalBatch + totalReturn;
                        const remaining = item.deliveredQty - totalAssigned;
                        const isBalanced = remaining === 0;
                        const isInvalid = remaining < 0;

                        return (
                           <div key={item.productId} className={`border rounded-xl p-5 transition-colors ${
                              isInvalid ? 'border-red-500 bg-red-50' :
                              isBalanced ? 'border-emerald-200 bg-emerald-50/10' : 
                              'border-slate-200'
                           }`}>
                              {isInvalid && (
                                 <div className="mb-4 bg-red-100 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center shadow-sm animate-in fade-in slide-in-from-top-2">
                                    <ShieldAlert className="mr-3 flex-shrink-0" size={24} />
                                    <span className="font-bold text-sm">Le nombre de produits à injecter et / ou à retourner ne doit pas dépasser le nombre de produits livrés.</span>
                                 </div>
                              )}
                              <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                                 <div className="flex items-center space-x-3">
                                    <div className={`p-2.5 rounded-lg ${isDrug ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                       {isDrug ? <ClipboardList size={20} /> : <PackageCheck size={20} />}
                                    </div>
                                    <div>
                                       <h4 className="font-bold text-slate-900 text-lg">{product.name}</h4>
                                       <div className="text-xs text-slate-500 flex items-center space-x-2">
                                          <span className="bg-slate-100 px-2 py-0.5 rounded">{product.id}</span>
                                          <span>•</span>
                                          <span>{product.type}</span>
                                       </div>
                                    </div>
                                 </div>

                                 <div className="flex items-center space-x-6 bg-slate-50 px-4 py-2 rounded-lg border border-slate-100">
                                    <div className="text-right">
                                       <div className="text-[10px] uppercase text-slate-400 font-bold">Livré</div>
                                       <div className="font-bold text-lg text-slate-800">{item.deliveredQty}</div>
                                    </div>
                                    <ArrowRight className="text-slate-300" size={20} />
                                    <div className="text-right">
                                       <div className="text-[10px] uppercase text-slate-400 font-bold">Assigné</div>
                                       <div className={`font-bold text-lg ${isBalanced ? 'text-emerald-600' : 'text-amber-600'}`}>
                                          {totalAssigned}
                                       </div>
                                    </div>
                                    <div className="text-right pl-4 border-l border-slate-200">
                                       <div className="text-[10px] uppercase text-slate-400 font-bold">Restant</div>
                                       <div className={`font-bold text-lg ${remaining === 0 ? 'text-slate-300' : 'text-red-600'}`}>
                                          {remaining}
                                       </div>
                                    </div>
                                 </div>
                              </div>

                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                                 <div className="bg-white border border-slate-200 rounded-lg p-4">
                                    <div className="flex justify-between items-center mb-4">
                                       <h5 className="font-bold text-sm text-emerald-700 flex items-center">
                                          <CheckCircle2 size={16} className="mr-2" />
                                          {isDrug ? 'Assignation Lots (Stock OK)' : 'Quantité Acceptable'}
                                       </h5>
                                       <button onClick={() => addBatch(item.productId)} className="text-xs flex items-center bg-emerald-50 text-emerald-700 px-2 py-1 rounded hover:bg-emerald-100 font-medium">
                                          <Plus size={12} className="mr-1" /> Ajouter {isDrug ? 'Lot' : 'Ligne'}
                                       </button>
                                    </div>

                                    <div className="space-y-3">
                                       {data.batches.length === 0 && <p className="text-sm text-slate-400 italic py-2">Aucun stock assigné.</p>}
                                       {data.batches.map((batch, idx) => {
                                          const isMissingDate = isDrug && batch.quantity > 0 && !batch.expiryDate;
                                          const isPastDate = isDrug && batch.expiryDate && new Date(batch.expiryDate) < new Date(new Date().setHours(0, 0, 0, 0));

                                          return (
                                             <div key={idx} className={`p-3 rounded-lg border relative group transition-colors ${isMissingDate || isPastDate ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100'}`}>
                                                <div className="grid grid-cols-12 gap-2 items-center">
                                                   {isDrug ? (
                                                      <div className="col-span-4">
                                                         <div className="flex items-center bg-white border border-slate-200 rounded px-2">
                                                            <Hash size={12} className="text-slate-400 mr-1" />
                                                            <input
                                                               placeholder="N° Lot"
                                                               className="w-full text-xs py-1.5 outline-none"
                                                               value={batch.batchNumber}
                                                               onChange={(e) => updateBatch(item.productId, idx, 'batchNumber', e.target.value)}
                                                            />
                                                         </div>
                                                      </div>
                                                   ) : <div className="col-span-4 text-xs text-slate-400 italic pl-2">Pas de Lot Requis</div>}

                                                   {isDrug ? (
                                                      <div className="col-span-3">
                                                         <CustomDatePicker
                                                            value={batch.expiryDate}
                                                            onChange={(date) => updateBatch(item.productId, idx, 'expiryDate', date)}
                                                            min={new Date().toISOString().split('T')[0]}
                                                            hasError={!!isPastDate}
                                                            placeholder="Date Péremption"
                                                         />
                                                      </div>
                                                   ) : <div className="col-span-3"></div>}

                                                   <div className="col-span-3">
                                                      <select
                                                         className="w-full text-xs py-1.5 px-1 border border-slate-200 rounded bg-white"
                                                         value={batch.locationId}
                                                         onChange={(e) => updateBatch(item.productId, idx, 'locationId', e.target.value)}
                                                      >
                                                         {locations.filter(l => l.scope === 'PHARMACY').map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                                                      </select>
                                                   </div>

                                                   <div className="col-span-2">
                                                      <input
                                                         type="number"
                                                         placeholder="Qté"
                                                         className="w-full text-center text-xs font-bold py-1.5 border border-slate-200 rounded bg-white focus:ring-1 focus:ring-emerald-500"
                                                         value={batch.quantity || ''}
                                                         onChange={(e) => updateBatch(item.productId, idx, 'quantity', parseInt(e.target.value) || 0)}
                                                      />
                                                   </div>
                                                </div>

                                                {/* Error Messages */}
                                                {(isMissingDate || isPastDate) && (
                                                   <div className="mt-2 flex items-center space-x-2 text-xs font-bold animate-in fade-in slide-in-from-top-1">
                                                      {isMissingDate && (
                                                         <div className="text-amber-600 flex items-center bg-amber-50 px-2 py-1 rounded border border-amber-100 w-full">
                                                            <AlertCircle size={12} className="mr-1.5" />
                                                            Veuillez entrer une date de péremption.
                                                         </div>
                                                      )}
                                                      {isPastDate && (
                                                         <div className="text-red-600 flex items-center bg-red-50 px-2 py-1 rounded border border-red-100 w-full">
                                                            <ShieldAlert size={12} className="mr-1.5" />
                                                            Vous ne pouvez pas choisir une date de péremption dans le passé.
                                                         </div>
                                                      )}
                                                   </div>
                                                )}

                                                <div className="flex justify-end items-center mt-2 pt-2 border-t border-slate-200/50">
                                                   <button onClick={() => removeBatch(item.productId, idx)} className="text-red-400 hover:text-red-600">
                                                      <X size={14} />
                                                   </button>
                                                </div>
                                             </div>
                                          );
                                       })}
                                    </div>
                                 </div>

                                 <div className="bg-white border border-slate-200 rounded-lg p-4">
                                    <div className="flex justify-between items-center mb-4">
                                       <h5 className="font-bold text-sm text-red-700 flex items-center">
                                          <ShieldAlert size={16} className="mr-2" />
                                          Retours / Rejets
                                       </h5>
                                       <button onClick={() => addReturn(item.productId)} className="text-xs flex items-center bg-red-50 text-red-700 px-2 py-1 rounded hover:bg-red-100 font-medium">
                                          <Plus size={12} className="mr-1" /> Ajouter Retour
                                       </button>
                                    </div>

                                    <div className="space-y-3">
                                       {data.returns.length === 0 && <p className="text-sm text-slate-400 italic py-2">Aucun retour enregistré.</p>}
                                       {data.returns.map((ret, idx) => (
                                          <div key={idx} className="bg-red-50/50 p-3 rounded-lg border border-red-100">
                                             <div className="grid grid-cols-12 gap-2 items-center">
                                                <div className="col-span-5">
                                                   <select
                                                      className="w-full text-xs py-1.5 px-1 border border-slate-200 rounded bg-white"
                                                      value={ret.reason}
                                                      onChange={(e) => updateReturn(item.productId, idx, 'reason', e.target.value)}
                                                   >
                                                      {Object.values(ReturnReason).map(r => <option key={r} value={r}>{r}</option>)}
                                                   </select>
                                                </div>
                                                <div className="col-span-5">
                                                   <input
                                                      placeholder="Notes..."
                                                      className="w-full text-xs py-1.5 px-2 border border-slate-200 rounded bg-white"
                                                      value={ret.notes || ''}
                                                      onChange={(e) => updateReturn(item.productId, idx, 'notes', e.target.value)}
                                                   />
                                                </div>
                                                <div className="col-span-2">
                                                   <input
                                                      type="number"
                                                      placeholder="Qté"
                                                      className="w-full text-center text-xs font-bold py-1.5 border border-slate-200 rounded bg-white text-red-700"
                                                      value={ret.quantity || ''}
                                                      onChange={(e) => updateReturn(item.productId, idx, 'quantity', parseInt(e.target.value) || 0)}
                                                   />
                                                </div>
                                             </div>
                                             <div className="flex justify-end mt-2">
                                                <button onClick={() => removeReturn(item.productId, idx)} className="text-red-400 hover:text-red-600">
                                                   <X size={14} />
                                                </button>
                                             </div>
                                          </div>
                                       ))}
                                    </div>
                                 </div>

                              </div>
                           </div>
                        );
                     })}
                  </div>
               </div>
            )}
         </div>
      );
   };

   const renderDoneTab = () => {
      let doneNotes = deliveryNotes.filter(n => n.status === ProcessingStatus.PROCESSED);

      // Universal Search (History)
      if (searchTerm) {
         const lowerTerm = searchTerm.toLowerCase();
         doneNotes = doneNotes.filter(n => {
            const supplierName = purchaseOrders.find(po => po.id === n.poId)?.supplierName || '';
            const inBL = (n.grnReference || n.id).toLowerCase().includes(lowerTerm);
            const inPO = n.poId.toLowerCase().includes(lowerTerm);
            const inSupplier = supplierName.toLowerCase().includes(lowerTerm);
            const inUser = (n.createdBy || '').toLowerCase().includes(lowerTerm);
            return inBL || inPO || inSupplier || inUser;
         });
      }

      // Product Search (History)
      if (productSearch) {
         const lowerProd = productSearch.toLowerCase();
         doneNotes = doneNotes.filter(n => {
            return n.items.some(item => {
               const pName = products.find(p => p.id === item.productId)?.name || item.productId;
               return pName.toLowerCase().includes(lowerProd);
            });
         });
      }

      // If no history found (after filtering)
      if (doneNotes.length === 0) {
         return (
            <div className="space-y-6">
                {/* Search Header for consistency even when empty result */}
                <div className="hidden md:flex items-center space-x-4 mb-4">
                  <div className="relative flex-1">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                     <input
                        type="text"
                        placeholder="Rechercher par Réf BL, BC, Fournisseur ou Utilisateur..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                     />
                  </div>
                  <div className="relative flex-1">
                     <PackageCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                     <input
                        type="text"
                        placeholder="Filtrer par produit..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                     />
                  </div>
               </div>

               <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                  <p className="text-slate-400">
                      {searchTerm || productSearch ? 'Aucun résultat trouvé dans l\'historique.' : 'Aucun historique pour le moment.'}
                  </p>
               </div>
            </div>
         );
      }

      // 1. DETAIL VIEW (Read-Only)
      if (selectedHistoryNote) {
         const po = purchaseOrders.find(p => p.id === selectedHistoryNote.poId);
         const supplierName = po?.supplierName || 'Fournisseur Inconnu';
         const blRef = selectedHistoryNote.grnReference || selectedHistoryNote.id;

         return (
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 animate-in fade-in slide-in-from-bottom-4">
               {/* Header */}
               <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                  <div>
                    <div className='flex items-center space-x-2 text-slate-500 mb-1'>
                        <History size={16} />
                        <span className='text-xs uppercase font-bold tracking-wider'>Historique de traitement</span>
                    </div>
                     <h3 className="font-bold text-xl text-slate-900 flex items-center">
                        <CheckCircle2 className="text-emerald-500 mr-2" size={24} />
                        Réf BL : {blRef}
                     </h3>
                     <div className="text-slate-500 text-sm mt-1 flex space-x-4">
                        <span className="flex items-center"><Building2 size={12} className="mr-1"/> {supplierName}</span>
                        <span>•</span>
                        <span>BC: {selectedHistoryNote.poId}</span>
                        <span>•</span>
                        <span>Traité le {selectedHistoryNote.processingResult?.processedDate ? new Date(selectedHistoryNote.processingResult.processedDate).toLocaleDateString() : 'N/A'}</span>
                     </div>
                  </div>
                  <div className="flex items-center space-x-3">
                     <button
                        onClick={() => {
                           const po = purchaseOrders.find(p => p.id === selectedHistoryNote.poId);
                           generateQuarantineReport(selectedHistoryNote, po, products);
                        }}
                        className="px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-100 font-medium flex items-center space-x-2 transition-colors"
                     >
                        <Printer size={16} />
                        <span>Télécharger PDF</span>
                     </button>
                     <button
                        onClick={() => setSelectedHistoryNote(null)}
                        className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 font-medium flex items-center space-x-2 transition-colors"
                     >
                        <ChevronLeft size={16} />
                        <span>Retour à la liste</span>
                     </button>
                  </div>
               </div>

               {/* Read-Only Content */}
               <div className="p-6 space-y-6">
                  {selectedHistoryNote.processingResult?.items.map((item, idx) => {
                     const product = products.find(p => p.id === item.productId);
                     // Calculate totals from the PROCESSED data
                     const totalInjected = item.batches.reduce((sum, b) => sum + b.quantity, 0);
                     const totalReturned = item.returns.reduce((sum, r) => sum + r.quantity, 0);

                     return (
                        <div key={idx} className="border border-slate-200 rounded-xl overflow-hidden">
                           {/* Level 1: Product Header */}
                           <div className="bg-slate-50 p-4 border-b border-slate-200 flex flex-col md:flex-row justify-between md:items-center gap-4">
                              <div className="flex items-center space-x-3">
                                 <div className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500">
                                    <PackageCheck size={20} />
                                 </div>
                                 <div>
                                    <h4 className="font-bold text-slate-900">{product?.name || item.productId}</h4>
                                 </div>
                              </div>
                              
                              <div className="flex items-center space-x-6 text-sm">
                                 <div className="text-right">
                                    <div className="text-[10px] uppercase text-slate-400 font-bold">Livré</div>
                                    <div className="font-bold text-slate-900">{item.deliveredQty}</div>
                                 </div>
                                 <div className="h-8 w-px bg-slate-200"></div>
                                 <div className="text-right">
                                    <div className="text-[10px] uppercase text-slate-400 font-bold">Injecté</div>
                                    <div className="font-bold text-emerald-600">{totalInjected}</div>
                                 </div>
                                 {totalReturned > 0 && (
                                     <>
                                        <div className="h-8 w-px bg-slate-200"></div>
                                        <div className="text-right">
                                            <div className="text-[10px] uppercase text-slate-400 font-bold">Retourné</div>
                                            <div className="font-bold text-red-600">{totalReturned}</div>
                                        </div>
                                     </>
                                 )}
                              </div>
                           </div>

                           {/* Level 2: Children (Batches & Returns) */}
                           <div className="p-0">
                                {/* Batches Section */}
                                {item.batches.length > 0 && (
                                    <div className="p-4">
                                        <h5 className="font-bold text-xs uppercase text-slate-500 mb-3 flex items-center">
                                            <Hash size={12} className="mr-1.5" />
                                            Lots Injectés
                                        </h5>
                                        <div className="bg-white border rounded-lg overflow-hidden">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-slate-50 text-xs text-slate-500 uppercase font-semibold">
                                                    <tr>
                                                        <th className="px-4 py-2">N° Lot</th>
                                                        <th className="px-4 py-2">Péremption</th>
                                                        <th className="px-4 py-2">Emplacement</th>
                                                        <th className="px-4 py-2 text-right">Qté</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {item.batches.map((batch, bIdx) => (
                                                        <tr key={bIdx} className="hover:bg-slate-50/50">
                                                            <td className="px-4 py-2 font-medium text-slate-700">{batch.batchNumber || '-'}</td>
                                                            <td className="px-4 py-2 text-slate-600">{batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString() : '-'}</td>
                                                            <td className="px-4 py-2">
                                                                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs border border-slate-200">
                                                                    {batch.locationId}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-2 text-right font-bold text-emerald-600">{batch.quantity}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Returns Section */}
                                {item.returns.length > 0 && (
                                    <div className="p-4 border-t border-slate-100 bg-red-50/10">
                                        <h5 className="font-bold text-xs uppercase text-red-400 mb-3 flex items-center">
                                            <ShieldAlert size={12} className="mr-1.5" />
                                            Retours / Rejets
                                        </h5>
                                        <div className="bg-white border border-red-100 rounded-lg overflow-hidden">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-red-50 text-xs text-red-500 uppercase font-semibold">
                                                    <tr>
                                                        <th className="px-4 py-2">Motif</th>
                                                        <th className="px-4 py-2">Note</th>
                                                        <th className="px-4 py-2 text-right">Qté</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-red-50">
                                                    {item.returns.map((ret, rIdx) => (
                                                        <tr key={rIdx} className="hover:bg-red-50/20">
                                                            <td className="px-4 py-2 font-medium text-red-700">{ret.reason}</td>
                                                            <td className="px-4 py-2 text-slate-500 italic">{ret.notes || '-'}</td>
                                                            <td className="px-4 py-2 text-right font-bold text-red-600">{ret.quantity}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                           </div>
                        </div>
                     );
                  })}
               </div>
            </div>
         );
      }

      // 2. LIST VIEW
      return (
         <div className="space-y-6">
            {/* Search Filters */}
            <div className="hidden md:flex items-center space-x-4 mb-4">
               <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                     type="text"
                     placeholder="Rechercher par Réf BL, BC, Fournisseur ou Utilisateur..."
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                     className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
               </div>
               <div className="relative flex-1">
                  <PackageCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                     type="text"
                     placeholder="Filtrer par produit..."
                     value={productSearch}
                     onChange={(e) => setProductSearch(e.target.value)}
                     className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
               </div>
            </div>

            {/* Cards List */}
            <div className="space-y-4">
               {doneNotes.map(note => {
                  const po = purchaseOrders.find(p => p.id === note.poId);
                  const supplierName = po?.supplierName || 'Fournisseur Inconnu';
                  const blRef = note.grnReference || note.id;

                  return (
                     <button 
                        key={note.id} 
                        onClick={() => setSelectedHistoryNote(note)}
                        className="w-full text-left bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all group"
                     >
                        <div className="flex flex-col md:flex-row justify-between items-start mb-4 gap-4">
                           <div className="space-y-1">
                              <h4 className="font-bold text-slate-800 text-lg flex items-center group-hover:text-blue-700 transition-colors">
                                 <CheckCircle2 size={20} className="text-emerald-500 mr-2" />
                                 Réf BL : {blRef}
                              </h4>
                              
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                                 <div className="flex items-center space-x-1">
                                    <span className="font-medium">BC:</span>
                                    <span>{note.poId}</span>
                                 </div>
                                 <div className="flex items-center space-x-1">
                                    <Building2 size={12} />
                                    <span>{supplierName}</span>
                                 </div>
                                 <div className="flex items-center space-x-1">
                                     <span className="text-slate-400">Par:</span>
                                     <span className="font-medium text-slate-600">{note.processingResult?.processedBy || note.createdBy}</span>
                                 </div>
                              </div>

                              <div className="text-xs text-slate-400 mt-1">
                                 Traité le: {note.processingResult?.processedDate ? new Date(note.processingResult.processedDate).toLocaleDateString() : 'Inconnu'}
                              </div>
                           </div>

                           <div className="flex items-center space-x-2 self-start md:self-center">
                              <button
                                 onClick={(e) => {
                                    e.stopPropagation();
                                    generateQuarantineReport(note, po, products);
                                 }}
                                 className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                                 title="Télécharger le récapitulatif (PDF)"
                              >
                                 <Printer size={18} />
                              </button>
                              <div className="flex items-center space-x-2 text-slate-400 group-hover:text-blue-500">
                                 <span className="text-sm font-medium">Voir détails</span>
                                 <ChevronRight size={16} />
                              </div>
                           </div>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-slate-50">
                           {note.processingResult?.items.map((item, idx) => {
                              const prodName = products.find(p => p.id === item.productId)?.name || item.productId;
                              const goodStock = item.batches.reduce<number>((sum, b) => sum + b.quantity, 0);
                              const returns = item.returns.reduce((sum, r) => sum + r.quantity, 0);

                              return (
                                 <div key={idx} className="flex justify-between text-sm py-2 border-b border-slate-50 last:border-0 group-hover:border-slate-100">
                                    <span className="font-medium text-slate-700">{prodName}</span>
                                    <div className="flex space-x-4">
                                       <span className="text-emerald-600 font-medium">Injecté: {goodStock}</span>
                                       {returns > 0 && <span className="text-red-600 font-medium">Retourné: {returns}</span>}
                                    </div>
                                 </div>
                              );
                           })}
                        </div>
                     </button>
                  );
               })}
            </div>
         </div>
      );
   };

   return (
      <div className="space-y-6">
         <div className="flex space-x-2 bg-white p-1 rounded-lg border border-slate-200 w-fit">
            <button
               onClick={() => { setActiveTab('todo'); setSelectedHistoryNote(null); }}
               className={`px-4 py-2 rounded-md text-sm font-medium transition-all
             ${activeTab === 'todo' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
            >
               À Faire ({deliveryNotes.filter(n => n.status !== ProcessingStatus.PROCESSED).length})
            </button>
            <button
               onClick={() => { setActiveTab('done'); setSelectedHistoryNote(null); }}
               className={`px-4 py-2 rounded-md text-sm font-medium transition-all
             ${activeTab === 'done' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
            >
               Terminé ({deliveryNotes.filter(n => n.status === ProcessingStatus.PROCESSED).length})
            </button>
         </div>

         {activeTab === 'todo' ? renderToDoTab() : renderDoneTab()}
         
         <QRPrintingModal 
             isOpen={showPrintModal} 
             onClose={() => setShowPrintModal(false)}
             data={printData}
         />
      </div>
   );
};
