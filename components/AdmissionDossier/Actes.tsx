
import React from 'react';
import { Plus, List } from 'lucide-react';

export const Actes: React.FC = () => {
  return (
    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm min-h-[400px]">
      <div className="flex justify-between items-center mb-8">
        <h3 className="text-lg font-black uppercase text-slate-800 flex items-center">
          <List className="mr-3 text-indigo-600" /> Liste des Actes
        </h3>
        <button className="bg-emerald-600 text-white px-5 py-2 rounded-xl font-bold flex items-center shadow-lg hover:bg-emerald-700 transition-all">
          <Plus size={18} className="mr-2" /> Ajouter un acte
        </button>
      </div>
      <div className="text-center py-20 text-slate-300">
        <List size={48} className="mx-auto mb-4 opacity-20" />
        <p className="font-bold">Aucun acte médical ou chirurgical saisi pour cette admission.</p>
      </div>
    </div>
  );
};
