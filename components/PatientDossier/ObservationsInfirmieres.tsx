import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Syringe, 
  Trash2, 
  Pencil, 
  Save, 
  X, 
  Clock, 
  Calendar, 
  User, 
  ClipboardCheck,
  MessageSquare,
  Search,
  AlertCircle
} from 'lucide-react';

// --- Types ---

type NurseObservationType = 'Suivi standard' | 'Soin réalisé' | 'Alerte' | 'Transmission' | 'Administration';

interface NursingObservation {
  id: string;
  date: string;
  time: string;
  nurseName: string;
  type: NurseObservationType;
  content: string;
  isEdited?: boolean;
}

const MOCK_NURSE_OBSERVATIONS: NursingObservation[] = [
  {
    id: '1',
    date: '2023-10-25',
    time: '08:15',
    nurseName: 'Inf. Karima B.',
    type: 'Soin réalisé',
    content: 'Toilette complète au lit réalisée. Prévention d\'escarres (alternance de position). Pansement de la voie centrale refait à neuf, propre.'
  },
  {
    id: '2',
    date: '2023-10-25',
    time: '12:00',
    nurseName: 'Inf. Karima B.',
    type: 'Administration',
    content: 'Traitements de midi administrés. Patient a bien mangé la moitié de son plateau. Diurèse sur sonde : 400ml.'
  }
];

const INITIAL_FORM: Partial<NursingObservation> = {
  type: 'Suivi standard',
  content: '',
  date: new Date().toISOString().split('T')[0],
  time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  nurseName: 'Inf. Karima B.'
};

export const ObservationsInfirmieres: React.FC = () => {
  const [observations, setObservations] = useState<NursingObservation[]>(MOCK_NURSE_OBSERVATIONS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<NursingObservation>>(INITIAL_FORM);
  const [searchTerm, setSearchTerm] = useState('');

  // Tri chronologique inverse (le plus récent en haut)
  const sortedObservations = useMemo(() => {
    return [...observations]
      .filter(obs => 
        obs.content.toLowerCase().includes(searchTerm.toLowerCase()) || 
        obs.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        obs.nurseName.toLowerCase().includes(searchTerm.toLowerCase())
      )
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
      // Édition
      setObservations(prev => prev.map(obs => obs.id === formData.id ? { ...formData as NursingObservation, isEdited: true } : obs));
    } else {
      // Création
      const newObs = {
        ...formData,
        id: Date.now().toString(),
      } as NursingObservation;
      setObservations([newObs, ...observations]);
    }

    setIsModalOpen(false);
    setFormData(INITIAL_FORM);
  };

  const handleEdit = (obs: NursingObservation) => {
    setFormData(obs);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Supprimer cette transmission infirmière ?')) {
      setObservations(prev => prev.filter(obs => obs.id !== id));
    }
  };

  const getTypeStyle = (type: NurseObservationType) => {
    switch (type) {
      case 'Alerte': return 'bg-red-100 text-red-700 border-red-200';
      case 'Soin réalisé': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Administration': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Transmission': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <Syringe className="mr-2 text-emerald-600" />
            Observations & Transmissions Infirmieres
          </h3>
          <p className="text-sm text-gray-500">Suivi continu des soins et transmissions de l'équipe paramédicale.</p>
        </div>
        
        <div className="flex w-full md:w-auto gap-3">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Rechercher une transmission..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 bg-white shadow-sm"
            />
          </div>
          <button 
            onClick={() => { setFormData(INITIAL_FORM); setIsModalOpen(true); }}
            className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm font-medium whitespace-nowrap"
          >
            <Plus size={18} />
            <span>Nouvelle transmission</span>
          </button>
        </div>
      </div>

      {sortedObservations.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
          <ClipboardCheck className="mx-auto h-12 w-12 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Aucune transmission infirmière pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedObservations.map(obs => (
            <div key={obs.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden group hover:border-emerald-200 transition-all">
              <div className="bg-gray-50 px-5 py-3 border-b border-gray-200 flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center text-xs font-bold text-gray-500 bg-white px-2 py-1 rounded border border-gray-200">
                    <Calendar size={12} className="mr-1.5 text-emerald-500" />
                    {new Date(obs.date).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                    <Clock size={12} className="ml-3 mr-1.5 text-emerald-500" />
                    {obs.time}
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getTypeStyle(obs.type)}`}>
                    {obs.type}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                   <span className="text-xs font-bold text-emerald-700 flex items-center bg-emerald-50 px-2 py-1 rounded">
                     <User size={12} className="mr-1.5"/>
                     {obs.nurseName}
                   </span>
                   <div className="flex items-center space-x-1 border-l border-gray-200 pl-2 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEdit(obs)} className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors" title="Modifier">
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
                  <span className="text-[10px] text-gray-400 italic mt-3 block flex items-center">
                    <AlertCircle size={10} className="mr-1" /> Note modifiée
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- Modal Form --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-emerald-600 text-white">
              <h3 className="text-lg font-bold flex items-center">
                <Syringe size={20} className="mr-2"/>
                {formData.id ? 'Modifier la Transmission' : 'Nouvelle Transmission Infirmière'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-white/80 hover:text-white">
                <X size={24}/>
              </button>
            </div>
            
            <div className="p-6 space-y-5 bg-gray-50/30">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Type de transmission</label>
                  <select 
                    name="type" 
                    value={formData.type} 
                    onChange={handleInputChange} 
                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 px-3 py-2 text-sm bg-white"
                  >
                    <option value="Suivi standard">Suivi standard</option>
                    <option value="Soin réalisé">Soin réalisé</option>
                    <option value="Administration">Administration médicamenteuse</option>
                    <option value="Transmission">Transmission (relève)</option>
                    <option value="Alerte">Alerte / Incident</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Infirmier(e)</label>
                  <input 
                    type="text" 
                    name="nurseName" 
                    value={formData.nurseName} 
                    onChange={handleInputChange} 
                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 px-3 py-2 text-sm bg-gray-100" 
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
                      className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 px-3 py-2 text-sm bg-white" 
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Heure</label>
                    <input 
                      type="time" 
                      name="time" 
                      value={formData.time} 
                      onChange={handleInputChange} 
                      className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 px-3 py-2 text-sm bg-white" 
                    />
                 </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Contenu de la transmission *</label>
                <textarea 
                  name="content" 
                  value={formData.content} 
                  onChange={handleInputChange} 
                  rows={8} 
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 px-4 py-3 text-sm leading-relaxed bg-white" 
                  placeholder="Détaillez les soins, l'état cutané, l'alimentation, les dispositifs invasifs, les transmissions pour l'équipe suivante..."
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
                className="px-5 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-sm font-bold shadow-lg transition-colors flex items-center disabled:opacity-50"
              >
                <Save size={18} className="mr-2"/> Enregistrer la note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};