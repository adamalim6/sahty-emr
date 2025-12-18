
import React from 'react';
import { FileText, Printer } from 'lucide-react';

export const Factures: React.FC = () => {
  return (
    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm min-h-[400px]">
      <div className="flex justify-between items-center mb-8">
        <h3 className="text-lg font-black uppercase text-slate-800 flex items-center">
          <FileText className="mr-3 text-blue-600" /> Facturation
        </h3>
      </div>
      <div className="text-center py-20 text-slate-300">
        <FileText size={48} className="mx-auto mb-4 opacity-20" />
        <p className="font-bold">Aucune facture générée pour le moment.</p>
      </div>
    </div>
  );
};
