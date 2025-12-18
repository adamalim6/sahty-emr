
import React from 'react';
import { Pill, Plus } from 'lucide-react';

export const Pharmacie: React.FC = () => {
  return (
    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm min-h-[400px]">
      <div className="flex justify-between items-center mb-8">
        <h3 className="text-lg font-black uppercase text-slate-800 flex items-center">
          <Pill className="mr-3 text-rose-600" /> Consommation Pharmacie
        </h3>
        <button className="bg-slate-900 text-white px-5 py-2 rounded-xl font-bold flex items-center shadow-lg">
          <Plus size={18} className="mr-2" /> Sortie Pharmacie
        </button>
      </div>
      <div className="text-center py-20 text-slate-300">
        <Pill size={48} className="mx-auto mb-4 opacity-20" />
        <p className="font-bold">Aucune consommation médicamenteuse enregistrée.</p>
      </div>
    </div>
  );
};
