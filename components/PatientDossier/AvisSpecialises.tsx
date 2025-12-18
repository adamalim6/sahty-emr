import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  MessageSquare, 
  Plus, 
  User, 
  Stethoscope, 
  Clock, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Save, 
  Trash2, 
  Pencil,
  ChevronRight,
  FileText,
  AlertOctagon,
  Search,
  ChevronDown,
  Building2
} from 'lucide-react';

// --- Types ---

type UrgencyLevel = 'Normal' | 'Urgent' | 'Vital';
type OpinionStatus = 'En attente' | 'Répondu' | 'Annulé';

interface Specialist {
  id: string;
  name: string;
  specialty: string;
}

interface SpecialistOpinion {
  id: string;
  requesterName: string;
  targetSpecialty: string; // La spécialité est toujours requise
  specialist?: Specialist; // Le médecin spécifique est optionnel
  reason: string;
  urgency: UrgencyLevel;
  dateRequested: string;
  status: OpinionStatus;
  response?: {
    content: string;
    dateResponded: string;
    specialistName: string;
  };
}

// --- Mock Data ---

const HOSPITAL_SPECIALISTS: Specialist[] = [
  { id: 's1', name: 'Dr. Benjelloun', specialty: 'Neurologie' },
  { id: 's2', name: 'Dr. Mansouri', specialty: 'Néphrologie' },
  { id: 's3', name: 'Dr. Tazi', specialty: 'Infectiologie' },
  { id: 's4', name: 'Dr. Idrissi', specialty: 'Pneumologie' },
  { id: 's5', name: 'Dr. Chraibi', specialty: 'Gastro-entérologie' },
  { id: 's6', name: 'Dr. Amrani', specialty: 'Neurologie' },
  { id: 's7', name: 'Dr. Benali', specialty: 'Cardiologie' },
  { id: 's8', name: 'Dr. Zahra', specialty: 'Gynécologie' },
];

const SPECIALTIES = Array.from(new Set(HOSPITAL_SPECIALISTS.map(s => s.specialty))).sort();

const MOCK_OPINIONS: SpecialistOpinion[] = [
  {
    id: '1',
    requesterName: 'Dr. S. Alami',
    targetSpecialty: 'Neurologie',
    specialist: HOSPITAL_SPECIALISTS[0],
    reason: 'Suspicion d\'AVC ischémique, demande avis sur protocole de thrombolyse.',
    urgency: 'Urgent',
    dateRequested: '2023-10-25T09:00:00',
    status: 'Répondu',
    response: {
      content: 'Examen neurologique confirme un NIHSS à 8. Pas de contre-indication au scanner. Débuter protocole standard si imagerie compatible.',
      dateResponded: '2023-10-25T09:45:00',
      specialistName: 'Dr. Benjelloun'
    }
  },
  {
    id: '2',
    requesterName: 'Dr. S. Alami',
    targetSpecialty: 'Infectiologie',
    reason: 'Fièvre persistante sous antibiothérapie probabiliste (Céphalosporines).',
    urgency: 'Normal',
    dateRequested: '2023-10-25T11:20:00',
    status: 'En attente'
  }
];

