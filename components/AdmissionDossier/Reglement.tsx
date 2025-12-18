
import React from 'react';
import { Wallet, Plus } from 'lucide-react';

export const Reglement: React.FC = () => {
  return (
    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm min-h-[400px]">
      <div className="flex justify-between items-center mb-8">
        <h3 className="text-lg font-black uppercase text-slate-800 flex items-center">
          <Wallet className="mr-3 text-emerald-600" /> Paiements & Règlements
        </h3>
        <button className="bg-emerald-600 text-white px-5 py-2 rounded-xl font-bold flex items-center">
          <Plus size={18} className="mr-2" /> Encaisser
        </button>
      </div>
      <div className="text-center py-20 text-slate-300">
        <p className="font-bold">Aucun encaissement enregistré.</p>
      </div>
    </div>
  );
};
