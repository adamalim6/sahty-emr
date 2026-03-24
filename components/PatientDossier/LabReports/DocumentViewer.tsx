import React, { useState, useEffect } from 'react';
import { pdfjs, Document, Page } from 'react-pdf';
import { ChevronLeft, ChevronRight, FileImage, FileText, Plus, ChevronDown, ChevronRight as ChevronRightIcon, GripVertical, AlertTriangle } from 'lucide-react';
import { api, API_BASE_URL } from '../../../services/api';

// Force strict API-to-Worker version parity by pointing directly to the Unpkg version mapping
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface DocumentViewerProps {
  reportId: string;
  patientId: string;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({ reportId, patientId }) => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [isPdf, setIsPdf] = useState(true);

  const [isMerging, setIsMerging] = useState(false);
  const [sourcesCollapsed, setSourcesCollapsed] = useState(false);

  useEffect(() => {
    fetchDocuments(true);
  }, [reportId]);

  const fetchDocuments = async (isInitial = false) => {
    try {
      const report = await api.getPatientLabReportDetails(reportId);
      if (report.documents && report.documents.length > 0) {
        setDocuments(report.documents);
        
        if (isInitial) {
          const mDoc = report.documents.find((d: any) => d.derivation_type === 'MERGED' && d.actif);
          const sDocs = report.documents.filter((d: any) => d.derivation_type === 'ORIGINAL' && d.actif)
              .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
              
          if (mDoc) {
             handleSelectDocument(mDoc);
             setSourcesCollapsed(true);
          } else if (sDocs.length > 0) {
             handleSelectDocument(sDocs[0]);
             setSourcesCollapsed(false);
          }
        }
      } else {
        setDocuments([]);
      }
    } catch (e) {
      console.error('Failed to fetch documents', e);
    }
  };

  const handleSelectDocument = (doc: any) => {
    setSelectedDocId(doc.id);
    const isImage = doc.mime_type && doc.mime_type.startsWith('image/');
    setIsPdf(!isImage);
    setPageNumber(1);
  };

  useEffect(() => {
    if (!selectedDocId) return;

    let isMounted = true;
    setDocUrl(null);

    fetch(`${API_BASE_URL}/documents/${selectedDocId}/stream`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    .then(async res => {
      if (!res.ok) return;
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      if (isMounted) setDocUrl(objectUrl);
    })
    .catch(err => console.error("Error fetching proxy stream:", err));

    return () => { isMounted = false; };
  }, [selectedDocId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);

    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("patientId", patientId);
      formData.append("documentType", "LAB_REPORT");

      const res = await fetch(`${API_BASE_URL}/documents/upload`, {
        method: "POST",
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData,
      });
      const doc = await res.json();

      await fetch(`${API_BASE_URL}/patient-lab-reports/${reportId}/documents`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ document_id: doc.id }),
      });
    }
    // Stay on current doc, but fetch docs list
    fetchDocuments(false);
  };

  const handleMerge = async () => {
    setIsMerging(true);
    try {
      const res = await fetch(`${API_BASE_URL}/patient-lab-reports/${reportId}/merge`, {
        method: "POST",
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (res.ok && data.mergedDocId) {
        setSourcesCollapsed(true);
        // After merge, re-fetch and select the newly merged doc
        await fetchDocuments(true);
      } else {
        alert(data.message || "Erreur lors de la fusion");
      }
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la fusion");
    } finally {
      setIsMerging(false);
    }
  };

  // Drag and Drop Logic
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('dragIndex', index.toString());
  };
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData('dragIndex'), 10);
    if (dragIndex === dropIndex) return;

    const newSourceDocs = [...sourceDocs];
    const [draggedItem] = newSourceDocs.splice(dragIndex, 1);
    newSourceDocs.splice(dropIndex, 0, draggedItem);

    // Optimistically update
    const newDocsArray = [...documents.filter(d => !(d.derivation_type === 'ORIGINAL' && d.actif)), ...newSourceDocs];
    setDocuments(newDocsArray);

    try {
      await fetch(`${API_BASE_URL}/patient-lab-reports/${reportId}/documents/reorder`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ documentIds: newSourceDocs.map(d => d.id) }),
      });
    } catch (e) {
      console.error(e);
      fetchDocuments(false); // revert on failure
    }
  };

  // Computations
  const mergedDoc = documents.find(d => d.derivation_type === 'MERGED' && d.actif);
  const sourceDocs = documents.filter(d => d.derivation_type === 'ORIGINAL' && d.actif)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    
  // Check for newly uploaded docs AFTER the merge snapshot
  const hasNewDocsAfterMerge = mergedDoc && sourceDocs.some(doc => new Date(doc.created_at).getTime() > new Date(mergedDoc.created_at).getTime());

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) { setNumPages(numPages); }

  return (
    <div className="flex h-full bg-gray-50">
      
      {/* SIDEBAR: Document List */}
      <div className="w-72 bg-white border-r border-gray-200 flex flex-col shrink-0 relative">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 className="font-bold text-gray-800 text-sm">Gestion des fichiers</h3>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/*"
            multiple
            style={{ display: "none" }}
            onChange={handleFileUpload}
          />
          <button 
            className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 p-1.5 rounded transition-colors" 
            title="Ajouter un document"
            onClick={() => fileInputRef.current?.click()}
          >
            <Plus size={18} />
          </button>
        </div>
        
        {/* MERGE ALERT */}
        {hasNewDocsAfterMerge && (
          <div className="bg-amber-50 border-b border-amber-200 p-3">
            <p className="text-xs font-bold text-amber-800 flex items-start gap-1">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              Nouveau document ajouté — fusion recommandée
            </p>
          </div>
        )}
        
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          
          {/* RAPPORT ACTIF (MERGED) */}
          {mergedDoc && (
            <div>
              <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2 px-1">📄 Rapport actif</h4>
              <div 
                onClick={() => handleSelectDocument(mergedDoc)}
                className={`p-3 rounded-xl flex items-center cursor-pointer transition-all border ${selectedDocId === mergedDoc.id ? 'bg-indigo-50 border-indigo-300 shadow-sm' : 'hover:bg-gray-50 border-gray-200 bg-white'}`}
              >
                <div className={`p-2 rounded-lg shrink-0 mr-3 ${selectedDocId === mergedDoc.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  <FileText size={18} />
                </div>
                <div className="overflow-hidden">
                  <p className={`text-sm font-bold truncate ${selectedDocId === mergedDoc.id ? 'text-indigo-900' : 'text-gray-800'}`}>Rapport consolidé</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Fusion de {sourceDocs.length} sources</p>
                </div>
              </div>
            </div>
          )}

          {/* DOCUMENTS SOURCES */}
          {sourceDocs.length > 0 && (
            <div>
              <div 
                className="flex items-center justify-between px-1 mb-2 cursor-pointer group"
                onClick={() => setSourcesCollapsed(!sourcesCollapsed)}
              >
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider flex items-center gap-1 group-hover:text-gray-600 transition-colors">
                  📎 Documents sources ({sourceDocs.length})
                </h4>
                {sourcesCollapsed ? <ChevronRightIcon size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
              </div>

              {!sourcesCollapsed && (
                <div className="space-y-1.5 min-h-[50px]">
                  {sourceDocs.map((doc, index) => {
                    const isSelected = selectedDocId === doc.id;
                    const isImage = doc.mime_type?.startsWith('image/');
                    return (
                      <div 
                        key={doc.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, index)}
                        onClick={() => handleSelectDocument(doc)}
                        className={`p-2 rounded-lg flex items-center cursor-pointer transition-colors border group ${isSelected ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50 border-transparent'}`}
                      >
                        <div className="text-gray-300 opacity-0 group-hover:opacity-100 hover:text-gray-500 cursor-grab active:cursor-grabbing mr-1 transition-opacity">
                          <GripVertical size={14} />
                        </div>
                        <div className={`p-1.5 rounded shrink-0 mr-2 ${isSelected ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                          {isImage ? <FileImage size={16} /> : <FileText size={16} />}
                        </div>
                        <div className="overflow-hidden flex-1">
                          <p className={`text-xs font-semibold truncate ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>{doc.original_filename}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {documents.length === 0 && (
             <p className="text-center text-xs text-gray-400 mt-10">Aucun document attaché.</p>
          )}
        </div>

        {/* MERGE BUTTON BOTTOM PANEL */}
        {sourceDocs.length > 1 && (
          <div className="p-3 border-t border-gray-100 bg-white">
            <button 
              onClick={handleMerge}
              disabled={isMerging}
              className="w-full py-2.5 px-4 bg-gray-900 hover:bg-black text-white font-bold text-sm rounded-lg shadow disabled:opacity-50 transition-colors flex justify-center items-center"
            >
              {isMerging ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Fusion en cours...
                </span>
              ) : (
                hasNewDocsAfterMerge ? 'Intégrer et re-fusionner' : 'Fusionner les documents'
              )}
            </button>
          </div>
        )}
      </div>

      {/* VIEWER AREA */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-gray-100/50">
        {docUrl ? (
          <div className="flex-1 overflow-y-auto w-full h-full p-4 md:p-8 flex justify-center items-start">
             <div className="bg-white shadow-xl max-w-[850px] inline-block border border-gray-200 mx-auto w-full group">
               {isPdf ? (
                 <Document
                    file={docUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    loading={<div className="p-20 text-indigo-500 animate-pulse font-bold text-center">Chargement du PDF...</div>}
                    error={<div className="p-20 text-red-500 font-bold text-center">Impossible de charger le document</div>}
                    className="flex justify-center flex-col items-center"
                 >
                    <Page 
                      pageNumber={pageNumber} 
                      className="max-w-full" 
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      width={800}
                    />
                 </Document>
               ) : (
                 <div className="p-4 flex justify-center">
                   <img src={docUrl} alt="Document" className="max-w-full object-contain max-h-[1000px]" />
                 </div>
               )}
             </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
             Sélectionnez un document pour l'afficher
          </div>
        )}

        {/* PDF Navigation Overlay */}
        {docUrl && isPdf && numPages && numPages > 1 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-gray-900/90 backdrop-blur text-white px-4 py-2 rounded-full shadow-2xl flex items-center space-x-4 border border-white/10">
            <button 
              onClick={() => setPageNumber(prev => Math.max(prev - 1, 1))}
              disabled={pageNumber <= 1}
              className="p-1.5 hover:bg-white/20 rounded-full disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="text-sm font-bold min-w-[80px] text-center tracking-wider">
              {pageNumber} / {numPages}
            </span>
            <button 
              onClick={() => setPageNumber(prev => Math.min(prev + 1, numPages))}
              disabled={pageNumber >= numPages}
              className="p-1.5 hover:bg-white/20 rounded-full disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
