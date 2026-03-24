import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Edit3, CheckCircle2, FlaskConical, Calendar, Target } from 'lucide-react';
import { api, API_BASE_URL } from '../../../services/api';
import { StructuredResultsGrid } from './StructuredResultsGrid';
import { DocumentViewer } from './DocumentViewer';
import { ErgonomicDatePicker } from '../../ui/ErgonomicDatePicker';

interface BiologyWorkspaceProps {
  reportId: string;
  patientId: string;
  onClose: () => void;
}

export const BiologyWorkspace: React.FC<BiologyWorkspaceProps> = ({ reportId, patientId, onClose }) => {
  const [report, setReport] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'DOCUMENTS' | 'STRUCTURED'>('DOCUMENTS');
  const saveTimeoutRef = useRef<any>(null);
  const [editHeaderData, setEditHeaderData] = useState({ 
    report_title: '', 
    source_lab_name: '', 
    report_date: '',
    source_lab_report_number: '',
    collected_at: ''
  });

  useEffect(() => {
    fetchReportDetails();
  }, [reportId]);

  const fetchReportDetails = async () => {
    try {
      const data = await api.getPatientLabReportDetails(reportId);
      setReport(data);
      setEditHeaderData({
        report_title: data.report_title || '',
        source_lab_name: data.source_lab_name || '',
        report_date: data.report_date ? new Date(data.report_date).toISOString().split('T')[0] : '',
        source_lab_report_number: data.source_lab_report_number || '',
        collected_at: data.collected_at ? new Date(data.collected_at).toISOString().slice(0, 16) : ''
      });
    } catch (e) {
      console.error('Failed to fetch report details', e);
    }
  };

  const handleHeaderChange = (field: string, value: string) => {
    const updatedData = { ...editHeaderData, [field]: value };
    setEditHeaderData(updatedData);

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch(`${API_BASE_URL}/patient-lab-reports/${reportId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify(updatedData)
        });
      } catch(e) {
        console.error('Header autosave failed', e);
      }
    }, 500);
  };

  const handleValidateReport = async () => {
    if (!window.confirm("Êtes-vous sûr de vouloir valider ce bilan ? Il ne sera plus modifiable directement.")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/patient-lab-reports/${reportId}/validate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        fetchReportDetails(); // Refresh report status in parent
      }
    } catch(e) {
      console.error(e);
    }
  };

  if (!report) {
    return (
      <div className="flex justify-center items-center h-64 bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="animate-spin h-8 w-8 border-b-2 border-indigo-600 rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[80vh] bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      
      {/* GLOBAL HEADER */}
      <div className="bg-indigo-900 text-white px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center shrink-0">
        <div className="flex items-center space-x-4 mb-4 md:mb-0 w-full md:w-auto">
          <button onClick={onClose} className="p-2 hover:bg-indigo-800 rounded-lg transition-colors">
            <ArrowLeft size={20} />
          </button>
          
          {report.status === 'DRAFT' ? (
            <div className="flex flex-wrap items-center gap-3 w-full py-1 shrink-0 pr-4">
              
              <div className="flex flex-col flex-1 min-w-[160px]">
                <label className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider mb-1 ml-1">Titre du Bilan</label>
                <input 
                  className="bg-indigo-950/60 border border-indigo-700/50 rounded-lg px-2.5 py-1.5 text-xs text-white font-semibold outline-none focus:border-indigo-400 transition-all placeholder:text-indigo-400/40 w-full"
                  value={editHeaderData.report_title}
                  onChange={e => handleHeaderChange('report_title', e.target.value)}
                  placeholder="Ex: NFS..."
                />
              </div>

              <div className="flex flex-col w-[120px] shrink-0">
                <label className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider mb-1 ml-1">Date</label>
                <ErgonomicDatePicker 
                  value={editHeaderData.report_date} 
                  onChange={v => handleHeaderChange('report_date', v)} 
                  placeholder="Date"
                  className="w-full"
                  triggerClassName="bg-indigo-950/60 border border-indigo-700/50 rounded-lg px-2.5 py-1.5 text-xs text-white cursor-pointer hover:border-indigo-400 transition-all flex items-center w-full"
                />
              </div>

              <div className="flex flex-col flex-1 min-w-[130px]">
                <label className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider mb-1 ml-1">Laboratoire</label>
                <input 
                  className="bg-indigo-950/60 border border-indigo-700/50 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-400 transition-all placeholder:text-indigo-400/40 w-full" 
                  value={editHeaderData.source_lab_name}
                  onChange={e => handleHeaderChange('source_lab_name', e.target.value)}
                  placeholder="Source..."
                />
              </div>

              <div className="flex flex-col w-[130px] shrink-0">
                <label className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider mb-1 ml-1">N° Dossier</label>
                <input 
                  className="bg-indigo-950/60 border border-indigo-700/50 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-400 transition-all placeholder:text-indigo-400/40 w-full" 
                  value={editHeaderData.source_lab_report_number}
                  onChange={e => handleHeaderChange('source_lab_report_number', e.target.value)}
                  placeholder="Référence..."
                />
              </div>

              <div className="flex flex-col w-[150px] shrink-0">
                <label className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider mb-1 ml-1">Prélèvement</label>
                <ErgonomicDatePicker 
                  includeTime
                  value={editHeaderData.collected_at} 
                  onChange={v => handleHeaderChange('collected_at', v)} 
                  placeholder="Heure"
                  className="w-full"
                  triggerClassName="bg-indigo-950/60 border border-indigo-700/50 rounded-lg px-2.5 py-1.5 text-[11px] text-white cursor-pointer hover:border-indigo-400 transition-all flex items-center w-full"
                />
              </div>

            </div>
          ) : (
            <div className="flex flex-col">
              <div className="flex items-center space-x-3">
                <h2 className="text-xl font-black tracking-tight">{report.report_title || 'Bilan sans titre'}</h2>
                <div className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {report.status}
                </div>
              </div>
              <div className="flex items-center text-indigo-200 text-xs font-semibold mt-2 space-x-4 flex-wrap gap-y-2">
                {report.report_date && <span className="flex items-center bg-indigo-950/40 px-2 py-1 rounded"><Calendar size={12} className="mr-1.5 text-indigo-400" /> {new Date(report.report_date).toLocaleDateString()}</span>}
                {report.collected_at && <span className="flex items-center bg-indigo-950/40 px-2 py-1 rounded"><Target size={12} className="mr-1.5 text-indigo-400" /> Prélevé: {new Date(report.collected_at).toLocaleString()}</span>}
                {report.source_lab_name && <span className="flex items-center bg-indigo-950/40 px-2 py-1 rounded"><FlaskConical size={12} className="mr-1.5 text-indigo-400" /> {report.source_lab_name}</span>}
                {report.source_lab_report_number && <span className="flex items-center font-mono bg-indigo-950/40 px-2 py-1 rounded">N° {report.source_lab_report_number}</span>}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-3">
          {report.status === 'DRAFT' && (
             <button onClick={handleValidateReport} className="ml-4 flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-all">
                <CheckCircle2 size={16} />
                <span>Valider le bilan</span>
             </button>
          )}
        </div>
      </div>

      {/* TABS HEADER */}
      <div className="flex border-b border-gray-200 bg-gray-50/80 px-4 pt-2 shrink-0">
        <button
          onClick={() => setActiveTab('DOCUMENTS')}
          className={`px-6 py-3 font-bold text-sm border-b-2 transition-colors ${activeTab === 'DOCUMENTS' ? 'border-indigo-600 text-indigo-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'} rounded-t-lg flex items-center`}
        >
          Documents ({report.documents?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('STRUCTURED')}
          className={`px-6 py-3 font-bold text-sm border-b-2 transition-colors ${activeTab === 'STRUCTURED' ? 'border-emerald-600 text-emerald-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'} rounded-t-lg flex items-center ml-2`}
        >
          <Target size={16} className="mr-2" />
          Résultats Structurés
        </button>
      </div>

      {/* WORKSPACE CONTENT AREA */}
      <div className="flex-1 overflow-hidden bg-gray-100 relative flex flex-col">
        {activeTab === 'DOCUMENTS' ? (
           <DocumentViewer reportId={reportId} patientId={patientId} />
        ) : (
           <StructuredResultsGrid key={report.status} reportId={reportId} patientId={patientId} />
        )}
      </div>

    </div>
  );
};
