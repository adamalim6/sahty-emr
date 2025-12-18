
import React, { useMemo, useState } from 'react';
import { InventoryItem, ItemCategory } from '../../types/pharmacy';
import { ChevronDown, ChevronRight, Hash, Calendar, MapPin, Check, Circle, Eye, EyeOff } from 'lucide-react';

interface InventoryTableProps {
  items: InventoryItem[];
  onUpdateQuantity: (id: string, qty: number | null) => void;
  filter: string;
  readOnly?: boolean;
}

interface ProductGroup {
  productId: string;
  name: string;
  category: ItemCategory;
  items: InventoryItem[];
  totalTheoretical: number;
  totalActual: number;
  totalVariance: number;
  totalValueDiff: number;
  hasDiscrepancy: boolean;
  itemsCounted: number;
}

export const InventoryTable: React.FC<InventoryTableProps> = ({ items, onUpdateQuantity, filter, readOnly = false }) => {
  
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [completedProducts, setCompletedProducts] = useState<Set<string>>(new Set());
  const [hideCompleted, setHideCompleted] = useState(false);

  const toggleGroup = (productId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
    }
    setExpandedGroups(newExpanded);
  };

  const toggleCompletion = (e: React.MouseEvent, productId: string) => {
    e.stopPropagation(); 
    const newCompleted = new Set(completedProducts);
    if (newCompleted.has(productId)) {
      newCompleted.delete(productId);
    } else {
      newCompleted.add(productId);
      if (expandedGroups.has(productId)) {
        const newExpanded = new Set(expandedGroups);
        newExpanded.delete(productId);
        setExpandedGroups(newExpanded);
      }
    }
    setCompletedProducts(newCompleted);
  };

  const productGroups = useMemo(() => {
    const groups: Record<string, ProductGroup> = {};

    items.forEach(item => {
      const matchesFilter = 
        item.name.toLowerCase().includes(filter.toLowerCase()) || 
        item.id.toLowerCase().includes(filter.toLowerCase()) ||
        item.batchNumber.toLowerCase().includes(filter.toLowerCase()) ||
        item.location.toLowerCase().includes(filter.toLowerCase());

      if (!matchesFilter && filter !== '') return;

      if (!groups[item.productId]) {
        groups[item.productId] = {
          productId: item.productId,
          name: item.name,
          category: item.category,
          items: [],
          totalTheoretical: 0,
          totalActual: 0,
          totalVariance: 0,
          totalValueDiff: 0,
          hasDiscrepancy: false,
          itemsCounted: 0
        };
      }

      const group = groups[item.productId];
      group.items.push(item);

      group.totalTheoretical += item.theoreticalQty;
      
      if (item.actualQty !== null) {
        group.itemsCounted += 1;
        group.totalActual += item.actualQty;
        const itemVariance = item.actualQty - item.theoreticalQty;
        group.totalVariance += itemVariance;
        group.totalValueDiff += (itemVariance * item.unitPrice);
        if (itemVariance !== 0) group.hasDiscrepancy = true;
      }
    });

    Object.values(groups).forEach(g => {
       g.totalVariance = g.totalActual - g.totalTheoretical;
       g.totalValueDiff = g.totalVariance * (g.items[0]?.unitPrice || 0); 
    });

    let result = Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));

    if (hideCompleted) {
      result = result.filter(g => !completedProducts.has(g.productId));
    }

    return result;
  }, [items, filter, hideCompleted, completedProducts]);

  useMemo(() => {
    if (productGroups.length > 0 && !hideCompleted && expandedGroups.size === 0) {
      setExpandedGroups(new Set(productGroups.map(g => g.productId)));
    }
  }, [productGroups.length]); 

  if (productGroups.length === 0) {
    return (
      <div className="bg-white p-12 text-center rounded-xl border border-slate-200 text-slate-400">
        {hideCompleted ? "Aucun article en attente. Bon travail !" : "Aucun article correspondant à votre recherche."}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Table Controls */}
      <div className="flex justify-end mb-2">
        <button 
          onClick={() => setHideCompleted(!hideCompleted)}
          className={`flex items-center space-x-2 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors
            ${hideCompleted ? 'bg-blue-100 text-blue-700' : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'}`}
        >
          {hideCompleted ? <EyeOff size={16} /> : <Eye size={16} />}
          <span>{hideCompleted ? 'Afficher Tout' : 'Masquer Produits Validés'}</span>
        </button>
      </div>

      <div className="space-y-6">
        {productGroups.map(group => {
          const isExpanded = expandedGroups.has(group.productId);
          const isComplete = completedProducts.has(group.productId);
          const allCounted = group.itemsCounted === group.items.length;

          return (
            <div 
              key={group.productId} 
              className={`bg-white border rounded-xl overflow-hidden shadow-sm transition-all duration-200
                ${isComplete ? 'border-emerald-200 shadow-emerald-50' : 'border-slate-200'}`}
            >
              
              <div 
                onClick={() => toggleGroup(group.productId)}
                className={`p-4 flex flex-col md:flex-row items-start md:items-center justify-between cursor-pointer hover:bg-opacity-80 transition-colors border-b
                  ${isComplete ? 'bg-emerald-50/50 border-emerald-100' : 'bg-white border-slate-100'}`}
              >
                <div className="flex items-center space-x-3 mb-4 md:mb-0 w-full md:w-1/3">
                  
                  <button 
                    onClick={(e) => toggleCompletion(e, group.productId)}
                    className={`p-1 rounded-full transition-all flex-shrink-0
                      ${isComplete 
                        ? 'bg-emerald-500 text-white shadow-sm ring-2 ring-emerald-100' 
                        : 'text-slate-300 hover:text-emerald-500 hover:bg-emerald-50'}`}
                    title={isComplete ? "Marquer comme Incomplet" : "Marquer comme Terminé"}
                  >
                    {isComplete ? <Check size={20} strokeWidth={3} /> : <Circle size={24} />}
                  </button>

                  <div className={`p-2 rounded-lg transition-colors ${isComplete ? 'opacity-50' : ''} 
                    ${group.itemsCounted > 0 ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                    {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  </div>
                  
                  <div className={isComplete ? 'opacity-70' : ''}>
                    <div className="flex items-center space-x-2">
                       <h3 className="font-bold text-slate-900 text-lg">{group.name}</h3>
                       {isComplete && (
                         <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase tracking-wide">
                           Terminé
                         </span>
                       )}
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-xs text-slate-400 font-mono">Réf: {group.productId}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide
                        ${group.category === ItemCategory.CONTROLLED ? 'bg-red-100 text-red-700' : 
                          group.category === ItemCategory.ANTIBIOTICS ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                        {group.category}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={`grid grid-cols-3 gap-6 w-full md:w-2/3 transition-opacity ${isComplete ? 'opacity-70' : ''}`}>
                  <div className="flex flex-col items-center md:items-end">
                    <span className="text-xs text-slate-400 uppercase font-semibold mb-1">Total Système</span>
                    <span className="text-lg font-bold text-slate-700">{group.totalTheoretical}</span>
                  </div>

                  <div className="flex flex-col items-center md:items-end">
                    <span className="text-xs text-slate-400 uppercase font-semibold mb-1">Total Réel</span>
                    <div className="flex items-center space-x-2">
                      <span className={`text-lg font-bold ${group.itemsCounted > 0 ? 'text-blue-700' : 'text-slate-300'}`}>
                        {group.totalActual}
                      </span>
                      {!allCounted && (
                         <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
                           {group.itemsCounted}/{group.items.length} Comptés
                         </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-center md:items-end">
                    <span className="text-xs text-slate-400 uppercase font-semibold mb-1">Écart Total</span>
                    <span className={`text-lg font-bold 
                      ${group.totalVariance === 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {group.totalVariance > 0 ? '+' : ''}{group.totalVariance}
                    </span>
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="bg-slate-50/80 p-4 border-t border-slate-100 grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                  {group.items.map(item => {
                    const variance = item.actualQty !== null ? item.actualQty - item.theoreticalQty : 0;
                    const hasDiscrepancy = item.actualQty !== null && variance !== 0;
                    const isExpired = new Date(item.expiryDate) < new Date();

                    return (
                      <div key={item.id} className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 hover:shadow-md transition-shadow relative overflow-hidden group">
                        
                        <div className={`absolute top-0 left-0 bottom-0 w-1 
                          ${item.actualQty === null ? 'bg-slate-300' : 
                            hasDiscrepancy ? 'bg-red-500' : 'bg-emerald-500'}`} 
                        />

                        <div className="pl-3">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center space-x-2">
                               <div className="bg-slate-100 p-1.5 rounded text-slate-500">
                                  <Hash size={14} />
                               </div>
                               <span className="font-mono font-bold text-slate-800 text-sm">{item.batchNumber}</span>
                            </div>
                            <div className="flex items-center space-x-1 text-slate-500 text-xs bg-slate-100 px-2 py-1 rounded">
                               <MapPin size={12} />
                               <span>{item.location}</span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 text-xs mb-4">
                             <Calendar size={12} className={isExpired ? 'text-red-500' : 'text-slate-400'} />
                             <span className={isExpired ? 'text-red-600 font-bold' : 'text-slate-500'}>
                               Exp: {item.expiryDate} {isExpired && '(Périmé)'}
                             </span>
                          </div>

                          <hr className="border-slate-100 mb-4" />

                          <div className="grid grid-cols-3 gap-2 items-center">
                            <div className="text-center">
                               <div className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Système</div>
                               <div className="font-medium text-slate-700 bg-slate-50 py-1.5 rounded border border-slate-100">
                                  {item.theoreticalQty}
                               </div>
                            </div>

                            <div className="text-center relative">
                               <div className="text-[10px] text-blue-500 uppercase font-semibold mb-1">Réel</div>
                               <input
                                  type="number"
                                  min="0"
                                  disabled={readOnly}
                                  placeholder="..."
                                  className={`w-full text-center font-bold text-lg py-1 rounded border outline-none transition-all
                                    ${readOnly ? 'bg-slate-50 text-slate-500 border-slate-200' : 
                                      item.actualQty === null 
                                      ? 'border-blue-300 focus:ring-2 focus:ring-blue-100 bg-white text-slate-800' 
                                      : hasDiscrepancy 
                                        ? 'border-red-300 bg-red-50 text-red-700' 
                                        : 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                    }`}
                                  value={item.actualQty === null ? '' : item.actualQty}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    onUpdateQuantity(item.id, val === '' ? null : parseInt(val, 10));
                                  }}
                               />
                            </div>

                            <div className="text-center">
                               <div className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Écart</div>
                               <div className={`font-bold py-1.5 
                                  ${item.actualQty === null ? 'text-slate-300' : 
                                    variance === 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {item.actualQty !== null ? (variance > 0 ? `+${variance}` : variance) : '-'}
                               </div>
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
        })}
      </div>
    </div>
  );
};
