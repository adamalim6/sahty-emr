import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  FilePenLine, 
  Trash2, 
  Pencil, 
  Save, 
  X, 
  Clock, 
  Calendar, 
  User, 
  Stethoscope,
  MessageSquare,
  Search,
  Filter
} from 'lucide-react';

// --- Types ---

type ObservationType = 'Suivi Quotidien' | 'Note d\'Admission' | 'Avis Spécialiste' | 'Note de Sortie' | 'Urgence';

interface MedicalObservation {
  id: string;
  date: string;
  time: string;
  doctor: string;
  type: ObservationType;
  content: string;
  isEdited?: boolean;
}

const MOCK_OBSERVATIONS: MedicalObservation[] = [
  {
    id: '1',
    date: '2023-10-25',
    time: '09:30',
    doctor: 'Dr. S. Alami',
    type: 'Note d\'Admission',
    content: 'Patient admis pour douleur thoracique atypique évoluant depuis 4 heures. ECG initial : Rythme sinusal, pas de trouble de repolarisation franc. Troponine en cours. Mise en observation en cardiologie.'
  },
  {
    id: '2',
    date: '2023-10-25',
    time: '14:00',
    doctor: 'Dr. S. Alami',
    type: 'Suivi Quotidien',
    content: 'Troponine I stable à 12 ng/L (N < 14). Patient asymptomatique ce midi. Poursuite du traitement de base. Programmation d\'une épreuve d\'effort pour demain si stabilité maintenue.'
  }
];

const INITIAL_FORM: Partial<MedicalObservation> = {
  type: 'Suivi Quotidien',
  content: '',
  date: new Date().toISOString().split('T')[0],
  time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  doctor: 'Dr. S. Alami'
};

export const ObservationsMedicales: React.FC = () => {
  const [observations, setObservations] = useState<MedicalObservation[]>(MOCK_OBSERVATIONS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<MedicalObservation>>(INITIAL_FORM);
  const [searchTerm, setSearchTerm] = useState('');

  // Sort observations by date and time (descending)
  const sortedObservations = useMemo(() => {
    return [...observations]
      .filter(obs => obs.content.toLowerCase().includes(searchTerm.toLowerCase()) || obs.type.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => {
        const dateTimeA = new Date(`${a.date}T${a.time}`);
        const dateTimeB = new Date(`${b.date}T${b.time}`);
        return dateTimeB.getTime() - dateTimeA.getTime();
      });
  }, [observations, searchTerm]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    if (!formData.content) return;

    if (formData.id) {
      // Edit existing
      setObservations(prev => prev.map(obs => obs.id === formData.id ? { ...formData as MedicalObservation, isEdited: true } : obs));
    } else {
      // Create new
      const newObs = {
        ...formData,
        id: Date.now().toString(),
      } as MedicalObservation;
      setObservations([newObs, ...observations]);
    }

    setIsModalOpen(false);
    setFormData(INITIAL_FORM);
  };

  const handleEdit = (obs: MedicalObservation) => {
    setFormData(obs);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Voulez-vous vraiment supprimer cette observation ?')) {
      setObservations(prev => prev.filter(obs => obs.id !== id));
    }
  };

  const getTypeStyle = (type: ObservationType) => {
    switch (type) {
      case 'Note d\'Admission': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case 'Urgence': return 'bg-red-100 text-red-700 border-red-200';
      case 'Avis Spécialiste': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'Note de Sortie': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <FilePenLine className="mr-2 text-indigo-600" />
            Observations Médicales
          </h3>
          <p className="text-sm text-gray-500">Journal clinique du patient tenu par les médecins.</p>
        </div>
        
        <div className="flex w-full md:w-auto gap-3">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Rechercher une note..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            />
          </div>
          <button 
            onClick={() => { setFormData(INITIAL_FORM); setIsModalOpen(true); }}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm font-medium whitespace-nowrap"
          >
            <Plus size={18} />
            <span>Nouvelle observation</span>
          </button>
        </div>
      </div>

      {sortedObservations.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
          <MessageSquare className="mx-auto h-12 w-12 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Aucune observation médicale enregistrée.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedObservations.map(obs => (
            <div key={obs.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden group hover:border-indigo-200 transition-all">
              <div className="bg-gray-50 px-5 py-3 border-b border-gray-200 flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center text-xs font-bold text-gray-500 bg-white px-2 py-1 rounded border border-gray-200">
                    <Calendar size={12} className="mr-1.5" />
                    {new Date(obs.date).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                    <Clock size={12} className="ml-3 mr-1.5" />
                    {obs.time}
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getTypeStyle(obs.type)}`}>
                    {obs.type}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                   <span className="text-xs font-bold text-indigo-700 flex items-center bg-indigo-50 px-2 py-1 rounded">
                     <Stethoscope size={12} className="mr-1.5"/>
                     {obs.doctor}
                   </span>
                   <div className="flex items-center space-x-1 border-l border-gray-200 pl-2 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEdit(obs)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Modifier">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(obs.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Supprimer">
                        <Trash2 size={14} />
                      </button>
                   </div>
                </div>
              </div>
              <div className="p-5">
                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                  {obs.content}
                </p>
                {obs.isEdited && (
                  <span className="text-[10px] text-gray-400 italic mt-3 block">Modifié par le médecin</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- Modal --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900 flex items-center">
                <FilePenLine size={20} className="mr-2 text-indigo-600"/>
                {formData.id ? 'Modifier l\'Observation' : 'Nouvelle Observation Médicale'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20}/>
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Type d'Observation</label>
                  <select 
                    name="type" 
                    value={formData.type} 
                    onChange={handleInputChange} 
                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2 text-sm bg-white"
                  >
                    <option value="Suivi Quotidien">Suivi Quotidien</option>
                    <option value="Note d'Admission">Note d'Admission</option>
                    <option value="Avis Spécialiste">Avis Spécialiste</option>
                    <option value="Note de Sortie">Note de Sortie</option>
                    <option value="Urgence">Urgence</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Médecin</label>
                  <input 
                    type="text" 
                    name="doctor" 
                    value={formData.doctor} 
                    onChange={handleInputChange} 
                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2 text-sm bg-gray-50" 
                    disabled
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Date</label>
                    <input 
                      type="date" 
                      name="date" 
                      value={formData.date} 
                      onChange={handleInputChange} 
                      className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2 text-sm" 
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Heure</label>
                    <input 
                      type="time" 
                      name="time" 
                      value={formData.time} 
                      onChange={handleInputChange} 
                      className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2 text-sm" 
                    />
                 </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Contenu de l'observation *</label>
                <textarea 
                  name="content" 
                  value={formData.content} 
                  onChange={handleInputChange} 
                  rows={8} 
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 px-4 py-3 text-sm leading-relaxed" 
                  placeholder="Saisissez vos constatations cliniques, l'évolution, le plan thérapeutique..."
                  autoFocus
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="px-5 py-2.5 text-gray-700 hover:bg-gray-200 rounded-lg text-sm font-bold transition-colors"
              >
                Annuler
              </button>
              <button 
                onClick={handleSave} 
                disabled={!formData.content} 
                className="px-5 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-sm font-bold shadow-lg transition-colors flex items-center disabled:opacity-50"
              >
                <Save size={18} className="mr-2"/> Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};