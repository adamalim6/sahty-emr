
import React from 'react';
import { TrendingUp, Users, CreditCard, Activity } from 'lucide-react';

export const Dashboard: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in duration-500">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-4 mb-4">
           <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><TrendingUp size={20}/></div>
           <h4 className="text-xs font-black uppercase text-slate-400">Total Prestations</h4>
        </div>
        <div className="text-2xl font-black text-slate-900">12 450,00 MAD</div>
      </div>
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-4 mb-4">
           <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><Activity size={20}/></div>
           <h4 className="text-xs font-black uppercase text-slate-400">Nombre d'actes</h4>
        </div>
        <div className="text-2xl font-black text-slate-900">14</div>
      </div>
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-4 mb-4">
           <div className="p-3 bg-rose-50 text-rose-600 rounded-xl"><CreditCard size={20}/></div>
           <h4 className="text-xs font-black uppercase text-slate-400">Reste à régler</h4>
        </div>
        <div className="text-2xl font-black text-rose-600">3 200,00 MAD</div>
      </div>
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-4 mb-4">
           <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Users size={20}/></div>
           <h4 className="text-xs font-black uppercase text-slate-400">Part Patient</h4>
        </div>
        <div className="text-2xl font-black text-slate-900">15 %</div>
      </div>
      <div className="md:col-span-4 bg-white p-10 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400 italic">
        Détails graphiques et statistiques de l'admission en cours de chargement...
      </div>
    </div>
  );
};
