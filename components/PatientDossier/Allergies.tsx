import React, { useState } from 'react';
import { 
  Plus, 
  ShieldAlert, 
  AlertTriangle, 
  Info, 
  X, 
  Save, 
  AlertOctagon,
  CheckCircle2,
  Trash2,
  Pencil
} from 'lucide-react';

// --- Types ---

type Severity = 'Légère' | 'Modérée' | 'Sévère' | 'Choc Anaphylactique';
type AllergyType = 'Médicamenteuse' | 'Alimentaire' | 'Environnementale' | 'Contact' | 'Autre';
type Status = 'Active' | 'Douteuse' | 'Résolue';

interface AllergyRecord {
  id: string;
  molecule: string; // ou allergène
  type: AllergyType;
  severity: Severity;
  reaction: string;
  dateDeclared: string;
  status: Status;
  manifestations: string[];
}

const INITIAL_FORM: Partial<AllergyRecord> = {
  molecule: '',
  type: 'Médicamenteuse',
  severity: 'Modérée',
  reaction: '',
  dateDeclared: new Date().toISOString().split('T')[0],
  status: 'Active',
  manifestations: []
};

const MOCK_ALLERGIES: AllergyRecord[] = [
  {
    id: '1',
    molecule: 'Pénicilline',
    type: 'Médicamenteuse',
    severity: 'Sévère',
    reaction: 'Oedème de Quincke',
    dateDeclared: '2015-06-12',
    status: 'Active',
    manifestations: ['Respiratoire', 'Cutanée']
  }
];

// --- Helpers ---

