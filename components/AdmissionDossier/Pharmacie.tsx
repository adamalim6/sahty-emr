import React, { useEffect, useState } from 'react';
import { Pill, Plus, Calendar, Hash, Tag, DollarSign, Package, AlertCircle } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { Dispensation } from '../../types/serialized-pack';
import { ProductDefinition } from '../../types/pharmacy';

export const Pharmacie: React.FC = () => {
  const { id } = useParams<{ id: string }>(); // Admission ID
  const [dispensations, setDispensations] = useState<Dispensation[]>([]);
  const [products, setProducts] = useState<ProductDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        if (id) {
          const [dispData, prodData] = await Promise.all([
            api.getDispensationsByAdmission(id),
            api.getCatalog()
          ]);
          // Filter dispensations only for this admission just in case, though API handles it
          setDispensations(dispData);
          setProducts(prodData);
        }
      } catch (error) {
        console.error("Error fetching pharmacy data", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const getProductDetails = (productId: string) => {
    return products.find(p => p.id === productId);
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
        <button className="bg-slate-900 text-white px-5 py-2 rounded-xl font-bold flex items-center shadow-lg hover:bg-slate-800 transition-colors">
          <Plus size={18} className="mr-2" /> Sortie Pharmacie
        </button>
      </div>

      {dispensations.length === 0 ? (
        <div className="text-center py-20 text-slate-300">
          <Pill size={48} className="mx-auto mb-4 opacity-20" />
          <p className="font-bold">Aucune consommation médicamenteuse enregistrée pour cette admission.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
          {dispensations.map((disp) => {
            const product = getProductDetails(disp.productId);
            return (
              <div key={disp.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-md transition-all group relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Pill size={64} className="text-indigo-600" />
                </div>

                <div className="mb-4">
                  <h4 className="font-black text-slate-800 text-lg leading-tight mb-1">{disp.productName || product?.name}</h4>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center">
                    <Tag size={12} className="mr-1" />
                    {product?.molecules && product.molecules.length > 0 ? product.molecules.map(m => m.name).join(', ') : 'N/A'}
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center text-sm text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <Hash size={16} className="text-slate-400 mr-2" />
                    <span className="font-mono font-bold text-slate-700">{disp.lotNumber}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-sm text-slate-600">
                      <Calendar size={16} className="text-slate-400 mr-2" />
                      <span>{new Date(disp.dispensedAt).toLocaleDateString()}</span>
                    </div>
                    <div className="text-xs text-slate-400">
                      {new Date(disp.dispensedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-between items-end">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Quantité</span>
                    <div className="flex items-center font-bold text-slate-800">
                      <Package size={16} className="mr-1.5 text-indigo-500" />
                      {disp.quantity} {(disp.mode as any) === 'FULL_PACK' || disp.mode === 'Boîte Complète' ? 'Bte(s)' : 'Unités'}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Prix Total</span>
                    <div className="font-black text-lg text-emerald-600 flex items-center justify-end">
                      {disp.totalPriceInclVAT.toFixed(2)} <span className="text-xs ml-1 font-bold text-emerald-700/50">MAD</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
