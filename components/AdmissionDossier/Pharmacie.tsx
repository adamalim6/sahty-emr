import React, { useEffect, useState } from 'react';
import { Pill, Plus, Calendar, Hash, Tag, DollarSign, Package, AlertCircle, Undo2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { ProductDefinition } from '../../types/pharmacy';
// Import local or define AdmissionMedicationConsumption interface if not available in frontend types yet
// For now, let's define it locally or use any to avoid type errors until frontend types sync
interface Consumption {
    id: string;
    admissionId: string;
    productId: string;
    productName: string;
    quantity: number;
    mode: string; // 'Boîte Complète' | 'Par Unité'
    lotNumber: string;
    batchNumber: string;
    dispensedAt: string;
    dispensedBy: string;
    source?: 'PHARMACY' | 'SERVICE_STOCK';
    prescriptionId?: string;
}

import { ServiceStockExitModal } from './ServiceStockExitModal';
import { ReturnCreationModal } from './ReturnCreationModal';
import { Admission } from '../../types';

interface PharmacieProps {
  admission?: Admission;
}

export const Pharmacie: React.FC<PharmacieProps> = ({ admission }) => {
  const { id } = useParams<{ id: string }>(); // Admission ID
  const [consumptions, setConsumptions] = useState<Consumption[]>([]);
  const [products, setProducts] = useState<ProductDefinition[]>([]);
  const [pendingReturns, setPendingReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExitModal, setShowExitModal] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [selectedConsumption, setSelectedConsumption] = useState<Consumption | undefined>(undefined);

  const fetchData = async () => {
    try {
      setLoading(true);
      if (id) {
        const [consData, prodData, returnsData] = await Promise.all([
          api.getConsumptionsByAdmission(id),
          api.getCatalog(),
          api.getReturnsByAdmission(id)
        ]);
        setConsumptions(consData);
        setProducts(prodData);
        setPendingReturns(returnsData.filter((r: any) => r.status === 'PENDING_QA'));
      }
    } catch (error) {
      console.error("Error fetching pharmacy data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const getProductDetails = (productId: string) => {
    return products.find(p => p.id === productId);
  };

  const getPendingReturnQty = (consumptionId: string) => {
    let qty = 0;
    pendingReturns.forEach(req => {
      req.items.forEach((item: any) => {
        // Assuming consumptionId maps to dispensationId in return logic for now
        // Refactor Note: ReturnRequests might need to link to Consumption ID or Dispensation ID? 
        // For now, let's assume loose linking or that the consumption ID is passed.
        if (item.dispensationId === consumptionId) {
          qty += item.quantity;
        }
      });
    });
    return qty;
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Chargement...</div>;
  }

  return (
    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm min-h-[400px]">
      <div className="flex justify-between items-center mb-8">
        <h3 className="text-lg font-black uppercase text-slate-800 flex items-center">
          <Pill className="mr-3 text-rose-600" /> Consommation Pharmacie
        </h3>
        <button
          onClick={() => setShowExitModal(true)}
          className="bg-slate-900 text-white px-5 py-2 rounded-xl font-bold flex items-center shadow-lg hover:bg-slate-800 transition-colors"
        >
          <Plus size={18} className="mr-2" /> Sortie Pharmacie
        </button>
      </div>

      {showExitModal && admission && (
        <ServiceStockExitModal
          isOpen={showExitModal}
          onClose={() => setShowExitModal(false)}
          admissionId={admission.id}
          // TEMP DEMO: Force Service Médecine stock view as per user request
          serviceName="Service Médecine"
          onSuccess={fetchData}
        />
      )}

      {consumptions.length === 0 ? (
        <div className="text-center py-20 text-slate-300">
          <Pill size={48} className="mx-auto mb-4 opacity-20" />
          <p className="font-bold">Aucune consommation médicamenteuse enregistrée pour cette admission.</p>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-300">
          {(() => {
            // GROUP BY PRODUCT
            const groupedConsumptions: Record<string, Consumption[]> = {};
            consumptions.forEach(c => {
               // Filter out effectively returned? Or keep logic?
              if (!groupedConsumptions[c.productId]) {
                groupedConsumptions[c.productId] = [];
              }
              groupedConsumptions[c.productId].push(c);
            });

            return Object.entries(groupedConsumptions).map(([productId, items]) => {
              const product = getProductDetails(productId);
              if (!product) return null;

              // Calculate Totals for Header
              let totalRemainingUnits = 0;
              let totalOriginalUnits = 0;

              items.forEach(c => {
                const unitsPerPack = product.unitsPerPack || 1;
                // Check against DispensationMode enum values ('Boîte Complète') OR backend enum ('FULL_PACK' if saved as key)
                // PharmacyService saves whatever is passed. Frontend passes DispensationMode value.
                const isBoxMode = c.mode === 'Boîte Complète' || c.mode === 'FULL_PACK' || c.mode === 'BOX';

                const originalUnits = isBoxMode ? c.quantity * unitsPerPack : c.quantity;
                const returnedUnits = 0; // TODO: Link Returns to Consumptions
                const pendingQty = getPendingReturnQty(c.id); 
                const pendingUnits = isBoxMode ? pendingQty * unitsPerPack : pendingQty;

                const effectiveRemainingUnits = originalUnits - returnedUnits - pendingUnits;

                totalRemainingUnits += Math.max(0, effectiveRemainingUnits);
                totalOriginalUnits += originalUnits;
              });

              if (totalRemainingUnits <= 0) return null; // Hide fully returned/consumed if 0? Actually maybe show for history. User wants "consumed stuff".

              // Determine display string (Box + Units)
              const unitsPerPack = product.unitsPerPack || 1;
              const remainingBoxes = Math.floor(totalRemainingUnits / unitsPerPack);
              const remainingLoose = totalRemainingUnits % unitsPerPack;

              let qtyDisplay = '';
              if (unitsPerPack > 1) {
                if (remainingBoxes > 0) qtyDisplay += `${remainingBoxes} Bte(s) `;
                if (remainingLoose > 0) qtyDisplay += `${remainingLoose} Uté(s)`;
              } else {
                qtyDisplay = `${totalRemainingUnits} Uté(s)`;
              }

              return (
                <div key={productId} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  {/* PRODUCT HEADER */}
                  <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                    <div className="flex items-center space-x-4">
                      <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm text-indigo-600">
                        <Package size={24} />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-800 text-lg">{product.name}</h4>
                        <div className="flex items-center space-x-2 text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                          <span>Total: <span className="text-emerald-600">{qtyDisplay}</span></span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CONSUMPTION LIST */}
                  <div className="divide-y divide-slate-100">
                    {items.map(cons => {
                      const pendingQty = getPendingReturnQty(cons.id);
                      const isBoxMode = cons.mode === 'Boîte Complète' || cons.mode === 'FULL_PACK' || cons.mode === 'BOX';
                      const unitsPerPack = product.unitsPerPack || 1;

                      const originalUnits = isBoxMode ? cons.quantity * unitsPerPack : cons.quantity;
                      const returnedUnits = 0; // Link
                      const pendingUnits = isBoxMode ? pendingQty * unitsPerPack : pendingQty;

                      const remainingInfoUnits = originalUnits - returnedUnits - pendingUnits;
                      const remainingInfoBoxes = Math.floor(remainingInfoUnits / unitsPerPack);
                      const remainingInfoLoose = remainingInfoUnits % unitsPerPack;

                      return (
                        <div key={cons.id} className="p-4 hover:bg-slate-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                          {/* Left: Batch & Origin */}
                          <div className="flex items-center gap-4">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2 mb-1">
                                {cons.source === 'SERVICE_STOCK' ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide bg-blue-100 text-blue-700">Stock Service</span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide bg-purple-100 text-purple-700">Pharmacie</span>
                                )}
                                <span className="text-xs font-mono font-bold text-slate-500">Lot {cons.lotNumber}</span>
                              </div>
                              <div className="text-xs text-slate-400">
                                Dispensé le {new Date(cons.dispensedAt).toLocaleDateString()} à {new Date(cons.dispensedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>

                          {/* Right: Quantity & Actions */}
                          <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto">
                            <div className="text-right">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quantité</div>
                              <div className="font-bold text-slate-700">
                                {unitsPerPack > 1 ? (
                                  <>
                                    {remainingInfoBoxes > 0 && <span>{remainingInfoBoxes} Bte(s)</span>}
                                    {remainingInfoBoxes > 0 && remainingInfoLoose > 0 && <span className="mx-1">+</span>}
                                    {remainingInfoLoose > 0 && <span>{remainingInfoLoose} Uté(s)</span>}
                                  </>
                                ) : (
                                  <span>{remainingInfoUnits} Uté(s)</span>
                                )}
                              </div>
                            </div>

                            <button
                              onClick={() => {
                                setSelectedConsumption(cons);
                                setReturnModalOpen(true);
                              }}
                              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-indigo-600 rounded-lg transition-colors"
                              title="Retourner ce produit"
                            >
                              <Undo2 size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}

      {returnModalOpen && admission && selectedConsumption && (
        <ReturnCreationModal
          isOpen={returnModalOpen}
          onClose={() => setReturnModalOpen(false)}
          admissionId={admission.id}
          dispensation={selectedConsumption as any} // Cast for now until types align
         product={getProductDetails(selectedConsumption.productId)}
          onSuccess={() => {
            fetchData();
          }}
          serviceName={admission.service}
        />
      )}
    </div>
  );
};
