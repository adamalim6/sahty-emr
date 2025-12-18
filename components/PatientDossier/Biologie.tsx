import React, { useState, useRef } from 'react';
import { 
  Plus, 
  FlaskConical, 
  FileText, 
  FileImage, 
  Trash2, 
  Download, 
  Eye, 
  Search, 
  Upload,
  X,
  Calendar,
  CheckCircle2,
  Clock,
  Filter
} from 'lucide-react';

interface BioResult {
  id: string;
  title: string;
  date: string;
  type: 'PDF' | 'Image';
  fileSize: string;
  category: string;
  status: 'Validé' | 'En attente';
}

const MOCK_RESULTS: BioResult[] = [
  { id: '1', title: 'Bilan de coagulation', date: '2023-10-25', type: 'PDF', fileSize: '1.2 MB', category: 'Hémostase', status: 'Validé' },
  { id: '2', title: 'Ionogramme sanguin', date: '2023-10-24', type: 'Image', fileSize: '850 KB', category: 'Biochimie', status: 'Validé' },
];

export const Biologie: React.FC = () => {
  const [results, setResults] = useState<BioResult[]>(MOCK_RESULTS);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Biochimie');

  const filteredResults = results.filter(r => 
    r.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    const type = extension === 'pdf' ? 'PDF' : 'Image';
    
    const newResult: BioResult = {
      id: Date.now().toString(),
      title: newTitle || file.name,
      date: new Date().toISOString().split('T')[0],
      type,
      fileSize: (file.size / 1024 / 1024).toFixed(1) + ' MB',
      category: newCategory,
      status: 'Validé'
    };

    setResults([newResult, ...results]);
    setIsModalOpen(false);
    setNewTitle('');
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Supprimer ce bilan biologique ?')) {
      setResults(results.filter(r => r.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <FlaskConical className="mr-2 text-indigo-600" />
            Biologie
          </h3>
          <p className="text-sm text-gray-500">Consultez et importez les résultats des bilans biologiques.</p>
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
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm font-medium whitespace-nowrap"
          >
            <Plus size={18} />
            <span>Ajouter un bilan</span>
          </button>
        </div>
      </div>

      {filteredResults.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
          <FlaskConical className="mx-auto h-12 w-12 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Aucun résultat biologique disponible.</p>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="mt-4 text-indigo-600 font-bold hover:underline"
          >
            Importer un document maintenant
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredResults.map(result => (
            <div key={result.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:border-indigo-300 transition-all group">
              <div className="p-4 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                 <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase rounded tracking-wider">
                   {result.category}
                 </span>
                 <span className="flex items-center text-[10px] text-gray-400 font-bold">
                    <Calendar size={12} className="mr-1" />
                    {new Date(result.date).toLocaleDateString()}
                 </span>
              </div>
              <div className="p-5 flex items-start space-x-4">
                <div className={`p-3 rounded-lg shrink-0 ${result.type === 'PDF' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                  {result.type === 'PDF' ? <FileText size={24} /> : <FileImage size={24} />}
                </div>
                <div className="flex-1 min-w-0">
                   <h4 className="font-bold text-gray-900 truncate" title={result.title}>{result.title}</h4>
                   <p className="text-xs text-gray-500 mt-0.5">{result.type} • {result.fileSize}</p>
                   <div className="mt-3 flex items-center text-[10px] font-bold text-emerald-600">
                     <CheckCircle2 size={12} className="mr-1" />
                     {result.status}
                   </div>
                </div>
              </div>
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                 <div className="flex space-x-2">
                   <button className="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors" title="Visualiser">
                     <Eye size={16} />
                   </button>
                   <button className="p-1.5 text-gray-400 hover:text-emerald-600 transition-colors" title="Télécharger">
                     <Download size={16} />
                   </button>
                 </div>
                 <button 
                   onClick={() => handleDelete(result.id)}
                   className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                 >
                   <Trash2 size={16} />
                 </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- Modal Upload --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-indigo-600 text-white">
              <h3 className="text-lg font-bold flex items-center">
                <Upload size={20} className="mr-2"/> Importer un bilan
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-white/80 hover:text-white">
                <X size={24}/>
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Titre du bilan</label>
                <input 
                  type="text" 
                  value={newTitle} 
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2 text-sm" 
                  placeholder="Ex: NFS du 25 Octobre"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Catégorie</label>
                <select 
                  value={newCategory} 
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2 text-sm bg-white"
                >
                  <option value="Biochimie">Biochimie</option>
                  <option value="Hématologie">Hématologie</option>
                  <option value="Hémostase">Hémostase</option>
                  <option value="Bactériologie">Bactériologie</option>
                  <option value="Immunologie">Immunologie</option>
                </select>
              </div>

              <div 
                onClick={() => fileInputRef.current?.click()}
                className="mt-6 border-2 border-dashed border-gray-300 rounded-xl p-10 text-center hover:border-indigo-400 hover:bg-indigo-50 transition-all cursor-pointer group"
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".pdf,image/png,image/jpeg"
                  onChange={handleFileUpload}
                />
                <div className="flex flex-col items-center">
                  <div className="p-4 bg-gray-100 rounded-full text-gray-400 group-hover:text-indigo-600 group-hover:bg-indigo-100 transition-colors mb-4">
                    <Upload size={32} />
                  </div>
                  <p className="text-sm font-bold text-gray-700">Cliquez ou glissez un fichier ici</p>
                  <p className="text-xs text-gray-500 mt-1">PDF, PNG ou JPG (Max. 10MB)</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="px-5 py-2.5 text-gray-700 hover:bg-gray-200 rounded-lg text-sm font-bold transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};