export const AvisSpecialises: React.FC = () => {
  const [opinions, setOpinions] = useState<SpecialistOpinion[]>(MOCK_OPINIONS);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isResponseModalOpen, setIsResponseModalOpen] = useState(false);
  const [selectedOpinion, setSelectedOpinion] = useState<SpecialistOpinion | null>(null);
  
  // States pour le formulaire de demande
  const [targetSpecialty, setTargetSpecialty] = useState('');
  const [searchDoctorTerm, setSearchDoctorTerm] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState<Specialist | null>(null);
  const [reason, setReason] = useState('');
  const [urgency, setUrgency] = useState<UrgencyLevel>('Normal');
  const [isDoctorListOpen, setIsDoctorListOpen] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fermer le dropdown si on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDoctorListOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filtrage intelligent des médecins
  const filteredDoctors = useMemo(() => {
    return HOSPITAL_SPECIALISTS.filter(s => {
      const matchesSpecialty = targetSpecialty ? s.specialty === targetSpecialty : true;
      const matchesName = s.name.toLowerCase().includes(searchDoctorTerm.toLowerCase());
      return matchesSpecialty && matchesName;
    });
  }, [targetSpecialty, searchDoctorTerm]);

  const handleRequestSave = () => {
    // On valide si on a au moins une spécialité (soit via le filtre, soit via le docteur sélectionné)
    const finalSpecialty = selectedDoctor ? selectedDoctor.specialty : targetSpecialty;
    if (!reason || !finalSpecialty) return;

    const newRequest: SpecialistOpinion = {
      id: Date.now().toString(),
      requesterName: 'Dr. S. Alami',
      targetSpecialty: finalSpecialty,
      specialist: selectedDoctor || undefined,
      reason,
      urgency,
      dateRequested: new Date().toISOString(),
      status: 'En attente',
    };

    setOpinions([newRequest, ...opinions]);
    closeRequestModal();
  };

  const closeRequestModal = () => {
    setIsRequestModalOpen(false);
    setTargetSpecialty('');
    setSearchDoctorTerm('');
    setSelectedDoctor(null);
    setReason('');
    setUrgency('Normal');
  };

  const [responseContent, setResponseContent] = useState('');
  const handleResponseSave = () => {
    if (!selectedOpinion || !responseContent) return;

    const updatedOpinions = opinions.map(op => {
      if (op.id === selectedOpinion.id) {
        return {
          ...op,
          status: 'Répondu' as const,
          response: {
            content: responseContent,
            dateResponded: new Date().toISOString(),
            specialistName: op.specialist?.name || `Spécialiste (${op.targetSpecialty})`
          }
        };
      }
      return op;
    });

    setOpinions(updatedOpinions);
    setIsResponseModalOpen(false);
    setResponseContent('');
    setSelectedOpinion(null);
  };

  const getUrgencyStyles = (level: UrgencyLevel) => {
    switch (level) {
      case 'Vital': return 'bg-red-600 text-white animate-pulse shadow-red-200';
      case 'Urgent': return 'bg-orange-500 text-white';
      default: return 'bg-blue-500 text-white';
    }
  };

  const sortedOpinions = useMemo(() => {
    return [...opinions].sort((a, b) => new Date(b.dateRequested).getTime() - new Date(a.dateRequested).getTime());
  }, [opinions]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <MessageSquare className="mr-2 text-indigo-600" />
            Avis Spécialisés
          </h3>
          <p className="text-sm text-gray-500">Demandes de consultations et réponses inter-services.</p>
        </div>
        <button 
          onClick={() => setIsRequestModalOpen(true)}
          className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm font-medium"
        >
          <Plus size={18} />
          <span>Demander un avis</span>
        </button>
      </div>

      {sortedOpinions.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
          <MessageSquare className="mx-auto h-12 w-12 text-gray-300 mb-3" />
          <p className="text-gray-500">Aucune demande d'avis pour ce patient.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedOpinions.map(op => (
            <div key={op.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:border-indigo-200 transition-all">
              <div className="px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 bg-gray-50/50">
                <div className="flex items-center space-x-4">
                  <div className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest shadow-sm ${getUrgencyStyles(op.urgency)}`}>
                    {op.urgency}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 flex items-center">
                      {op.specialist ? (
                        <>
                          <User size={16} className="mr-2 text-indigo-600" />
                          {op.specialist.name}
                        </>
                      ) : (
                        <>
                          <Building2 size={16} className="mr-2 text-indigo-600" />
                          Service {op.targetSpecialty}
                        </>
                      )}
                      <span className="ml-2 text-xs font-medium text-gray-400">({op.targetSpecialty})</span>
                    </h4>
                    <div className="text-[10px] text-gray-400 flex items-center mt-0.5">
                      <Clock size={12} className="mr-1" />
                      Demandé le {new Date(op.dateRequested).toLocaleString('fr-FR')} par {op.requesterName}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                   <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                     op.status === 'Répondu' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                     op.status === 'En attente' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-gray-100 text-gray-500'
                   }`}>
                     {op.status === 'Répondu' ? <CheckCircle2 size={12} className="mr-1.5" /> : <Clock size={12} className="mr-1.5" />}
                     {op.status}
                   </span>
                   {op.status === 'En attente' && (
                     <button 
                        onClick={() => { setSelectedOpinion(op); setIsResponseModalOpen(true); }}
                        className="text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1 rounded-lg font-bold transition-colors border border-indigo-200"
                      >
                       Répondre
                     </button>
                   )}
                </div>
              </div>

              <div className="p-5">
                <div className="mb-4">
                  <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Motif de la demande</span>
                  <p className="text-sm text-gray-800 leading-relaxed italic border-l-2 border-indigo-200 pl-4 py-1">
                    "{op.reason}"
                  </p>
                </div>

                {op.response && (
                  <div className="mt-5 pt-5 border-t border-gray-100 bg-emerald-50/20 -mx-5 -mb-5 p-5">
                    <div className="flex justify-between items-start mb-2">
                       <span className="text-[10px] font-bold text-emerald-600 uppercase flex items-center">
                         <FileText size={12} className="mr-1.5" /> Réponse du spécialiste
                       </span>
                       <span className="text-[10px] text-emerald-600/60 font-medium">
                         Le {new Date(op.response.dateResponded).toLocaleString('fr-FR')}
                       </span>
                    </div>
                    <p className="text-sm text-gray-900 font-medium leading-relaxed">
                      {op.response.content}
                    </p>
                    <div className="mt-3 text-[10px] font-bold text-emerald-700">
                      Signé : {op.response.specialistName}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- Request Modal --- */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-indigo-600 text-white">
              <h3 className="text-lg font-bold flex items-center">
                <Send size={18} className="mr-2"/> Demander un avis spécialisé
              </h3>
              <button onClick={closeRequestModal} className="hover:text-white/80"><X size={20}/></button>
            </div>
            
            <div className="p-6 space-y-5">
              {/* Filtre Spécialité */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">1. Spécialité ciblée *</label>
                <select 
                  value={targetSpecialty}
                  onChange={(e) => {
                    setTargetSpecialty(e.target.value);
                    setSelectedDoctor(null); // Reset doctor when specialty changes
                    setSearchDoctorTerm('');
                  }}
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2 text-sm bg-white"
                >
                  <option value="">Toutes les spécialités...</option>
                  {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Recherche Médecin */}
              <div className="relative" ref={dropdownRef}>
                <label className="block text-sm font-bold text-gray-700 mb-1">2. Médecin spécifique (Optionnel)</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder={selectedDoctor ? `${selectedDoctor.name} (${selectedDoctor.specialty})` : "Commencez à taper un nom..."}
                    value={searchDoctorTerm}
                    onFocus={() => setIsDoctorListOpen(true)}
                    onChange={(e) => {
                      setSearchDoctorTerm(e.target.value);
                      setIsDoctorListOpen(true);
                      if (selectedDoctor) setSelectedDoctor(null);
                    }}
                    className={`block w-full pl-10 pr-10 py-2 border rounded-lg text-sm transition-all ${
                      selectedDoctor ? 'bg-indigo-50 border-indigo-300 font-bold text-indigo-900' : 'bg-white border-gray-300'
                    }`}
                  />
                  {selectedDoctor && (
                    <button 
                      onClick={() => setSelectedDoctor(null)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-indigo-600"
                    >
                      <X size={16} />
                    </button>
                  )}
                  {!selectedDoctor && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <ChevronDown size={16} className="text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Dropdown Suggestions */}
                {isDoctorListOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {filteredDoctors.length > 0 ? (
                      <>
                        <div className="px-3 py-2 text-[10px] font-bold text-gray-400 bg-gray-50 uppercase border-b border-gray-100">
                          Médecins trouvés ({filteredDoctors.length})
                        </div>
                        {filteredDoctors.map(doc => (
                          <button
                            key={doc.id}
                            onClick={() => {
                              setSelectedDoctor(doc);
                              setTargetSpecialty(doc.specialty);
                              setSearchDoctorTerm('');
                              setIsDoctorListOpen(false);
                            }}
                            className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 transition-colors flex items-center justify-between group"
                          >
                            <div>
                               <div className="text-sm font-bold text-gray-800 group-hover:text-indigo-700">{doc.name}</div>
                               <div className="text-xs text-gray-500">{doc.specialty}</div>
                            </div>
                            <ChevronRight size={14} className="text-gray-300 opacity-0 group-hover:opacity-100 transform group-hover:translate-x-1 transition-all" />
                          </button>
                        ))}
                      </>
                    ) : (
                      <div className="px-4 py-6 text-center text-gray-400 text-sm">
                        Aucun médecin correspondant
                      </div>
                    )}
                  </div>
                )}
                {targetSpecialty && !selectedDoctor && (
                  <p className="mt-1.5 text-[10px] text-indigo-600 font-bold flex items-center">
                    <AlertCircle size={10} className="mr-1" /> 
                    La demande sera adressée à l'ensemble du service {targetSpecialty.toUpperCase()}.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Urgence</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Normal', 'Urgent', 'Vital'] as UrgencyLevel[]).map(level => (
                    <button
                      key={level}
                      onClick={() => setUrgency(level)}
                      className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                        urgency === level 
                          ? (level === 'Vital' ? 'bg-red-600 border-red-600 text-white' : 'bg-indigo-600 border-indigo-600 text-white')
                          : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Motif & Question clinique *</label>
                <textarea 
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm" 
                  rows={4} 
                  placeholder="Décrivez le cas clinique et la question spécifique..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
              <button onClick={closeRequestModal} className="px-5 py-2.5 text-gray-700 hover:bg-gray-200 rounded-lg text-sm font-bold transition-colors">Annuler</button>
              <button 
                onClick={handleRequestSave} 
                disabled={!reason || (!targetSpecialty && !selectedDoctor)}
                className="px-5 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-sm font-bold shadow-lg transition-colors flex items-center disabled:opacity-50"
              >
                <Send size={18} className="mr-2"/> Envoyer la demande
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Response Modal --- */}
      {isResponseModalOpen && selectedOpinion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-emerald-600 text-white">
              <h3 className="text-lg font-bold flex items-center">
                <CheckCircle2 size={18} className="mr-2"/> Réponse à la demande d'avis
              </h3>
              <button onClick={() => setIsResponseModalOpen(false)} className="hover:text-white/80"><X size={20}/></button>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Rappel de la demande</span>
                <p className="text-xs text-gray-600 italic">"{selectedOpinion.reason}"</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Votre réponse & Conclusions *</label>
                <textarea 
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 text-sm" 
                  rows={8} 
                  placeholder="Saisissez vos constatations, conclusions et recommandations thérapeutiques..."
                  value={responseContent}
                  onChange={(e) => setResponseContent(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
              <button onClick={() => setIsResponseModalOpen(false)} className="px-5 py-2.5 text-gray-700 hover:bg-gray-200 rounded-lg text-sm font-bold transition-colors">Annuler</button>
              <button 
                onClick={handleResponseSave} 
                disabled={!responseContent}
                className="px-5 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-sm font-bold shadow-lg transition-colors flex items-center disabled:opacity-50"
              >
                <Save size={18} className="mr-2"/> Valider l'avis
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};