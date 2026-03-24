import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  FlaskConical, 
  Search, 
  Calendar,
  CheckCircle2,
  Eye,
  FileText,
  Clock,
  AlertTriangle
} from 'lucide-react';

interface BiologyListProps {
  reports: any[];
  isLoading: boolean;
  onAddClick: () => void;
  onViewReport: (id: string) => void;
  onRefresh: () => void;
}

export const BiologyList: React.FC<BiologyListProps> = ({ 
  reports, 
  isLoading, 
  onAddClick, 
  onViewReport 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      const matchesSearch = r.report_title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            r.source_lab_name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    }).sort((a, b) => new Date(b.report_date).getTime() - new Date(a.report_date).getTime());
  }, [reports, searchTerm, statusFilter]);

  const StatusBadge = ({ status, structuringStatus }: { status: string, structuringStatus: string }) => {
    if (status === 'ENTERED_IN_ERROR') {
      return (
        <span className="flex items-center text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-md">
          <AlertTriangle size={14} className="mr-1.5" />
          Erreur
        </span>
      );
    }
    if (status === 'DRAFT') {
      return (
        <span className="flex items-center text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md">
          <Clock size={14} className="mr-1.5" />
          Brouillon
        </span>
      );
    }
    return (
      <span className="flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md">
        <CheckCircle2 size={14} className="mr-1.5" />
        {structuringStatus === 'STRUCTURED' ? 'Validé & Structuré' : 'Validé'}
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200 pb-5">
        <div>
          <h3 className="text-xl font-bold text-gray-800 flex items-center">
            <FlaskConical className="mr-2 text-indigo-600" size={24} />
            Biologie
          </h3>
          <p className="text-sm text-gray-500 mt-1">Espace de travail clinique de biologie (Résultats et PDFs)</p>
        </div>
        
        <div className="flex w-full md:w-auto gap-3">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Rechercher un bilan..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg text-sm px-3 py-2 bg-white focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="VALIDATED">Validé</option>
            <option value="DRAFT">Brouillon</option>
            <option value="ENTERED_IN_ERROR">Erreur</option>
          </select>
          <button 
            onClick={onAddClick}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg transition-colors shadow-sm font-bold whitespace-nowrap"
          >
            <Plus size={18} />
            <span>Ajouter un bilan</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <FlaskConical className="mx-auto h-12 w-12 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Aucun résultat biologique disponible.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredReports.map(report => (
            <div 
              key={report.id} 
              className="bg-white rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all flex flex-col md:flex-row items-center p-4 gap-4 group cursor-pointer"
              onClick={() => onViewReport(report.id)}
            >
              
              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                <FileText className="text-indigo-600" size={24} />
              </div>

              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="flex items-center space-x-3 mb-1">
                  <h4 className="font-bold text-gray-900 truncate text-lg">{report.report_title || 'Bilan sans titre'}</h4>
                  <StatusBadge status={report.status} structuringStatus={report.structuring_status} />
                </div>
                <div className="flex items-center text-sm text-gray-500 space-x-4">
                  <span className="flex items-center">
                    <Calendar size={14} className="mr-1.5" />
                    {new Date(report.report_date).toLocaleDateString()}
                  </span>
                  <span className="flex items-center text-indigo-600 font-medium px-2 py-0.5 bg-indigo-50 rounded uppercase text-xs">
                    {report.source_lab_name || 'Externe'}
                  </span>
                  <div className="flex space-x-3 text-gray-400 font-medium text-xs ml-auto">
                    <span>{report.document_count || 0} doc(s) attachés</span>
                    <span>•</span>
                    <span>{report.result_count || 0} résultat(s) structurés</span>
                  </div>
                </div>
              </div>

              <div className="shrink-0 pl-4 border-l border-gray-100 hidden md:flex items-center">
                <button className="flex items-center justify-center bg-gray-50 text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 font-bold px-4 py-2 rounded-lg transition-colors border border-gray-200">
                  <Eye size={18} className="mr-2" />
                  Ouvrir
                </button>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
};
