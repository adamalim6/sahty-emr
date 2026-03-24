import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import { Calendar, CheckCircle2, FlaskConical, AlertTriangle, FileText, Download, Clock } from 'lucide-react';

interface LabReportViewDrawerProps {
  reportId: string;
  patientId: string;
  onClose: () => void;
  onRefresh: () => void;
}

export const LabReportViewDrawer: React.FC<LabReportViewDrawerProps> = ({ reportId, onClose }) => {
  const [report, setReport] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'RESULTS' | 'DOCUMENTS'>('RESULTS');

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        setIsLoading(true);
        const data = await api.getPatientLabReportDetails(reportId);
        setReport(data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDetails();
  }, [reportId]);

  const handleDownload = async (docId: string, title: string) => {
    try {
      const { url } = await api.getPatientDocumentUrl(docId);
       // Create a temporary link to download the file
       const link = document.createElement('a');
       link.href = url;
       link.target = '_blank';
       link.download = title || 'document';
       document.body.appendChild(link);
       link.click();
       document.body.removeChild(link);
    } catch (e) {
      console.error(e);
      alert("Erreur lors du téléchargement.");
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-y-0 right-0 z-[100] w-full max-w-5xl bg-white shadow-2xl flex flex-col border-l border-gray-200 animate-in slide-in-from-right-full">
        <div className="flex-1 flex justify-center items-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="fixed inset-y-0 right-0 z-[100] w-full max-w-5xl bg-white shadow-2xl flex flex-col border-l border-gray-200 animate-in slide-in-from-right-full p-8 text-center text-red-500">
        Erreur: Bilan introuvable.
        <button onClick={onClose} className="mt-4 px-4 py-2 border rounded-lg text-gray-700">Fermer</button>
      </div>
    );
  }

  return (
    <div className="fixed inset-y-0 right-0 z-[100] w-full max-w-5xl bg-white shadow-2xl flex flex-col border-l border-gray-200 animate-in slide-in-from-right-full">
      {/* HEADER */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center shrink-0">
         <div className="flex items-center space-x-4">
           <div className="p-3 bg-indigo-100 text-indigo-700 rounded-lg">
             <FlaskConical size={24} />
           </div>
           <div>
             <h2 className="text-xl font-bold text-gray-900">{report.report_title}</h2>
             <div className="flex items-center space-x-3 text-sm text-gray-500 mt-1">
               <span className="flex items-center"><Calendar size={14} className="mr-1" /> {new Date(report.report_date).toLocaleDateString()}</span>
               <span>•</span>
               <span className="font-medium">{report.source_lab_name || 'Labo Interne'}</span>
               {report.source_lab_report_number && (
                 <>
                   <span>•</span>
                   <span>Réf: {report.source_lab_report_number}</span>
                 </>
               )}
             </div>
           </div>
         </div>
         <div className="flex items-center space-x-3">
           {report.status === 'VALIDATED' ? (
             <div className="flex items-center text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg text-sm font-bold">
               <CheckCircle2 size={16} className="mr-1.5" /> Validé
             </div>
           ) : report.status === 'DRAFT' ? (
             <div className="flex items-center text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg text-sm font-bold">
               <Clock size={16} className="mr-1.5" /> Brouillon
             </div>
           ) : (
             <div className="flex items-center text-red-600 bg-red-50 px-3 py-1.5 rounded-lg text-sm font-bold">
               <AlertTriangle size={16} className="mr-1.5" /> Erreur
             </div>
           )}
           <button onClick={onClose} className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-gray-600 font-bold hover:bg-gray-50 transition-colors shadow-sm">
             Fermer
           </button>
         </div>
      </div>

      {/* TABS */}
      <div className="px-6 border-b border-gray-200 bg-white flex space-x-6">
        <button 
          onClick={() => setActiveTab('RESULTS')}
          className={`py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'RESULTS' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 relative'}`}
        >
          Résultats Structurés
          {report.structuring_status === 'STRUCTURED' && <CheckCircle2 size={14} className="inline ml-1.5 text-emerald-500" />}
        </button>
        <button 
          onClick={() => setActiveTab('DOCUMENTS')}
          className={`py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'DOCUMENTS' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 flex items-center'}`}
        >
          Documents ({report.documents?.length || 0})
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
        
        {/* TAB: RESULTS */}
        {activeTab === 'RESULTS' && (
          <div className="space-y-6 max-w-4xl mx-auto">
            {report.tests?.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
                <FlaskConical className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                <p className="text-gray-500 font-medium">Ce bilan ne contient aucun résultat structuré.</p>
              </div>
            ) : (
              report.tests?.map((test: any) => (
                <div key={test.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 bg-indigo-50/50 border-b border-gray-200">
                     <h4 className="font-bold text-indigo-900 text-sm flex items-center">
                       {test.global_act_name || test.custom_test_name || 'Test'}
                     </h4>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-gray-50/50 text-gray-500 text-xs font-bold border-b border-gray-200">
                          <th className="px-4 py-3 font-medium">Analyte</th>
                          <th className="px-4 py-3 font-medium w-32">Valeur</th>
                          <th className="px-4 py-3 font-medium w-24">Unité</th>
                          <th className="px-4 py-3 font-medium">Normes / Ref.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {test.results?.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-4 text-center text-gray-400 text-xs italic">
                              Aucun détail
                            </td>
                          </tr>
                        ) : (
                          test.results?.map((res: any) => (
                            <tr key={res.id} className="border-b border-gray-100 hover:bg-gray-50/30">
                              <td className="px-4 py-3 font-medium text-gray-800">
                                {res.raw_analyte_label || res.analyte_name || 'Inconnu'}
                              </td>
                              <td className="px-4 py-3 font-bold text-indigo-700">
                                {res.numeric_value !== null ? res.numeric_value : res.text_value || '-'}
                              </td>
                              <td className="px-4 py-3 text-gray-500">
                                {res.raw_unit_label || res.unit_name || ''}
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-500">
                                {/* TODO: Display reference ranges if available */}
                                <span className="text-gray-400">Non définie</span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}

            {report.notes && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-6">
                <h4 className="font-bold text-amber-800 text-sm mb-2">Notes & Renseignements cliniques</h4>
                <p className="text-sm text-amber-900 whitespace-pre-wrap">{report.notes}</p>
              </div>
            )}
            
            {report.report_conclusions && (
              <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-4 mt-6">
                <h4 className="font-bold text-gray-900 text-sm mb-2">Conclusion Médicale</h4>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{report.report_conclusions}</p>
              </div>
            )}
          </div>
        )}

        {/* TAB: DOCUMENTS */}
        {activeTab === 'DOCUMENTS' && (
          <div className="space-y-4 max-w-4xl mx-auto">
             {report.documents?.length === 0 ? (
               <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
                 <FileText className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                 <p className="text-gray-500 font-medium">Aucun document attaché à ce bilan.</p>
               </div>
             ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {report.documents?.map((doc: any) => (
                   <div key={doc.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:border-indigo-300 transition-colors group flex items-start">
                     <div className="p-3 bg-red-50 text-red-500 rounded-lg shrink-0 mr-4">
                       <FileText size={24} />
                     </div>
                     <div className="flex-1 min-w-0">
                       <h4 className="font-bold text-gray-900 truncate" title={doc.document_title || doc.document_file_name}>{doc.document_title || doc.document_file_name}</h4>
                       <p className="text-xs text-gray-500 mt-1 uppercase">{doc.file_type || 'PDF'}</p>
                       <button 
                         onClick={() => handleDownload(doc.id, doc.document_title || doc.document_file_name)}
                         className="mt-3 flex items-center text-xs font-bold text-indigo-600 hover:text-indigo-800"
                       >
                         <Download size={14} className="mr-1" /> Télécharger
                       </button>
                     </div>
                   </div>
                 ))}
               </div>
             )}
          </div>
        )}
      </div>
    </div>
  );
};
