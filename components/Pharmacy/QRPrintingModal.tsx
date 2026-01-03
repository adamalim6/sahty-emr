import React, { useState, useRef } from 'react';
import { X, Printer, CheckCircle2 } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

export interface QRData {
   productName: string;
   productId: string;
   batchNumber: string;
   expiryDate: string;
   serializedPackId: string;
}

export interface PrintBatch {
   batchNumber: string;
   expiryDate: string;
   packs: QRData[];
}

export interface PrintProduct {
   productName: string;
   productId: string;
   batches: PrintBatch[];
}

export interface QRPrintingModalProps {
   isOpen: boolean;
   onClose: () => void;
   data: PrintProduct[];
}

export const QRPrintingModal: React.FC<QRPrintingModalProps> = ({ isOpen, onClose, data }) => {
   const [stickerSize, setStickerSize] = useState<15 | 20>(15);
   const printRef = useRef<HTMLDivElement>(null);

   if (!isOpen) return null;

   const handlePrint = () => {
      window.print();
   };

   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm print:bg-white print:p-0">
         {/* Screen UI - Hidden when printing */}
         <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col print:hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
               <div>
                  <h2 className="text-xl font-bold text-slate-800 flex items-center">
                     <Printer className="mr-3 text-blue-600" />
                     Impression des étiquettes QR (optionnel)
                  </h2>
                  <p className="text-slate-500 text-sm mt-1">
                     L'injection en stock a été effectuée avec succès. Vous pouvez maintenant imprimer les étiquettes.
                  </p>
               </div>
               <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={24} />
               </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
               <div className="bg-white border border-slate-200 rounded-lg p-6 mb-6">
                  <h3 className="font-semibold text-slate-800 mb-4">Configuration Impression</h3>
                  <div className="flex items-center space-x-8">
                     <div>
                        <span className="block text-xs font-medium text-slate-500 mb-2 uppercase">Format Papier</span>
                        <div className="px-4 py-2 bg-slate-100 rounded text-slate-700 font-medium text-sm border border-slate-200">
                           A4 (Fixe)
                        </div>
                     </div>
                     <div>
                        <span className="block text-xs font-medium text-slate-500 mb-2 uppercase">Taille Étiquette</span>
                        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                           <button
                              onClick={() => setStickerSize(15)}
                              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                                 stickerSize === 15 ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                              }`}
                           >
                              15 × 15 mm
                           </button>
                           <button
                              onClick={() => setStickerSize(20)}
                              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                                 stickerSize === 20 ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                              }`}
                           >
                              20 × 20 mm
                           </button>
                        </div>
                     </div>
                  </div>
               </div>

               <div className="bg-white border border-slate-200 rounded-lg p-6 min-h-[500px] flex items-center justify-center bg-dots">
                  <div className="text-center space-y-2">
                      <p className="text-slate-400 text-sm">Aperçu simplifié</p>
                      <div className="inline-block p-4 border border-dashed border-slate-300 rounded bg-slate-50">
                         {data.map((prod, i) => (
                             <div key={i} className="mb-4">
                                 <div className="text-xs font-bold text-slate-700 mb-2">{prod.productName}</div>
                                 <div className="flex flex-wrap gap-2 justify-center max-w-md">
                                     {prod.batches.flatMap(b => b.packs).slice(0, 5).map((p, j) => (
                                         <div key={j} className="w-8 h-8 bg-slate-800 rounded-sm opacity-20"></div>
                                     ))}
                                     {prod.batches.flatMap(b => b.packs).length > 5 && (
                                         <div className="w-8 h-8 flex items-center justify-center text-xs text-slate-400">+...</div>
                                     )}
                                 </div>
                             </div>
                         ))}
                      </div>
                  </div>
               </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end space-x-4">
               <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
               >
                  Ignorer / Fermer
               </button>
               <button
                  onClick={handlePrint}
                  className="px-6 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 flex items-center"
               >
                  <Printer size={18} className="mr-2" />
                  Imprimer les étiquettes QR
               </button>
            </div>
         </div>

         {/* Print Layout - Visible ONLY when printing */}
         <div className="hidden print:block print:w-full print:h-full print:bg-white inset-0 absolute">
             <div className="print-content p-8">
                 {data.map((product, pIdx) => (
                     <div key={pIdx} className="mb-8 break-inside-avoid">
                         <h1 className="text-lg font-bold mb-1">{product.productName}</h1>
                         <p className="text-sm text-slate-500 mb-4 font-mono">{product.productId}</p>
                         
                         {product.batches.map((batch, bIdx) => (
                             <div key={bIdx} className="mb-6 break-inside-avoid">
                                 <div className="flex items-center space-x-4 mb-3 border-b border-black/10 pb-1">
                                     <span className="font-bold text-sm">Lot: {batch.batchNumber}</span>
                                     <span className="text-sm">Exp: {batch.expiryDate}</span>
                                 </div>
                                 
                                 <div className="flex flex-wrap gap-4">
                                     {batch.packs.map((pack, k) => {
                                         const payload = JSON.stringify({
                                             product_name: pack.productName,
                                             product_id: pack.productId,
                                             batch_number: pack.batchNumber,
                                             expiry_date: pack.expiryDate,
                                             serialized_pack_id: pack.serializedPackId
                                         });

                                         return (
                                             <div key={k} className="flex flex-col items-center">
                                                 <QRCodeCanvas 
                                                     value={payload} 
                                                     size={stickerSize === 15 ? 56 : 75} // approx px for mm @ 96dpi (1mm ~ 3.78px)
                                                     level={"L"}
                                                 />
                                                 <span className="text-[8px] font-mono mt-0.5">{pack.serializedPackId.split('-').pop()}</span>
                                             </div>
                                         );
                                     })}
                                 </div>
                             </div>
                         ))}
                     </div>
                 ))}
             </div>
         </div>
         
         <style>{`
             @media print {
                 @page { size: A4; margin: 10mm; }
                 body * { visibility: hidden; }
                 .fixed, .fixed * { visibility: visible; }
                 .print\\:hidden { display: none !important; }
                 .print\\:block { display: block !important; position: absolute; top: 0; left: 0; width: 100%; }
                 /* Ensure black text specifically for print */
                 .print-content { color: black !important; }
             }
         `}</style>
      </div>
   );
};
