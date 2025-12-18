
import React from 'react';
import { InventorySession, InventoryStatus } from '../../types/pharmacy';
import { Plus, Calendar, FileText, CheckCircle2, Clock, ChevronRight } from 'lucide-react';

interface InventorySessionListProps {
  sessions: InventorySession[];
  onCreateNew: () => void;
  onViewSession: (session: InventorySession) => void;
}

export const InventorySessionList: React.FC<InventorySessionListProps> = ({ sessions, onCreateNew, onViewSession }) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Sessions d'Inventaire</h2>
          <p className="text-slate-500 text-sm">Gérez vos inventaires et consultez l'historique.</p>
        </div>
        <button
          onClick={onCreateNew}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium shadow-sm transition-all"
        >
          <Plus size={18} />
          <span>Créer Nouvel Inventaire</span>
        </button>
      </div>

      <div className="bg-white shadow-sm border border-slate-200 rounded-xl overflow-hidden">
        {sessions.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="bg-slate-100 p-4 rounded-full mb-4">
              <FileText size={32} className="text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900">Aucune session d'inventaire</h3>
            <p className="text-slate-500 max-w-sm mt-2 mb-6">
              Vous n'avez pas encore commencé d'inventaire. Cliquez sur le bouton ci-dessus pour démarrer.
            </p>
            <button
              onClick={onCreateNew}
              className="text-blue-600 font-medium hover:text-blue-800"
            >
              Démarrer une session
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500">
                <tr>
                  <th className="px-6 py-4">Référence</th>
                  <th className="px-6 py-4">Date de Création</th>
                  <th className="px-6 py-4">Statut</th>
                  <th className="px-6 py-4">Créé Par</th>
                  <th className="px-6 py-4 text-center">Articles Traités</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => onViewSession(session)}>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{session.id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <Calendar size={14} className="text-slate-400" />
                        <span>{new Date(session.date).toLocaleDateString()}</span>
                        <span className="text-xs text-slate-400">{new Date(session.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border
                        ${session.status === InventoryStatus.COMPLETED 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                        {session.status === InventoryStatus.COMPLETED ? (
                          <CheckCircle2 size={12} className="mr-1" />
                        ) : (
                          <Clock size={12} className="mr-1" />
                        )}
                        {session.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {session.createdBy}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {session.stats?.itemsCounted || 0} / {session.itemsSnapshot.length}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewSession(session);
                        }}
                        className="text-blue-600 hover:text-blue-800 font-medium inline-flex items-center"
                      >
                        {session.status === InventoryStatus.DRAFT ? 'Continuer' : 'Voir Rapport'}
                        <ChevronRight size={16} className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
