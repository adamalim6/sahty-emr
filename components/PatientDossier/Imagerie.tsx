import React, { useState, useRef } from 'react';
import { 
  Plus, 
  ScanLine, 
  FileText, 
  Layers, 
  Trash2, 
  Download, 
  Eye, 
  Search, 
  Upload,
  X,
  Calendar,
  CheckCircle2,
  Image as ImageIcon,
  Box,
  ChevronRight,
  Info
} from 'lucide-react';

interface ImagingExam {
  id: string;
  title: string;
  date: string;
  modality: 'IRM' | 'SCANNER' | 'RADIO' | 'ECHO' | 'MAMMO' | 'PET-SCAN';
  reportType: 'PDF' | 'Image';
  dicomCount: number;
  doctor: string;
  status: 'Complet' | 'Partiel';
}

const MOCK_IMAGING: ImagingExam[] = [
  { id: '1', title: 'IRM Cérébrale - Protocole AVC', date: '2023-10-25', modality: 'IRM', reportType: 'PDF', dicomCount: 154, doctor: 'Dr. Radiologue', status: 'Complet' },
  { id: '2', title: 'Scanner Thoraco-Abdominal', date: '2023-10-22', modality: 'SCANNER', reportType: 'PDF', dicomCount: 420, doctor: 'Dr. Radiologue', status: 'Complet' },
  { id: '3', title: 'Radio Thorax Face/Profil', date: '2023-10-20', modality: 'RADIO', reportType: 'Image', dicomCount: 2, doctor: 'Dr. Externe', status: 'Complet' },
];

