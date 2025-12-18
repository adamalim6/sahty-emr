
import React, { useState, useEffect } from 'react';
import { 
  DeliveryNote, ProductDefinition, StockLocation, ProcessingStatus, 
  ProductType, ReturnReason, BatchEntry, ReturnEntry, ProductProcessData, 
  QuarantineSessionResult
} from '../../types/pharmacy';
import { 
  CheckCircle2, AlertCircle, PackageCheck, Truck, Calendar, 
  MapPin, Hash, Plus, X, QrCode, ArrowRight, ClipboardList, ShieldAlert,
  ChevronRight, Printer
} from 'lucide-react';

interface QuarantineManagerProps {
  deliveryNotes: DeliveryNote[];
  products: ProductDefinition[];
  locations: StockLocation[];
  onProcessNote: (result: QuarantineSessionResult) => void;
}

export const QuarantineManager: React.FC<QuarantineManagerProps> = ({ 
  deliveryNotes, 
  products, 
  locations,
  onProcessNote 
}) => {
  const [activeTab, setActiveTab] = useState<'todo' | 'done'>('todo');
  const [selectedNote, setSelectedNote] = useState<DeliveryNote | null>(null);
  
  const [processData, setProcessData] = useState<Record<string, ProductProcessData>>({});

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
    const newBatch: BatchEntry = {
      batchNumber: '',
      expiryDate: '',
      quantity: 0,
      locationId: locations[0]?.name || ''
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

      const totalBatch = data.batches.reduce((sum, b) => sum + (b.quantity || 0), 0);
      const totalReturn = data.returns.reduce((sum, r) => sum + (r.quantity || 0), 0);
      
      if (totalBatch + totalReturn !== item.deliveredQty) return false;

      const batchesValid = data.batches.every(b => 
        b.quantity > 0 && b.locationId && 
        (products.find(p => p.id === item.productId)?.type !== ProductType.DRUG || (b.batchNumber && b.expiryDate))
      );
      
      const returnsValid = data.returns.every(r => r.quantity > 0 && r.reason);

      return batchesValid && returnsValid;
    });
  };

  const handleValidate = () => {
    if (!isValid() || !selectedNote) return;

    const result: QuarantineSessionResult = {
      noteId: selectedNote.id,
      processedDate: new Date(),
      items: Object.values(processData)
    };

    onProcessNote(result);
    setSelectedNote(null);
  };

  const renderToDoTab = () => {
    const todoNotes = deliveryNotes.filter(n => n.status !== ProcessingStatus.PROCESSED);

    if (todoNotes.length === 0) {
      return (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
           <PackageCheck size={48} className="mx-auto text-slate-300 mb-4" />
           <p className="text-slate-500 font-medium">Toutes les livraisons ont été traitées.</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex space-x-4 overflow-x-auto pb-4">
           {todoNotes.map(note => (
             <button
               key={note.id}
               onClick={() => setSelectedNote(note)}
               className={`flex-shrink-0 w-72 text-left p-4 rounded-xl border transition-all duration-200
                 ${selectedNote?.id === note.id 
                   ? 'bg-blue-600 text-white shadow-lg ring-2 ring-blue-200 border-blue-600' 
                   : 'bg-white text-slate-600 hover:border-blue-400 border-slate-200 shadow-sm'}`}
             >
                <div className="flex justify-between items-start mb-2">
                   <span className="font-bold text-sm">Réf: {note.id}</span>
                   <span className={`text-xs px-2 py-0.5 rounded-full border
                      ${selectedNote?.id === note.id ? 'bg-blue-500 border-blue-400 text-blue-50' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                      {new Date(note.date).toLocaleDateString()}
                   </span>
                </div>
                <div className={`text-xs mb-3 ${selectedNote?.id === note.id ? 'text-blue-100' : 'text-slate-400'}`}>
                   PO: {note.poId} • GRN: {note.grnReference}
                </div>
                <div className="flex items-center space-x-2">
                   <Truck size={16} />
                   <span className="font-medium">{note.items.length} Produits</span>
                </div>
             </button>
           ))}
        </div>

        {selectedNote && (
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 animate-in fade-in slide-in-from-bottom-4">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                <div>
                   <h3 className="font-bold text-xl text-slate-900">Traitement Livraison {selectedNote.id}</h3>
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
                </div>
             </div>

             <div className="p-6 space-y-8">
                {selectedNote.items.map(item => {
                   const product = products.find(p => p.id === item.productId);
                   if (!product) return null;
                   
                   const isDrug = product.type === ProductType.DRUG;
                   const data = processData[item.productId] || { batches: [], returns: [] };
                   
                   const totalBatch = data.batches.reduce((sum, b) => sum + (b.quantity || 0), 0);
                   const totalReturn = data.returns.reduce((sum, r) => sum + (r.quantity || 0), 0);
                   const totalAssigned = totalBatch + totalReturn;
                   const remaining = item.deliveredQty - totalAssigned;
                   const isBalanced = remaining === 0;

                   return (
                     <div key={item.productId} className={`border rounded-xl p-5 transition-colors ${isBalanced ? 'border-emerald-200 bg-emerald-50/10' : 'border-slate-200'}`}>
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
                                 {data.batches.map((batch, idx) => (
                                    <div key={idx} className="bg-slate-50 p-3 rounded-lg border border-slate-100 relative group">
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
                                                <input 
                                                   type="date"
                                                   className="w-full text-xs py-1.5 px-1 border border-slate-200 rounded bg-white"
                                                   value={batch.expiryDate}
                                                   onChange={(e) => updateBatch(item.productId, idx, 'expiryDate', e.target.value)}
                                                />
                                             </div>
                                          ) : <div className="col-span-3"></div>}
                                          
                                          <div className="col-span-3">
                                             <select 
                                                className="w-full text-xs py-1.5 px-1 border border-slate-200 rounded bg-white"
                                                value={batch.locationId}
                                                onChange={(e) => updateBatch(item.productId, idx, 'locationId', e.target.value)}
                                             >
                                                {locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
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
                                       
                                       <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200/50">
                                          <button className="text-[10px] text-blue-600 hover:underline flex items-center">
                                             <QrCode size={10} className="mr-1" /> Étiquettes
                                          </button>
                                          <button onClick={() => removeBatch(item.productId, idx)} className="text-red-400 hover:text-red-600">
                                             <X size={14} />
                                          </button>
                                       </div>
                                    </div>
                                 ))}
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
    const doneNotes = deliveryNotes.filter(n => n.status === ProcessingStatus.PROCESSED);

    if (doneNotes.length === 0) {
      return (
        <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
           <p className="text-slate-400">Aucun historique pour le moment.</p>
        </div>
      );
    }

    return (
       <div className="space-y-4">
          {doneNotes.map(note => (
             <div key={note.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm opacity-75 hover:opacity-100 transition-opacity">
                <div className="flex justify-between items-start mb-4">
                   <div>
                      <h4 className="font-bold text-slate-800 text-lg flex items-center">
                         <CheckCircle2 size={20} className="text-emerald-500 mr-2" />
                         Réf: {note.id}
                      </h4>
                      <div className="text-xs text-slate-500 mt-1">
                         Traité le: {note.processingResult?.processedDate.toLocaleDateString() || 'Inconnu'}
                      </div>
                   </div>
                   <button className="flex items-center space-x-2 text-slate-500 hover:text-blue-600 text-sm">
                      <Printer size={16} />
                      <span>Imprimer Résumé</span>
                   </button>
                </div>
                
                <div className="space-y-2">
                   {note.processingResult?.items.map((item, idx) => {
                      const prodName = products.find(p => p.id === item.productId)?.name || item.productId;
                      const goodStock = item.batches.reduce((sum, b) => sum + b.quantity, 0);
                      const returns = item.returns.reduce((sum, r) => sum + r.quantity, 0);
                      
                      return (
                         <div key={idx} className="flex justify-between text-sm py-2 border-t border-slate-50">
                            <span className="font-medium text-slate-700">{prodName}</span>
                            <div className="flex space-x-4">
                               <span className="text-emerald-600 font-medium">Injecté: {goodStock}</span>
                               {returns > 0 && <span className="text-red-600 font-medium">Retourné: {returns}</span>}
                            </div>
                         </div>
                      );
                   })}
                </div>
             </div>
          ))}
       </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex space-x-2 bg-white p-1 rounded-lg border border-slate-200 w-fit">
         <button 
           onClick={() => setActiveTab('todo')}
           className={`px-4 py-2 rounded-md text-sm font-medium transition-all
             ${activeTab === 'todo' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
         >
           À Faire ({deliveryNotes.filter(n => n.status !== ProcessingStatus.PROCESSED).length})
         </button>
         <button 
           onClick={() => setActiveTab('done')}
           className={`px-4 py-2 rounded-md text-sm font-medium transition-all
             ${activeTab === 'done' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
         >
           Terminé ({deliveryNotes.filter(n => n.status === ProcessingStatus.PROCESSED).length})
         </button>
      </div>

      {activeTab === 'todo' ? renderToDoTab() : renderDoneTab()}
    </div>
  );
};
