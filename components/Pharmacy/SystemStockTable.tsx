
import React, { useMemo, useState } from 'react';
import { InventoryItem, ItemCategory } from '../../types/pharmacy';
import { ChevronDown, ChevronRight, Hash, MapPin, Calendar, Package } from 'lucide-react';

interface SystemStockTableProps {
  items: InventoryItem[];
  filter: string;
}

interface StockGroup {
  productId: string;
  name: string;
  category: ItemCategory;
  items: InventoryItem[];
  totalQty: number;
  totalValue: number;
}

export const SystemStockTable: React.FC<SystemStockTableProps> = ({ items, filter }) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (productId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
    }
    setExpandedGroups(newExpanded);
  };

  const stockGroups = useMemo(() => {
    const groups: Record<string, StockGroup> = {};

    items.forEach(item => {
        const matchesFilter =
            item.name.toLowerCase().includes(filter.toLowerCase()) ||
            item.id.toLowerCase().includes(filter.toLowerCase()) ||
            item.location.toLowerCase().includes(filter.toLowerCase()) ||
            item.batchNumber.toLowerCase().includes(filter.toLowerCase());

        if (!matchesFilter && filter !== '') return;

        if (!groups[item.productId]) {
            groups[item.productId] = {
                productId: item.productId,
                name: item.name,
                category: item.category,
                items: [],
                totalQty: 0,
                totalValue: 0
            };
        }
        
        const group = groups[item.productId];
        group.items.push(item);
        group.totalQty += item.theoreticalQty;
        group.totalValue += (item.theoreticalQty * item.unitPrice);
    });

    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
  }, [items, filter]);

  useMemo(() => {
      if (stockGroups.length > 0 && expandedGroups.size === 0) {
          setExpandedGroups(new Set(stockGroups.map(g => g.productId)));
      }
  }, [stockGroups.length]);

  if (stockGroups.length === 0) {
      return (
        <div className="p-12 text-center text-slate-400 border border-dashed border-slate-300 rounded-xl bg-slate-50">
           Aucun enregistrement système trouvé correspondant à votre recherche.
        </div>
      );
  }

  return (
      <div className="space-y-4">
          {stockGroups.map(group => {
              const isExpanded = expandedGroups.has(group.productId);
              
              return (
                  <div key={group.productId} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                      <div 
                        onClick={() => toggleGroup(group.productId)}
                        className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-100"
                      >
                          <div className="flex items-center space-x-3 w-full md:w-auto mb-4 md:mb-0">
                              <div className={`p-2 rounded-lg transition-colors flex-shrink-0 ${isExpanded ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                                  {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                              </div>
                              <div>
                                  <div className="flex items-center space-x-2">
                                     <h3 className="font-bold text-slate-900 text-lg">{group.name}</h3>
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

                          <div className="flex items-center justify-between w-full md:w-auto md:space-x-12 bg-slate-50 md:bg-transparent p-3 md:p-0 rounded-lg">
                              <div className="flex flex-col items-center md:items-end px-4 md:px-0">
                                  <div className="text-[10px] uppercase text-slate-400 font-semibold mb-1">Stock Total</div>
                                  <div className="text-xl font-bold text-slate-800 flex items-center space-x-1">
                                     <Package size={16} className="text-slate-400" />
                                     <span>{group.totalQty}</span>
                                  </div>
                              </div>
                              <div className="w-px h-8 bg-slate-200 md:hidden"></div>
                              <div className="flex flex-col items-center md:items-end px-4 md:px-0">
                                  <div className="text-[10px] uppercase text-slate-400 font-semibold mb-1">Valeur Totale</div>
                                  <div className="text-xl font-bold text-slate-800">€{group.totalValue.toLocaleString('fr-FR', {minimumFractionDigits: 2})}</div>
                              </div>
                          </div>
                      </div>

                      {isExpanded && (
                          <div className="bg-slate-50/50 p-4 grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                              {group.items.map(item => (
                                  <div key={item.id} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm relative overflow-hidden group">
                                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                      
                                      <div className="flex justify-between items-start mb-3 pl-2">
                                          <div className="flex items-center space-x-2">
                                              <div className="bg-slate-100 p-1.5 rounded text-slate-500"><Hash size={14}/></div>
                                              <span className="font-mono font-bold text-sm text-slate-700">{item.batchNumber}</span>
                                          </div>
                                          <div className="flex items-center space-x-1 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                              <MapPin size={12} />
                                              <span>{item.location}</span>
                                          </div>
                                      </div>
                                      
                                      <div className="pl-2 mb-4">
                                         <div className="flex items-center space-x-2 text-xs">
                                             <Calendar size={12} className="text-slate-400"/>
                                             <span className="text-slate-500">Exp: {item.expiryDate}</span>
                                         </div>
                                      </div>

                                      <div className="border-t border-slate-50 pt-3 pl-2 flex justify-between items-end">
                                          <div>
                                              <div className="text-[10px] text-slate-400 uppercase font-semibold">Quantité</div>
                                              <div className="font-mono font-bold text-lg text-slate-800">{item.theoreticalQty}</div>
                                          </div>
                                          <div className="text-right">
                                              <div className="text-[10px] text-slate-400 uppercase font-semibold">Valeur</div>
                                              <div className="font-medium text-sm text-slate-600">
                                                  €{(item.theoreticalQty * item.unitPrice).toFixed(2)}
                                              </div>
                                          </div>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              )
          })}
      </div>
  );
};
