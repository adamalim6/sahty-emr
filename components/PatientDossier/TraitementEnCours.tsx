import React, { useState } from 'react';
import { 
  Plus, 
  Pill, 
  Trash2, 
  Pencil, 
  Save, 
  X, 
  Clock, 
  Calendar, 
  User, 
  AlertCircle,
  CheckCircle2,
  PauseCircle,
  Stethoscope,
  Info
} from 'lucide-react';

// --- Types ---

type TreatmentStatus = 'Actif' | 'Suspendu' | 'Terminé';
type AdministrationRoute = 'Orale' | 'IV' | 'IM' | 'Sous-cutanée' | 'Inhalée' | 'Topique' | 'Autre';

interface TreatmentRecord {
  id: string;
  medication: string;
  dosage: string;
  frequency: string;
  route: AdministrationRoute;
  startDate: string;
  endDate?: string;
  prescribingDoctor?: string;
  status: TreatmentStatus;
  notes?: string;
}

const MOCK_TREATMENTS: TreatmentRecord[] = [
  {
    id: '1',
    medication: 'Amlodipine 5mg',
    dosage: '1 comprimé',
    frequency: '1 fois par jour (Matin)',
    route: 'Orale',
    startDate: '2023-01-15',
    prescribingDoctor: 'Dr. Alami',
    status: 'Actif',
    notes: 'Pour l\'HTA.'
  },
  {
    id: '2',
    medication: 'Metformine 1000mg',
    dosage: '1 comprimé',
    frequency: '2 fois par jour (Matin et Soir)',
    route: 'Orale',
    startDate: '2022-11-10',
    prescribingDoctor: 'Dr. Bennani',
    status: 'Actif',
    notes: 'À prendre au milieu du repas.'
  }
];

const INITIAL_FORM: Partial<TreatmentRecord> = {
  medication: '',
  dosage: '',
  frequency: '',
  route: 'Orale',
  startDate: new Date().toISOString().split('T')[0],
  status: 'Actif',
  notes: '',
  prescribingDoctor: 'Dr. S. Alami'
};