export const Imagerie: React.FC = () => {
  const [exams, setExams] = useState<ImagingExam[]>(MOCK_IMAGING);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form State
  const [newTitle, setNewTitle] = useState('');
  const [newModality, setNewModality] = useState<ImagingExam['modality']>('IRM');
  const [newDicomCount, setNewDicomCount] = useState<string>('0');
  const reportInputRef = useRef<HTMLInputElement>(null);
  const dicomInputRef = useRef<HTMLInputElement>(null);

  const filteredExams = exams.filter(e => 
    e.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.modality.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSave = () => {
    if (!newTitle) return;

    const newEntry: ImagingExam = {
      id: Date.now().toString(),
      title: newTitle,
      date: new Date().toISOString().split('T')[0],
      modality: newModality,
      reportType: 'PDF',
      dicomCount: parseInt(newDicomCount) || 0,
      doctor: 'Dr. S. Alami',
      status: 'Complet'
    };

    setExams([newEntry, ...exams]);
    setIsModalOpen(false);
    setNewTitle('');
    setNewDicomCount('0');
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Supprimer cet examen d\'imagerie et ses fichiers associés ?')) {
      setExams(exams.filter(e => e.id !== id));
    }
  };

  const getModalityColor = (m: string) => {
    switch (m) {
      case 'IRM': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'SCANNER': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'RADIO': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'ECHO': return 'bg-teal-100 text-teal-700 border-teal-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <ScanLine className="mr-2 text-indigo-600" />
            Imagerie Médicale
          </h3>
          <p className="text-sm text-gray-500">Gestion des comptes-rendus et fichiers DICOM par modalité.</p>
        </div>
        
        <div className="flex w-full md:w-auto gap-3">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Rechercher un examen..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            />
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm font-medium whitespace-nowrap"
          >
            <Plus size={18} />
            <span>Nouvel examen</span>
          </button>
        </div>
      </div>

      {filteredExams.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
          <ScanLine className="mx-auto h-12 w-12 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Aucun examen d'imagerie enregistré.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredExams.map(exam => (
            <div key={exam.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:border-indigo-300 transition-all flex flex-col md:flex-row">
              <div className="p-5 flex-1 flex items-start space-x-4">
                <div className={`p-3 rounded-lg shrink-0 ${getModalityColor(exam.modality)}`}>
                  <ScanLine size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${getModalityColor(exam.modality)}`}>
                      {exam.modality}
                    </span>
                    <span className="text-[10px] text-gray-400 font-bold flex items-center">
                      <Calendar size={12} className="mr-1" />
                      {new Date(exam.date).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="font-bold text-gray-900 text-lg truncate">{exam.title}</h4>
                  <p className="text-xs text-gray-500 mt-0.5 flex items-center">
                    <CheckCircle2 size={12} className="mr-1 text-emerald-500" />
                    Interprété par {exam.doctor}
                  </p>
                </div>
              </div>

              <div className="px-5 py-4 bg-gray-50 border-t md:border-t-0 md:border-l border-gray-200 flex items-center justify-between md:justify-end gap-6 md:w-96">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="flex items-center text-indigo-600 font-bold text-sm bg-white px-2 py-1 rounded border border-indigo-100 mb-1">
                      <FileText size={14} className="mr-1.5" />
                      CR
                    </div>
                    <span className="text-[9px] text-gray-400 uppercase font-black">Rapport</span>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center text-emerald-600 font-bold text-sm bg-white px-2 py-1 rounded border border-emerald-100 mb-1">
                      <Layers size={14} className="mr-1.5" />
                      {exam.dicomCount}
                    </div>
                    <span className="text-[9px] text-gray-400 uppercase font-black">DICOMs</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 border-l border-gray-200 pl-6 ml-2">
                  <button className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Ouvrir le viewer"><Box size={20}/></button>
                  <button className="p-2 text-gray-400 hover:text-red-500 rounded-lg transition-colors" onClick={() => handleDelete(exam.id)}><Trash2 size={18}/></button>
                  <ChevronRight className="text-gray-300 ml-2" size={20} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- Modal Upload --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-indigo-600 text-white">
              <h3 className="text-lg font-bold flex items-center">
                <Upload size={20} className="mr-2"/> Importer un examen d'imagerie
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-white/80 hover:text-white">
                <X size={24}/>
              </button>
            </div>
            
            <div className="p-6 space-y-5 bg-gray-50/30">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-1">Titre de l'examen *</label>
                  <input 
                    type="text" 
                    value={newTitle} 
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2 text-sm" 
                    placeholder="Ex: IRM Genou Droit"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Modalité</label>
                  <select 
                    value={newModality} 
                    onChange={(e) => setNewModality(e.target.value as any)}
                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2 text-sm bg-white"
                  >
                    <option value="IRM">IRM</option>
                    <option value="SCANNER">Scanner (CT)</option>
                    <option value="RADIO">Radiographie</option>
                    <option value="ECHO">Échographie</option>
                    <option value="MAMMO">Mammographie</option>
                    <option value="PET-SCAN">PET-SCAN</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Nb. images DICOM (estimé)</label>
                  <input 
                    type="number" 
                    value={newDicomCount} 
                    onChange={(e) => setNewDicomCount(e.target.value)}
                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div 
                  onClick={() => reportInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-indigo-400 hover:bg-indigo-50 transition-all cursor-pointer group bg-white"
                >
                  <input type="file" ref={reportInputRef} className="hidden" accept=".pdf,image/*" />
                  <FileText className="mx-auto h-8 w-8 text-gray-300 group-hover:text-indigo-500 mb-2" />
                  <p className="text-xs font-bold text-gray-600">Compte-rendu (PDF/IMG)</p>
                </div>
                <div 
                  onClick={() => dicomInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-emerald-400 hover:bg-emerald-50 transition-all cursor-pointer group bg-white"
                >
                  <input type="file" ref={dicomInputRef} className="hidden" multiple accept=".dcm,.dicom" />
                  <Layers className="mx-auto h-8 w-8 text-gray-300 group-hover:text-emerald-500 mb-2" />
                  <p className="text-xs font-bold text-gray-600">Fichiers DICOM (Série)</p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-start space-x-3">
                <Info size={18} className="text-blue-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-blue-700 leading-relaxed font-medium">
                  Le système supporte le glisser-déposer de dossiers entiers pour les fichiers DICOM. Une fois importés, les images seront accessibles via le viewer intégré SahtyView.
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="px-5 py-2 text-gray-600 hover:bg-gray-200 rounded-lg text-sm font-bold transition-colors"
              >
                Annuler
              </button>
              <button 
                onClick={handleSave}
                disabled={!newTitle}
                className="px-6 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-sm font-bold shadow-lg transition-colors flex items-center disabled:opacity-50"
              >
                Valider l'examen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};