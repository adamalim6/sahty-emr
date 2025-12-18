import React, { useState } from 'react';
import { 
  Plus, 
  Calendar, 
  User, 
  FileText, 
  CheckSquare, 
  AlertTriangle, 
  Package, 
  Syringe, 
  Activity, 
  Scissors, 
  ChevronRight, 
  ArrowLeft,
  Save,
  Clock,
  Stethoscope,
  ClipboardCheck,
  AlertOctagon,
  FileCheck
} from 'lucide-react';
import { AnesthesiaConsultationModule } from './AnesthesiaConsultation';

// --- Types ---

type InterventionStatus = 'Programmée' | 'En cours' | 'Terminée' | 'Annulée';
type UrgencyType = 'Programmée' | 'Urgente';

interface MaterialItem {
  id: string;
  name: string;
  status: 'Demandé' | 'Disponible' | 'Manquant';
}

interface Incident {
  id: string;
  type: 'Médical' | 'Chirurgical' | 'Matériel' | 'Organisationnel';
  description: string;
  time: string;
  author: string;
}

interface ChecklistHAS {
  induction: {
    identity: boolean;
    site: boolean;
    equipment: boolean;
    oxymeter: boolean;
    allergy: boolean;
    riskAirway: boolean;
    riskBlood: boolean;
  };
  incision: {
    antibiotic: boolean;
    imaging: boolean;
    teamIntro: boolean;
    durationAnticipated: boolean;
  };
  exit: {
    count: boolean;
    labeling: boolean;
    recoveryInfo: boolean;
  };
}

interface Intervention {
  id: string;
  date: string;
  time: string;
  acts: string[];
  surgeon: string;
  anesthetist: string;
  reason: string;
  urgency: UrgencyType;
  status: InterventionStatus;
  
  // Tabs Data
  materials: MaterialItem[];
  anesthesia: {
    consultDate: string;
    asaScore: string;
    history: string;
    conclusion: string;
    authorized: boolean;
  };
  prescriptions: string; // Simplified for UI
  preOpCheck: {
    identity: boolean;
    siteMarked: boolean;
    consent: boolean;
    bloodType: boolean;
  };
  checklistHAS: ChecklistHAS;
  incidents: Incident[];
  postOp: {
    report: string; // CRO
    complications: string;
    destination: 'Réanimation' | 'SSPI' | 'Hospitalisation' | 'Ambulatoire';
  };
}

// --- Mock Data ---

const ACTS_REFERENTIAL = [
  'Appendicectomie',
  'Cholécystectomie',
  'Hernie Inguinale',
  'Prothèse Totale de Hanche',
  'Prothèse Totale de Genou',
  'Césarienne',
  'Cataracte',
  'Coronarographie',
  'Angioplastie'
];

const INITIAL_HAS: ChecklistHAS = {
  induction: { identity: false, site: false, equipment: false, oxymeter: false, allergy: false, riskAirway: false, riskBlood: false },
  incision: { antibiotic: false, imaging: false, teamIntro: false, durationAnticipated: false },
  exit: { count: false, labeling: false, recoveryInfo: false }
};

// --- Components ---