export const TraitementEnCours: React.FC = () => {
  const [treatments, setTreatments] = useState<TreatmentRecord[]>(MOCK_TREATMENTS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<TreatmentRecord>>(INITIAL_FORM);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    if (!formData.medication) return;

    if (formData.id) {
      setTreatments(prev => prev.map(t => t.id === formData.id ? { ...formData as TreatmentRecord } : t));
    } else {
      const newTreatment = { ...formData, id: Date.now().toString() } as TreatmentRecord;
      setTreatments([newTreatment, ...treatments]);
    }

    setIsModalOpen(false);
    setFormData(INITIAL_FORM);
  };

  const handleEdit = (treatment: TreatmentRecord) => {
    setFormData(treatment);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Supprimer ce traitement de la liste ?')) {
      setTreatments(prev => prev.filter(t => t.id !== id));
    }
  };

  const getStatusStyle = (status: TreatmentStatus) => {
    switch (status) {
      case 'Actif': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Suspendu': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Terminé': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="min-h-[400px]">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <Pill className="mr-2 text-emerald-600" />
            Traitements en Cours
          </h3>
          <p className="text-sm text-gray-500">Médicaments actuellement administrés ou suivis par le patient.</p>
        </div>
        <button 
          onClick={() => { setFormData(INITIAL_FORM); setIsModalOpen(true); }}
          className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm font-medium"
        >
          <Plus size={18} />
          <span>Ajouter un traitement</span>
        </button>
      </div>

      {treatments.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
          <Pill className="mx-auto h-12 w-12 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Aucun traitement en cours enregistré.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {treatments.map(treatment => (
            <div key={treatment.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                    <Pill size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">{treatment.medication}</h4>
                    <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">{treatment.route}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${getStatusStyle(treatment.status)}`}>
                    {treatment.status === 'Actif' && <CheckCircle2 size={10} className="inline mr-1" />}
                    {treatment.status === 'Suspendu' && <PauseCircle size={10} className="inline mr-1" />}
                    {treatment.status}
                  </span>
                  <div className="flex space-x-1 border-l border-gray-100 pl-2 ml-1">
                    <button onClick={() => handleEdit(treatment)} className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors" title="Modifier"><Pencil size={14}/></button>
                    <button onClick={() => handleDelete(treatment.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors" title="Supprimer"><Trash2 size={14}/></button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Posologie</span>
                  <div className="flex items-center text-sm font-bold text-gray-800">
                    <Clock size={14} className="mr-2 text-emerald-500" />
                    {treatment.dosage} — {treatment.frequency}
                  </div>
                </div>
                <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Prescrit par</span>
                  <div className="flex items-center text-sm font-bold text-gray-800">
                    <Stethoscope size={14} className="mr-2 text-blue-500" />
                    {treatment.prescribingDoctor || 'Inconnu'}
                  </div>
                </div>
              </div>

              {treatment.notes && (
                <div className="text-xs text-gray-600 bg-emerald-50/30 p-3 rounded-lg italic border border-emerald-100/50 mb-4">
                  <span className="font-bold text-emerald-800 non-italic block mb-1">Instructions :</span>
                  {treatment.notes}
                </div>
              )}
              
              <div className="flex items-center justify-between text-[10px] text-gray-400 pt-2 border-t border-gray-50">
                <div className="flex items-center">
                  <Calendar size={12} className="mr-1"/> Débuté le {new Date(treatment.startDate).toLocaleDateString()}
                </div>
                {treatment.endDate && (
                  <div className="flex items-center">
                    Fin prévue : {new Date(treatment.endDate).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- Modal Form --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900 flex items-center">
                <Pill size={20} className="mr-2 text-emerald-600"/>
                {formData.id ? 'Modifier le traitement' : 'Ajouter un traitement'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </div>
            
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Médicament (Nom & Dosage) *</label>
                <input 
                  type="text" 
                  name="medication" 
                  value={formData.medication} 
                  onChange={handleInputChange} 
                  placeholder="Ex: Paracétamol 500mg, Kardegic 75mg..."
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 px-4 py-3 text-sm"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Posologie</label>
                  <input 
                    type="text" 
                    name="dosage" 
                    value={formData.dosage} 
                    onChange={handleInputChange} 
                    placeholder="Ex: 1 comprimé"
                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Voie</label>
                  <select name="route" value={formData.route} onChange={handleInputChange} className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 px-3 py-2 text-sm bg-white">
                    <option value="Orale">Orale</option>
                    <option value="IV">Intraveineuse (IV)</option>
                    <option value="IM">Intramusculaire (IM)</option>
                    <option value="Sous-cutanée">Sous-cutanée</option>
                    <option value="Inhalée">Inhalée</option>
                    <option value="Topique">Topique</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Fréquence d'administration</label>
                <input 
                  type="text" 
                  name="frequency" 
                  value={formData.frequency} 
                  onChange={handleInputChange} 
                  placeholder="Ex: 3 fois par jour, toutes les 8h..."
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Date de début</label>
                  <input type="date" name="startDate" value={formData.startDate} onChange={handleInputChange} className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Médecin prescripteur</label>
                  <input type="text" name="prescribingDoctor" value={formData.prescribingDoctor} onChange={handleInputChange} placeholder="Nom du médecin" className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 px-3 py-2 text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Statut</label>
                  <select name="status" value={formData.status} onChange={handleInputChange} className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 px-3 py-2 text-sm bg-white">
                    <option value="Actif">Actif</option>
                    <option value="Suspendu">Suspendu</option>
                    <option value="Terminé">Terminé</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Date de fin (optionnel)</label>
                  <input type="date" name="endDate" value={formData.endDate || ''} onChange={handleInputChange} className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 px-3 py-2 text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Notes & Instructions particulières</label>
                <textarea name="notes" value={formData.notes} onChange={handleInputChange} rows={3} className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 px-3 py-2 text-sm" placeholder="Ex: À prendre au milieu du repas, éviter l'exposition au soleil..." />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
              <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-gray-700 hover:bg-gray-200 rounded-lg text-sm font-bold transition-colors">Annuler</button>
              <button 
                onClick={handleSave} 
                disabled={!formData.medication} 
                className="px-5 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-sm font-bold shadow-lg transition-colors flex items-center disabled:opacity-50"
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