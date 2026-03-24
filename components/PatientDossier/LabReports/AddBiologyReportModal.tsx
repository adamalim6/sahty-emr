import React, { useState, useRef } from 'react';
import { Upload, X, FileText, CheckCircle2 } from 'lucide-react';
import { api } from '../../../services/api';

interface AddBiologyReportModalProps {
  patientId: string;
  onClose: () => void;
  onSuccess: (reportId: string) => void;
}

export const AddBiologyReportModal: React.FC<AddBiologyReportModalProps> = ({ patientId, onClose, onSuccess }) => {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileUpload = async (e: any) => {
    // Determine files from standard input change or drag-and-drop
    const files = e.dataTransfer ? e.dataTransfer.files : e.target.files;
    console.log("FILES RECEIVED:", files);
    if (!files || files.length === 0) return;
    console.log("MIME:", files[0].type);
    
    setIsUploading(true);
    try {
      // 1. Upload ALL files -> /api/documents/upload
      const uploadedDocIds: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('patientId', patientId);
        formData.append('documentType', 'LAB_REPORT');
        formData.append('documentTitle', file.name);

        const res = await api.uploadPatientDocument(formData);
        if (res && res.id) {
          uploadedDocIds.push(res.id);
        }
      }

      // 2. Create patient_lab_report & Link documents
      const payload = {
        tenant_patient_id: patientId,
        report_title: 'Nouveau Bilan Biologique',
        source_type: 'EXTERNAL_REPORT',
        status: 'DRAFT',
        structuring_status: 'DOCUMENT_ONLY',
        report_date: new Date().toISOString().split('T')[0],
        documentIds: uploadedDocIds
      };
      
      const report = await api.createPatientLabReport(payload);
      
      // 3. Close modal & Open workspace
      onSuccess(report.id);
    } catch (err) {
      console.error('Failed to create report and upload files', err);
      alert("Une erreur est survenue lors de l'importation.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95 transition-all outline-none">
        
        <div className="flex justify-between items-center bg-white mb-6">
          <h2 className="text-xl font-bold text-gray-800">Ajouter un bilan biologique</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" disabled={isUploading}>
            <X size={24} />
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-6 font-medium">
          Importez un document (PDF ou image) pour créer l'espace de travail d'interprétation du nouveau bilan biologique.
        </p>

        <div 
          onClick={() => !isUploading && fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!isUploading) handleFileUpload(e);
          }}
          className={`border-2 border-dashed ${isUploading ? 'border-gray-200 bg-gray-50' : 'border-indigo-300 bg-indigo-50/30 hover:bg-indigo-50 cursor-pointer'} rounded-xl p-10 text-center transition-all group`}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            multiple
            accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
            onChange={handleFileUpload}
            disabled={isUploading}
          />
          <div className="flex flex-col items-center">
            {isUploading ? (
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
            ) : (
              <div className="p-4 bg-white shadow-sm rounded-full text-indigo-500 mb-4 group-hover:scale-110 transition-transform">
                <Upload size={32} />
              </div>
            )}
            <p className="text-sm font-bold text-gray-700">
              {isUploading ? 'Création de l\'espace de travail...' : 'Cliquez ou glissez les résultats ici'}
            </p>
            <p className="text-xs text-gray-500 mt-1">PDF, PNG, JPG ou WEBP (max 20 MB)</p>
          </div>
        </div>
      </div>
    </div>
  );
};
