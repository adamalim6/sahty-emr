
import React from 'react';
import { ArrowLeftRight } from 'lucide-react';

export const Remboursement: React.FC = () => {
  return (
    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm min-h-[400px]">
      <h3 className="text-lg font-black uppercase text-slate-800 flex items-center mb-8">
        <ArrowLeftRight className="mr-3 text-slate-600" /> Remboursements & Avoirs
      </h3>
      <div className="text-center py-20 text-slate-300">
        <p className="font-bold">Aucun mouvement de remboursement enregistré.</p>
      </div>
    </div>
  );
};