export const Interventions: React.FC = () => {
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [selectedIntervention, setSelectedIntervention] = useState<Intervention | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  // Creation Form State
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newActs, setNewActs] = useState<string[]>([]);
  const [newSurgeon, setNewSurgeon] = useState('Dr. S. Alami'); // Default current user

  // Detail View State
  const [activeTab, setActiveTab] = useState('demande');

  // --- Actions ---

  const handleCreate = () => {
    if (!newDate || !newTime || newActs.length === 0) return;

    const newIntervention: Intervention = {
      id: Date.now().toString(),
      date: newDate,
      time: newTime,
      acts: newActs,
      surgeon: newSurgeon,
      anesthetist: '',
      reason: '',
      urgency: 'Programmée',
      status: 'Programmée',
      materials: [],
      anesthesia: { consultDate: '', asaScore: '1', history: '', conclusion: '', authorized: false },
      prescriptions: '',
      preOpCheck: { identity: false, siteMarked: false, consent: false, bloodType: false },
      checklistHAS: INITIAL_HAS,
      incidents: [],
      postOp: { report: '', complications: '', destination: 'SSPI' }
    };

    setInterventions([newIntervention, ...interventions]);
    setSelectedIntervention(newIntervention);
    setViewMode('detail');
    setIsCreateModalOpen(false);
    
    // Reset Form
    setNewDate('');
    setNewTime('');
    setNewActs([]);
  };

  const updateIntervention = (field: keyof Intervention, value: any) => {
    if (!selectedIntervention) return;
    const updated = { ...selectedIntervention, [field]: value };
    setSelectedIntervention(updated);
    setInterventions(prev => prev.map(i => i.id === updated.id ? updated : i));
  };

  const updateNestedIntervention = (section: keyof Intervention, field: string, value: any) => {
    if (!selectedIntervention) return;
    // @ts-ignore
    const updatedSection = { ...selectedIntervention[section], [field]: value };
    updateIntervention(section, updatedSection);
  };

  const toggleAct = (act: string) => {
    if (newActs.includes(act)) {
      setNewActs(newActs.filter(a => a !== act));
    } else {
      setNewActs([...newActs, act]);
    }
  };

  // --- Renderers ---

  const renderCreateModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-slate-900 px-6 py-4 flex justify-between items-center">
          <h3 className="text-lg font-bold text-white flex items-center"><Scissors className="mr-2" size={20}/> Nouvelle Intervention</h3>
          <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-white"><Activity size={20}/></button>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Prévue *</label>
              <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Heure *</label>
              <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Actes Médicaux Prévus *</label>
            <div className="border border-gray-200 rounded-lg p-3 h-40 overflow-y-auto bg-gray-50">
              {ACTS_REFERENTIAL.map(act => (
                <label key={act} className="flex items-center space-x-3 mb-2 cursor-pointer hover:bg-gray-100 p-1 rounded">
                  <input type="checkbox" checked={newActs.includes(act)} onChange={() => toggleAct(act)} className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 border-gray-300" />
                  <span className="text-sm text-gray-700">{act}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Chirurgien</label>
             <div className="relative">
                <User className="absolute left-3 top-2.5 text-gray-400" size={16} />
                <input type="text" value={newSurgeon} onChange={e => setNewSurgeon(e.target.value)} className="w-full pl-9 border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500" />
             </div>
          </div>
        </div>
        <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 border-t border-gray-200">
          <button onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg">Annuler</button>
          <button onClick={handleCreate} disabled={!newDate || !newTime || newActs.length === 0} className="px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50">Créer l'intervention</button>
        </div>
      </div>
    </div>
  );

  const renderTabNavigation = () => {
    const tabs = [
      { id: 'demande', label: 'Demande', icon: FileText },
      { id: 'materiel', label: 'Matériel', icon: Package },
      { id: 'anesthesie', label: 'Anesthésie', icon: Syringe },
      { id: 'preop', label: 'Vérif. Pré-Op', icon: ClipboardCheck },
      { id: 'has', label: 'Checklist HAS', icon: FileCheck },
      { id: 'incidents', label: 'Incidents', icon: AlertTriangle },
      { id: 'postop', label: 'Post-OP', icon: Activity },
      { id: 'synthese', label: 'Synthèse', icon: Stethoscope },
    ];

    return (
      <div className="flex overflow-x-auto space-x-1 border-b border-gray-200 mb-6 pb-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors
              ${activeTab === tab.id 
                ? 'bg-slate-800 text-white shadow-sm' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}
            `}
          >
            <tab.icon size={16} className={`mr-2 ${activeTab === tab.id ? 'text-emerald-400' : ''}`} />
            {tab.label}
          </button>
        ))}
      </div>
    );
  };

  // --- TAB CONTENT ---

  const renderTabContent = () => {
    if (!selectedIntervention) return null;

    switch(activeTab) {
      case 'demande':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
             <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <h4 className="font-bold text-gray-800 mb-4 flex items-center"><FileText size={18} className="mr-2 text-indigo-600"/> Informations Générales</h4>
                <div className="space-y-4">
                   <div>
                      <span className="text-xs font-bold text-gray-400 uppercase">Actes Prévus</span>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {selectedIntervention.acts.map(act => (
                          <span key={act} className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-sm font-medium border border-indigo-100">{act}</span>
                        ))}
                      </div>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-xs font-bold text-gray-400 uppercase">Date</span>
                        <p className="font-semibold text-gray-900">{new Date(selectedIntervention.date).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-gray-400 uppercase">Heure</span>
                        <p className="font-semibold text-gray-900">{selectedIntervention.time}</p>
                      </div>
                   </div>
                   <div>
                      <span className="text-xs font-bold text-gray-400 uppercase">Chirurgien</span>
                      <p className="font-semibold text-gray-900">{selectedIntervention.surgeon}</p>
                   </div>
                </div>
             </div>
             <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <h4 className="font-bold text-gray-800 mb-4 flex items-center"><Activity size={18} className="mr-2 text-rose-600"/> Contexte & Urgence</h4>
                <div className="space-y-4">
                   <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Caractère de l'intervention</label>
                      <div className="flex space-x-2 bg-gray-100 p-1 rounded-lg">
                         {['Programmée', 'Urgente'].map((type) => (
                           <button
                             key={type}
                             onClick={() => updateIntervention('urgency', type)}
                             className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${selectedIntervention.urgency === type ? (type === 'Urgente' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white') : 'text-gray-500 hover:bg-white'}`}
                           >
                             {type}
                           </button>
                         ))}
                      </div>
                   </div>
                   <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Motif / Indication</label>
                      <textarea 
                        className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm" 
                        rows={3} 
                        placeholder="Ex: Douleurs fosse iliaque droite, syndrome inflammatoire..."
                        value={selectedIntervention.reason}
                        onChange={(e) => updateIntervention('reason', e.target.value)}
                      />
                   </div>
                </div>
             </div>
          </div>
        );

      case 'materiel':
        return (
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm animate-in fade-in">
             <div className="flex justify-between items-center mb-4">
                <h4 className="font-bold text-gray-800 flex items-center"><Package size={18} className="mr-2 text-amber-600"/> Matériel & DMI</h4>
                <button 
                  onClick={() => {
                     const newItem: MaterialItem = { id: Date.now().toString(), name: 'Nouveau matériel', status: 'Demandé' };
                     updateIntervention('materials', [...selectedIntervention.materials, newItem]);
                  }}
                  className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg font-medium transition-colors"
                >
                  + Ajouter
                </button>
             </div>
             {selectedIntervention.materials.length === 0 ? (
               <div className="text-center py-8 text-gray-400 italic bg-gray-50 rounded-lg border border-dashed border-gray-200">
                 Aucun matériel spécifique listé.
               </div>
             ) : (
               <table className="w-full text-sm text-left">
                 <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                   <tr>
                     <th className="px-4 py-2">Désignation</th>
                     <th className="px-4 py-2">Statut</th>
                     <th className="px-4 py-2 text-right">Action</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100">
                   {selectedIntervention.materials.map(mat => (
                     <tr key={mat.id}>
                       <td className="px-4 py-3">
                         <input 
                           type="text" 
                           value={mat.name} 
                           onChange={(e) => {
                             const updatedMats = selectedIntervention.materials.map(m => m.id === mat.id ? {...m, name: e.target.value} : m);
                             updateIntervention('materials', updatedMats);
                           }}
                           className="border-none bg-transparent p-0 focus:ring-0 w-full font-medium text-gray-900 placeholder-gray-400"
                           placeholder="Nom du matériel..."
                         />
                       </td>
                       <td className="px-4 py-3">
                         <select 
                           value={mat.status}
                           onChange={(e) => {
                              const updatedMats = selectedIntervention.materials.map(m => m.id === mat.id ? {...m, status: e.target.value} : m);
                              updateIntervention('materials', updatedMats);
                           }}
                           className={`text-xs rounded-full px-2 py-1 font-bold border-none focus:ring-0 cursor-pointer ${
                             mat.status === 'Disponible' ? 'bg-emerald-100 text-emerald-800' : 
                             mat.status === 'Manquant' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                           }`}
                         >
                           <option value="Demandé">Demandé</option>
                           <option value="Disponible">Disponible</option>
                           <option value="Manquant">Manquant</option>
                         </select>
                       </td>
                       <td className="px-4 py-3 text-right">
                         <button 
                           onClick={() => updateIntervention('materials', selectedIntervention.materials.filter(m => m.id !== mat.id))}
                           className="text-gray-400 hover:text-red-500"
                         >
                           <Scissors size={14} />
                         </button>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             )}
          </div>
        );

      case 'has':
        const CheckItem = ({ checked, label, onChange }: { checked: boolean, label: string, onChange: () => void }) => (
          <label className={`flex items-start p-3 rounded-lg border cursor-pointer transition-all ${checked ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
            <div className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center mr-3 transition-colors ${checked ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-gray-300'}`}>
               {checked && <CheckSquare size={14} className="text-white" />}
            </div>
            <input type="checkbox" className="hidden" checked={checked} onChange={onChange} />
            <span className={`text-sm ${checked ? 'text-emerald-900 font-medium' : 'text-gray-600'}`}>{label}</span>
          </label>
        );

        const toggleCheck = (phase: keyof ChecklistHAS, key: string) => {
           const currentPhase = selectedIntervention.checklistHAS[phase];
           // @ts-ignore
           const newValue = !currentPhase[key];
           const updatedPhase = { ...currentPhase, [key]: newValue };
           updateNestedIntervention('checklistHAS', phase, updatedPhase);
        };

        return (
          <div className="space-y-6 animate-in fade-in">
             {/* Phase 1 */}
             <div className="bg-white rounded-xl border border-indigo-100 shadow-sm overflow-hidden">
                <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-100 flex items-center">
                   <div className="bg-indigo-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mr-3">1</div>
                   <h4 className="font-bold text-indigo-900">Avant l'induction anesthésique</h4>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                   <CheckItem label="Identité du patient vérifiée" checked={selectedIntervention.checklistHAS.induction.identity} onChange={() => toggleCheck('induction', 'identity')} />
                   <CheckItem label="Site opératoire marqué/vérifié" checked={selectedIntervention.checklistHAS.induction.site} onChange={() => toggleCheck('induction', 'site')} />
                   <CheckItem label="Matériel anesthésique vérifié" checked={selectedIntervention.checklistHAS.induction.equipment} onChange={() => toggleCheck('induction', 'equipment')} />
                   <CheckItem label="Oxymètre de pouls en place" checked={selectedIntervention.checklistHAS.induction.oxymeter} onChange={() => toggleCheck('induction', 'oxymeter')} />
                   <CheckItem label="Allergies connues vérifiées" checked={selectedIntervention.checklistHAS.induction.allergy} onChange={() => toggleCheck('induction', 'allergy')} />
                   <CheckItem label="Risque intubation difficile évalué" checked={selectedIntervention.checklistHAS.induction.riskAirway} onChange={() => toggleCheck('induction', 'riskAirway')} />
                </div>
             </div>

             {/* Phase 2 */}
             <div className="bg-white rounded-xl border border-rose-100 shadow-sm overflow-hidden">
                <div className="bg-rose-50 px-4 py-3 border-b border-rose-100 flex items-center">
                   <div className="bg-rose-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mr-3">2</div>
                   <h4 className="font-bold text-rose-900">Avant l'incision cutanée</h4>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                   <CheckItem label="Présentation de l'équipe" checked={selectedIntervention.checklistHAS.incision.teamIntro} onChange={() => toggleCheck('incision', 'teamIntro')} />
                   <CheckItem label="Antibioprophylaxie réalisée (<1h)" checked={selectedIntervention.checklistHAS.incision.antibiotic} onChange={() => toggleCheck('incision', 'antibiotic')} />
                   <CheckItem label="Imagerie essentielle affichée" checked={selectedIntervention.checklistHAS.incision.imaging} onChange={() => toggleCheck('incision', 'imaging')} />
                   <CheckItem label="Durée opératoire anticipée" checked={selectedIntervention.checklistHAS.incision.durationAnticipated} onChange={() => toggleCheck('incision', 'durationAnticipated')} />
                </div>
             </div>

             {/* Phase 3 */}
             <div className="bg-white rounded-xl border border-emerald-100 shadow-sm overflow-hidden">
                <div className="bg-emerald-50 px-4 py-3 border-b border-emerald-100 flex items-center">
                   <div className="bg-emerald-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mr-3">3</div>
                   <h4 className="font-bold text-emerald-900">Avant la sortie de salle</h4>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                   <CheckItem label="Compte des instruments/compresses" checked={selectedIntervention.checklistHAS.exit.count} onChange={() => toggleCheck('exit', 'count')} />
                   <CheckItem label="Étiquetage des prélèvements" checked={selectedIntervention.checklistHAS.exit.labeling} onChange={() => toggleCheck('exit', 'labeling')} />
                   <CheckItem label="Prescriptions post-opératoires" checked={selectedIntervention.checklistHAS.exit.recoveryInfo} onChange={() => toggleCheck('exit', 'recoveryInfo')} />
                </div>
             </div>
          </div>
        );

      case 'postop':
        return (
          <div className="space-y-6 animate-in fade-in">
             <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <h4 className="font-bold text-gray-800 mb-4 flex items-center"><FileText size={18} className="mr-2 text-slate-600"/> Compte Rendu Opératoire (CRO)</h4>
                <textarea 
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-slate-500 focus:border-slate-500 text-sm min-h-[200px]" 
                  placeholder="Saisir le compte rendu ou dicter..."
                  value={selectedIntervention.postOp.report}
                  onChange={(e) => updateNestedIntervention('postOp', 'report', e.target.value)}
                />
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                  <h4 className="font-bold text-gray-800 mb-4 flex items-center"><AlertOctagon size={18} className="mr-2 text-red-600"/> Complications / Suites</h4>
                  <textarea 
                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-red-500 focus:border-red-500 text-sm" 
                    rows={4}
                    placeholder="RAS ou description des complications..."
                    value={selectedIntervention.postOp.complications}
                    onChange={(e) => updateNestedIntervention('postOp', 'complications', e.target.value)}
                  />
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                  <h4 className="font-bold text-gray-800 mb-4 flex items-center"><ArrowLeft size={18} className="mr-2 text-emerald-600 rotate-180"/> Destination Patient</h4>
                  <div className="space-y-2">
                     {['Réanimation', 'SSPI', 'Hospitalisation', 'Ambulatoire'].map((dest) => (
                       <label key={dest} className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${selectedIntervention.postOp.destination === dest ? 'bg-emerald-50 border-emerald-500 shadow-sm' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                          <span className={`text-sm font-medium ${selectedIntervention.postOp.destination === dest ? 'text-emerald-900' : 'text-gray-700'}`}>{dest}</span>
                          <input 
                            type="radio" 
                            name="destination" 
                            checked={selectedIntervention.postOp.destination === dest} 
                            onChange={() => updateNestedIntervention('postOp', 'destination', dest)}
                            className="text-emerald-600 focus:ring-emerald-500"
                          />
                       </label>
                     ))}
                  </div>
                </div>
             </div>
          </div>
        );
      
      case 'anesthesie':
        return (
           <AnesthesiaConsultationModule />
        );

      // Default placeholder for other tabs to save space in this example
      default:
        return (
          <div className="bg-white p-10 rounded-xl border border-gray-200 shadow-sm text-center text-gray-500 italic">
            Contenu de l'onglet <strong>{activeTab}</strong> en cours de développement ou non implémenté dans cette démo.
          </div>
        );
    }
  };

  // --- Main View Logic ---

  if (viewMode === 'list') {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Interventions Chirurgicales</h3>
            <p className="text-sm text-gray-500">Programmation et suivi du bloc opératoire.</p>
          </div>
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center space-x-2 bg-slate-900 hover:bg-black text-white px-4 py-2 rounded-lg transition-colors shadow-sm font-medium"
          >
            <Plus size={18} />
            <span>Nouvelle intervention</span>
          </button>
        </div>

        {interventions.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
            <Scissors className="mx-auto h-12 w-12 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">Aucune intervention programmée.</p>
            <p className="text-sm text-gray-400">Cliquez sur "Nouvelle intervention" pour commencer.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {interventions.map(interv => (
              <div 
                key={interv.id} 
                onClick={() => { setSelectedIntervention(interv); setViewMode('detail'); }}
                className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all cursor-pointer group"
              >
                <div className="flex justify-between items-start">
                   <div className="flex items-start space-x-4">
                      <div className="bg-slate-100 p-3 rounded-lg text-slate-600 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                        <Scissors size={24} />
                      </div>
                      <div>
                         <div className="flex items-center space-x-2 mb-1">
                            <h4 className="font-bold text-gray-900 text-lg">{interv.acts.join(', ')}</h4>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${interv.urgency === 'Urgente' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                              {interv.urgency}
                            </span>
                         </div>
                         <p className="text-sm text-gray-500 flex items-center">
                           <User size={14} className="mr-1"/> Chirurgien: {interv.surgeon}
                         </p>
                      </div>
                   </div>
                   <div className="text-right">
                      <div className="flex items-center text-sm font-bold text-gray-800 mb-1 justify-end">
                        <Calendar size={14} className="mr-1 text-gray-400"/>
                        {new Date(interv.date).toLocaleDateString()}
                        <Clock size={14} className="ml-3 mr-1 text-gray-400"/>
                        {interv.time}
                      </div>
                      <span className="text-xs font-medium text-gray-400">Cliquez pour voir les détails</span>
                   </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {isCreateModalOpen && renderCreateModal()}
      </div>
    );
  }

  // --- Detail View ---

  if (viewMode === 'detail' && selectedIntervention) {
    return (
      <div className="min-h-screen bg-gray-50 -m-6 p-6">
        {/* Detail Header */}
        <div className="flex items-center justify-between mb-6">
           <button onClick={() => setViewMode('list')} className="flex items-center text-gray-500 hover:text-gray-900 transition-colors">
             <ArrowLeft size={20} className="mr-1"/> Retour liste
           </button>
           <div className="flex items-center space-x-3">
              <span className="bg-white px-3 py-1 rounded-full border border-gray-200 text-sm text-gray-600 font-medium shadow-sm">
                {selectedIntervention.status}
              </span>
              <button className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg shadow-sm font-bold transition-colors">
                <Save size={18} />
                <span>Enregistrer modifications</span>
              </button>
           </div>
        </div>

        {/* Patient & Op Context Header */}
        <div className="bg-slate-900 rounded-xl p-6 text-white shadow-lg mb-6 flex flex-col md:flex-row justify-between items-start md:items-center">
           <div>
              <h2 className="text-2xl font-bold mb-1">{selectedIntervention.acts.join(', ')}</h2>
              <div className="flex items-center space-x-4 text-slate-300 text-sm">
                 <span className="flex items-center"><Calendar size={14} className="mr-1"/> {new Date(selectedIntervention.date).toLocaleDateString()}</span>
                 <span className="flex items-center"><User size={14} className="mr-1"/> Dr. {selectedIntervention.surgeon}</span>
              </div>
           </div>
           <div className="mt-4 md:mt-0 bg-slate-800 px-4 py-2 rounded-lg border border-slate-700">
              <span className="block text-xs text-slate-400 uppercase tracking-wider font-bold">Checklist HAS</span>
              <div className="flex space-x-1 mt-1">
                 <div className={`h-2 w-8 rounded-full ${selectedIntervention.checklistHAS.induction.identity ? 'bg-emerald-500' : 'bg-slate-600'}`}></div>
                 <div className={`h-2 w-8 rounded-full ${selectedIntervention.checklistHAS.incision.antibiotic ? 'bg-emerald-500' : 'bg-slate-600'}`}></div>
                 <div className={`h-2 w-8 rounded-full ${selectedIntervention.checklistHAS.exit.count ? 'bg-emerald-500' : 'bg-slate-600'}`}></div>
              </div>
           </div>
        </div>

        {/* Navigation & Content */}
        {renderTabNavigation()}
        {renderTabContent()}

      </div>
    );
  }

  return null;
};