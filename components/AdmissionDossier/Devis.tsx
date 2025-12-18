
import React from 'react';
import { FileSignature, Plus } from 'lucide-react';

export const Devis: React.FC = () => {
  return (
    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm min-h-[400px]">
      <div className="flex justify-between items-center mb-8">
        <h3 className="text-lg font-black uppercase text-slate-800 flex items-center">
          <FileSignature className="mr-3 text-amber-600" /> Estimations & Devis
        </h3>
        <button className="bg-indigo-600 text-white px-5 py-2 rounded-xl font-bold flex items-center">
          <Plus size={18} className="mr-2" /> Nouveau Devis
        </button>
      </div>
      <div className="text-center py-20 text-slate-300">
        <p className="font-bold italic">Aucun devis provisionnel créé.</p>
      </div>
    </div>
  );
};