const getSeverityStyle = (severity: Severity) => {
  switch (severity) {
    case 'Choc Anaphylactique': return 'bg-red-100 text-red-800 border-red-200 ring-red-500';
    case 'Sévère': return 'bg-orange-100 text-orange-800 border-orange-200 ring-orange-500';
    case 'Modérée': return 'bg-yellow-100 text-yellow-800 border-yellow-200 ring-yellow-500';
    case 'Légère': return 'bg-blue-100 text-blue-800 border-blue-200 ring-blue-500';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getTypeIcon = (type: AllergyType) => {
  switch (type) {
    case 'Médicamenteuse': return <ShieldAlert size={16} className="mr-1"/>;
    case 'Alimentaire': return <span className="mr-1 text-lg leading-none">🍏</span>;
    case 'Environnementale': return <span className="mr-1 text-lg leading-none">🌿</span>;
    default: return <Info size={16} className="mr-1"/>;
  }
};

// --- Constants for Styles ---
const inputClassName = "block w-full rounded-lg border border-gray-300 shadow-sm focus:border-rose-500 focus:ring-rose-500 px-4 py-3 text-sm text-gray-900 bg-white hover:border-gray-400 transition-colors placeholder-gray-400";
const labelClassName = "block text-sm font-bold text-gray-700 mb-2";

export const Allergies: React.FC = () => {
  const [allergies, setAllergies] = useState<AllergyRecord[]>(MOCK_ALLERGIES);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<AllergyRecord>>(INITIAL_FORM);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleManifestation = (manif: string) => {
    setFormData(prev => {
      const current = prev.manifestations || [];
      if (current.includes(manif)) {
        return { ...prev, manifestations: current.filter(m => m !== manif) };
      } else {
        return { ...prev, manifestations: [...current, manif] };
      }
    });
  };

  const handleSave = () => {
    if (!formData.molecule) return;
    
    if (formData.id) {
      // Edit existing
      setAllergies(prev => prev.map(a => a.id === formData.id ? { ...formData as AllergyRecord } : a));
    } else {
      // Create new
      const newRecord = { ...formData, id: Date.now().toString() } as AllergyRecord;
      setAllergies([newRecord, ...allergies]);
    }
    
    setIsModalOpen(false);
    setFormData(INITIAL_FORM);
  };

  const handleEdit = (allergy: AllergyRecord) => {
    setFormData(allergy);
    setIsModalOpen(true);
  };

  const handleCreateNew = () => {
    setFormData(INITIAL_FORM);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if(window.confirm('Êtes-vous sûr de vouloir supprimer cette allergie ?')) {
      setAllergies(prev => prev.filter(a => a.id !== id));
    }
  };

  return (
    <div className="min-h-[400px]">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <ShieldAlert className="mr-2 text-rose-600" />
            Allergies & Intolérances
          </h3>
          <p className="text-sm text-gray-500">Liste des allergènes connus et réactions associées.</p>
        </div>
        <button 
          onClick={handleCreateNew}
          className="flex items-center space-x-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm font-medium"
        >
          <Plus size={18} />
          <span>Ajouter une allergie</span>
        </button>
      </div>

      {allergies.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
          <div className="mx-auto h-16 w-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
            <ShieldAlert className="h-8 w-8 text-gray-300" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">Aucune allergie connue</h3>
          <p className="mt-1 text-gray-500">Le patient n'a pas d'allergies déclarées pour le moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {allergies.map(allergy => (
            <div key={allergy.id} className={`bg-white rounded-xl border-l-4 shadow-sm p-5 hover:shadow-md transition-all ${allergy.severity.includes('Choc') || allergy.severity === 'Sévère' ? 'border-l-red-500' : 'border-l-yellow-500'} border-y border-r border-gray-200`}>
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center">
                   <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold mr-2 ${getSeverityStyle(allergy.severity)}`}>
                     {allergy.severity === 'Choc Anaphylactique' && <AlertOctagon size={12} className="mr-1"/>}
                     {allergy.severity}
                   </span>
                   <span className="text-xs text-gray-500 font-medium px-2 py-0.5 bg-gray-100 rounded border border-gray-200 flex items-center">
                     {getTypeIcon(allergy.type)}
                     {allergy.type}
                   </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${allergy.status === 'Active' ? 'bg-rose-50 text-rose-700' : 'bg-green-50 text-green-700'}`}>
                    {allergy.status}
                  </span>
                  
                  {/* Actions */}
                  <div className="flex items-center border-l border-gray-200 pl-2 ml-2 space-x-1">
                    <button 
                      onClick={() => handleEdit(allergy)} 
                      className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Éditer"
                    >
                      <Pencil size={16}/>
                    </button>
                    <button 
                      onClick={() => handleDelete(allergy.id)} 
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 size={16}/>
                    </button>
                  </div>
                </div>
              </div>
              
              <h4 className="text-xl font-bold text-gray-900 mb-1">{allergy.molecule}</h4>
              
              <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 mb-3 border border-gray-100">
                <span className="font-semibold text-gray-500 text-xs uppercase block mb-1">Réaction & Manifestations</span>
                {allergy.reaction}
                {allergy.manifestations && allergy.manifestations.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {allergy.manifestations.map(m => (
                      <span key={m} className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-xs text-gray-600">{m}</span>
                    ))}
                  </div>
                )}
              </div>

              <div className="text-xs text-gray-400 flex items-center">
                <Info size={12} className="mr-1"/> Déclarée le {new Date(allergy.dateDeclared).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- Modal --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900 flex items-center">
                <Plus size={20} className="mr-2 text-rose-600"/> 
                {formData.id ? 'Modifier l\'Allergie' : 'Nouvelle Allergie'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <label className={labelClassName}>Allergène / Molécule *</label>
                <input 
                  type="text" 
                  name="molecule" 
                  value={formData.molecule} 
                  onChange={handleInputChange} 
                  className={inputClassName}
                  placeholder="Ex: Amoxicilline, Arachide..."
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className={labelClassName}>Type</label>
                  <select name="type" value={formData.type} onChange={handleInputChange} className={inputClassName}>
                    <option value="Médicamenteuse">Médicamenteuse</option>
                    <option value="Alimentaire">Alimentaire</option>
                    <option value="Environnementale">Environnementale</option>
                    <option value="Contact">Contact</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>
                <div>
                  <label className={labelClassName}>Sévérité</label>
                  <select name="severity" value={formData.severity} onChange={handleInputChange} className={`${inputClassName} font-medium`}>
                    <option value="Légère">Légère</option>
                    <option value="Modérée">Modérée</option>
                    <option value="Sévère">Sévère</option>
                    <option value="Choc Anaphylactique">Choc Anaphylactique</option>
                  </select>
                </div>
              </div>

              <div>
                 <label className={labelClassName}>Manifestations</label>
                 <div className="flex flex-wrap gap-2 p-4 bg-gray-50 rounded-lg border border-gray-100">
                   {['Cutanée', 'Respiratoire', 'Digestive', 'Cardiovasculaire', 'Neurologique'].map(m => (
                     <button
                       key={m}
                       onClick={() => toggleManifestation(m)}
                       className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${formData.manifestations?.includes(m) ? 'bg-rose-500 border-rose-600 text-white shadow-md transform scale-105' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-100 hover:border-gray-400'}`}
                     >
                       {m}
                     </button>
                   ))}
                 </div>
              </div>

              <div>
                <label className={labelClassName}>Description de la réaction</label>
                <textarea 
                  name="reaction" 
                  value={formData.reaction} 
                  onChange={handleInputChange} 
                  rows={3} 
                  className={inputClassName}
                  placeholder="Ex: Urticaire géant, gêne respiratoire, œdème..."
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                 <div>
                    <label className={labelClassName}>Date déclaration</label>
                    <input type="date" name="dateDeclared" value={formData.dateDeclared} onChange={handleInputChange} className={inputClassName} />
                 </div>
                 <div>
                    <label className={labelClassName}>Statut</label>
                    <select name="status" value={formData.status} onChange={handleInputChange} className={inputClassName}>
                      <option value="Active">Active</option>
                      <option value="Douteuse">Douteuse</option>
                      <option value="Résolue">Résolue</option>
                    </select>
                 </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
               <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-gray-700 hover:bg-gray-200 rounded-lg text-sm font-bold transition-colors">Annuler</button>
               <button onClick={handleSave} disabled={!formData.molecule} className="px-5 py-2.5 bg-rose-600 text-white hover:bg-rose-700 rounded-lg text-sm font-bold shadow-lg transition-colors flex items-center disabled:opacity-50 disabled:shadow-none">
                 <Save size={18} className="mr-2"/> Enregistrer
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};