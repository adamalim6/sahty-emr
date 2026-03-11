import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  ShieldAlert, 
  AlertTriangle, 
  Info, 
  X, 
  Save, 
  AlertOctagon,
  Trash2,
  Pencil,
  History,
  Search,
  Loader2,
  Calendar
} from 'lucide-react';
import { api } from '../../services/api';

// --- Types ---

type Severity = 'Légère' | 'Modérée' | 'Sévère' | 'Choc Anaphylactique';
type AllergyType = 'Médicamenteuse' | 'Alimentaire' | 'Environnementale' | 'Contact' | 'Autre';
type Status = 'ACTIVE' | 'RESOLVED' | 'ENTERED_IN_ERROR';

interface PatientAllergyHistory {
  id: string;
  event_type: 'CREATED' | 'DETAILS_UPDATED' | 'STATUS_CHANGED';
  changed_field: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  created_by_first_name?: string;
  created_by_last_name?: string;
}

interface AllergyRecord {
  id: string;
  allergen_dci_id: string;
  allergen_name_snapshot: string;
  allergy_type: AllergyType;
  severity: Severity;
  reaction_description: string;
  declared_at: string;
  status: Status;
  manifestations: string[];
  created_at: string;
}

const INITIAL_FORM: Partial<AllergyRecord> = {
  allergen_dci_id: '',
  allergen_name_snapshot: '',
  allergy_type: 'Médicamenteuse',
  severity: 'Modérée',
  reaction_description: '',
  declared_at: new Date().toISOString().split('T')[0],
  status: 'ACTIVE',
  manifestations: []
};

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

const formatDate = (dateString?: string) => {
    if (!dateString) return 'Date inconnue';
    return new Date(dateString).toLocaleDateString();
};

const formatDateTime = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
};

// --- Constants for Styles ---
const inputClassName = "block w-full rounded-lg border border-gray-300 shadow-sm focus:border-rose-500 focus:ring-rose-500 px-4 py-3 text-sm text-gray-900 bg-white hover:border-gray-400 transition-colors placeholder-gray-400";
const labelClassName = "block text-sm font-bold text-gray-700 mb-2";

const CustomDatePicker = ({ value, onChange, maxDate }: { value: string, onChange: (date: string) => void, maxDate: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(value ? new Date(value) : new Date());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false);
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Sync current month if value changes externally
  useEffect(() => {
    if (value) setCurrentMonth(new Date(value));
  }, [value]);

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1; // Mon=0, ..., Sun=6

  const handleYearChange = (e: any) => {
      const newD = new Date(currentMonth);
      newD.setFullYear(parseInt(e.target.value));
      setCurrentMonth(newD);
  }
  const handleMonthChange = (e: any) => {
      const newD = new Date(currentMonth);
      newD.setMonth(parseInt(e.target.value));
      setCurrentMonth(newD);
  }

  const handleDaySelect = (day: number) => {
      const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day, 12, 0, 0);
      const dateString = d.toISOString().split('T')[0];
      if (maxDate && dateString > maxDate) return;
      onChange(dateString);
      setIsOpen(false);
  }

  // Generate 100 years back
  const years = Array.from({length: 120}, (_, i) => new Date().getFullYear() - i);
  const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

  const displayDate = value ? new Date(value).toLocaleDateString('fr-FR') : 'Sélectionner une date';

  return (
    <div className="relative" ref={ref}>
       <button type="button" onClick={() => setIsOpen(!isOpen)} className={`${inputClassName} flex w-full justify-between items-center text-left ${!value ? 'text-gray-400' : 'text-gray-900'} hover:border-rose-400 focus:border-rose-500 focus:ring-rose-500 focus:ring-1`}>
         <span>{displayDate}</span>
         <Calendar size={16} className={`transition-colors ${isOpen ? 'text-rose-500' : 'text-gray-400'}`}/>
       </button>
       {isOpen && (
         <div className="absolute z-50 mt-2 bg-white border border-gray-200 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] p-4 w-72 origin-top-left animate-in fade-in zoom-in-95 duration-200">
             <div className="flex gap-2 mb-4">
                 <select value={currentMonth.getMonth()} onChange={handleMonthChange} className="block w-3/5 rounded-lg border-gray-300 shadow-sm focus:border-rose-500 focus:ring-rose-500 transition-colors py-1.5 text-sm font-semibold bg-gray-50 text-gray-700">
                     {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                 </select>
                 <select value={currentMonth.getFullYear()} onChange={handleYearChange} className="block w-2/5 rounded-lg border-gray-300 shadow-sm focus:border-rose-500 focus:ring-rose-500 transition-colors py-1.5 text-sm font-semibold bg-gray-50 text-gray-700">
                     {years.map(y => <option key={y} value={y}>{y}</option>)}
                 </select>
             </div>
             <div className="grid grid-cols-7 gap-1 text-center mb-2">
                 {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => <div key={d} className="text-[11px] font-extrabold text-gray-400">{d}</div>)}
             </div>
             <div className="grid grid-cols-7 gap-1 text-center">
                 {Array.from({length: startOffset}).map((_, i) => <div key={`empty-${i}`}/>)}
                 {Array.from({length: daysInMonth}).map((_, i) => {
                     const day = i + 1;
                     const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day, 12, 0, 0);
                     const dateStr = d.toISOString().split('T')[0];
                     const isFuture = maxDate && dateStr > maxDate;
                     const isSelected = value === dateStr;
                     return (
                         <button 
                             key={day} 
                             type="button"
                             disabled={isFuture}
                             onClick={() => handleDaySelect(day)}
                             className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-1 mx-auto ${isSelected ? 'bg-rose-600 text-white font-bold shadow-md scale-110' : isFuture ? 'text-gray-300 cursor-not-allowed opacity-50' : 'text-gray-700 hover:bg-rose-100 font-medium'}`}
                         >
                             {day}
                         </button>
                     );
                 })}
             </div>
         </div>
       )}
    </div>
  );
}

export const Allergies: React.FC<{ patientId: string }> = ({ patientId }) => {
  const [allergies, setAllergies] = useState<AllergyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'active' | 'all'>('active');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<AllergyRecord>>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);

  // History state
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<PatientAllergyHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // DCI Search state
  const [dciSearch, setDciSearch] = useState('');
  const [dciResults, setDciResults] = useState<any[]>([]);
  const [searchingDci, setSearchingDci] = useState(false);
  const [showDciDropdown, setShowDciDropdown] = useState(false);
  const dciTimeoutRef = useRef<NodeJS.Timeout>();

  const loadAllergies = async () => {
    try {
      setLoading(true);
      const data = await api.getPatientAllergies(patientId, filter);
      setAllergies(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllergies();
  }, [patientId, filter]);

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

  const handleDciSearch = (query: string) => {
    setDciSearch(query);
    setShowDciDropdown(true);
    
    if (dciTimeoutRef.current) clearTimeout(dciTimeoutRef.current);
    
    if (query.trim().length < 2) {
      setDciResults([]);
      return;
    }
    
    dciTimeoutRef.current = setTimeout(async () => {
      setSearchingDci(true);
      try {
        const res = await api.getReferenceDCIs(query);
        setDciResults(res.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setSearchingDci(false);
      }
    }, 300);
  };

  const selectDci = (dci: any) => {
    setFormData(prev => ({
      ...prev,
      allergen_dci_id: dci.id,
      allergen_name_snapshot: dci.name
    }));
    setDciSearch(dci.name);
    setShowDciDropdown(false);
  };

  const handleSave = async () => {
    if (!formData.allergen_dci_id) {
        alert("Veuillez sélectionner un allergène depuis la liste.");
        return;
    }
    
    setSaving(true);
    try {
      if (formData.id) {
        // Edit existing details
        await api.updateAllergyDetails(formData.id, {
            severity: formData.severity,
            reaction_description: formData.reaction_description,
            declared_at: formData.declared_at,
            manifestations: formData.manifestations
        });
        
        // Check if status changed
        const originalAllergy = allergies.find(a => a.id === formData.id);
        if (originalAllergy && originalAllergy.status !== formData.status) {
             await api.changeAllergyStatus(formData.id, formData.status as any);
        }
      } else {
        // Create new
        await api.createAllergy(patientId, {
            allergen_dci_id: formData.allergen_dci_id,
            allergy_type: formData.allergy_type,
            severity: formData.severity,
            reaction_description: formData.reaction_description,
            declared_at: formData.declared_at,
            status: formData.status,
            manifestations: formData.manifestations
        });
      }
      
      await loadAllergies();
      setIsModalOpen(false);
      setFormData(INITIAL_FORM);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (allergy: AllergyRecord) => {
    setFormData({
        ...allergy,
        reaction_description: allergy.reaction_description || '',
        declared_at: allergy.declared_at ? allergy.declared_at.split('T')[0] : ''
    });
    setDciSearch(allergy.allergen_name_snapshot);
    setIsModalOpen(true);
  };

  const handleCreateNew = () => {
    setFormData(INITIAL_FORM);
    setDciSearch('');
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if(window.confirm('Êtes-vous sûr de vouloir supprimer cette allergie ? Elle sera marquée comme Erreur de Saisie.')) {
      try {
          await api.changeAllergyStatus(id, 'ENTERED_IN_ERROR');
          await loadAllergies();
      } catch (err: any) {
          alert('Erreur: ' + err.message);
      }
    }
  };

  const toggleHistory = async (id: string) => {
      if (expandedHistoryId === id) {
          setExpandedHistoryId(null);
          return;
      }
      setExpandedHistoryId(id);
      setLoadingHistory(true);
      try {
          const hist = await api.getAllergyHistory(id);
          setHistoryData(hist);
      } catch (err) {
          console.error(err);
      } finally {
          setLoadingHistory(false);
      }
  };

  if (loading) {
      return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-rose-500 w-8 h-8"/></div>;
  }

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
        
        <div className="flex items-center space-x-4">
            <div className="bg-gray-100 p-1 rounded-lg flex inline-flex text-sm font-medium">
                <button 
                  onClick={() => setFilter('active')}
                  className={`px-4 py-1.5 rounded-md transition-all ${filter === 'active' ? 'bg-white shadow-sm text-gray-900 border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Allergies actives
                </button>
                <button 
                  onClick={() => setFilter('all')}
                  className={`px-4 py-1.5 rounded-md transition-all ${filter === 'all' ? 'bg-white shadow-sm text-gray-900 border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Toutes les allergies
                </button>
            </div>
            
            <button 
              onClick={handleCreateNew}
              className="flex items-center space-x-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm font-medium"
            >
              <Plus size={18} />
              <span>Ajouter une allergie</span>
            </button>
        </div>
      </div>

      {allergies.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
          <div className="mx-auto h-16 w-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
            <ShieldAlert className="h-8 w-8 text-gray-300" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">Aucune allergie connue</h3>
          <p className="mt-1 text-gray-500">Le patient n'a pas d'allergies {filter === 'active' ? 'actives ' : ''}déclarées pour le moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {allergies.map(allergy => {
              const isResolved = allergy.status === 'RESOLVED';
              return (
              <div key={allergy.id} className={`bg-white rounded-xl border-l-4 shadow-sm p-4 hover:shadow-md transition-all ${isResolved ? 'border-l-gray-300 opacity-80' : (allergy.severity?.includes('Choc') || allergy.severity === 'Sévère' ? 'border-l-red-500' : 'border-l-yellow-500')} border-y border-r border-gray-200`}>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center">
                     <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold mr-2 ${isResolved ? 'bg-gray-100 text-gray-500' : getSeverityStyle(allergy.severity)}`}>
                       {allergy.severity === 'Choc Anaphylactique' && <AlertOctagon size={12} className="mr-1"/>}
                       {allergy.severity}
                     </span>
                     <span className="text-xs text-gray-500 font-medium px-2 py-0.5 bg-gray-100 rounded border border-gray-200 flex items-center">
                       {getTypeIcon(allergy.allergy_type)}
                       {allergy.allergy_type}
                     </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${allergy.status === 'ACTIVE' ? 'bg-rose-50 text-rose-700' : 'bg-green-50 text-green-700'}`}>
                      {allergy.status}
                    </span>
                    
                    {/* Actions */}
                    <div className="flex items-center border-l border-gray-200 pl-2 ml-2 space-x-1">
                      <button 
                        onClick={() => toggleHistory(allergy.id)} 
                        className={`p-1.5 rounded-lg transition-colors ${expandedHistoryId === allergy.id ? 'bg-blue-100 text-blue-700' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`}
                        title="Historique"
                      >
                        <History size={16}/>
                      </button>
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
                        title="Marquer comme erreur"
                      >
                        <Trash2 size={16}/>
                      </button>
                    </div>
                  </div>
                </div>
                
                <h4 className={`text-xl font-bold mb-1 ${isResolved ? 'text-gray-500 line-through decoration-gray-300' : 'text-gray-900'}`}>{allergy.allergen_name_snapshot}</h4>
                
                <div className={`rounded-lg p-3 text-sm mb-3 border ${isResolved ? 'bg-gray-50 border-gray-100 text-gray-500' : 'bg-rose-50/30 border-rose-100/50 text-gray-700'}`}>
                  <span className="font-semibold text-gray-500 text-xs uppercase block mb-1">Réaction & Manifestations</span>
                  {allergy.reaction_description || 'Aucune description fournie.'}
                  {allergy.manifestations && allergy.manifestations.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {allergy.manifestations.map(m => (
                        <span key={m} className={`px-1.5 py-0.5 border rounded text-xs ${isResolved ? 'bg-white border-gray-200 text-gray-400' : 'bg-white border-rose-100/60 text-rose-700'}`}>{m}</span>
                      ))}
                    </div>
                  )}
                </div>
  
                <div className="flex justify-between items-center text-xs text-gray-400">
                  <div className="flex items-center">
                      <Info size={12} className="mr-1"/> Déclarée le {formatDate(allergy.declared_at)}
                  </div>
                  <div>Créée le {formatDate(allergy.created_at)}</div>
                </div>

                {/* History Expanded View */}
                {expandedHistoryId === allergy.id && (
                    <div className="mt-4 pt-3 border-t border-gray-100 animate-in slide-in-from-top-2 duration-300">
                        <h5 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center">
                            <History size={12} className="mr-1"/> Évolution de l'allergie
                        </h5>
                        
                        {loadingHistory ? (
                            <div className="flex justify-center p-4"><Loader2 className="animate-spin text-blue-500 w-5 h-5"/></div>
                        ) : (
                            <div className="space-y-3 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                                {historyData.map((ev, idx) => (
                                    <div key={ev.id} className="relative flex items-start justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                        <div className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-white bg-slate-200 text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                                            {ev.event_type === 'CREATED' && <Plus size={10} className="text-emerald-600"/>}
                                            {ev.event_type === 'DETAILS_UPDATED' && <Pencil size={10}/>}
                                            {ev.event_type === 'STATUS_CHANGED' && <Info size={10} className="text-blue-600"/>}
                                        </div>
                                        <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] bg-white border border-slate-200 p-2.5 rounded-lg shadow-sm">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-bold text-slate-800 text-xs">
                                                    {ev.event_type === 'CREATED' ? 'Allergie Créée' : (ev.event_type === 'STATUS_CHANGED' ? 'Statut Modifié' : 'Détails Mis à jour')}
                                                </span>
                                                <span className="text-[10px] text-slate-500 font-medium">{formatDateTime(ev.created_at)}</span>
                                            </div>
                                            
                                            {ev.changed_field && (
                                                <div className="text-[11px] text-slate-600 mt-1.5 flex items-center gap-1.5 bg-slate-50 p-1.5 rounded border border-slate-100">
                                                    <span className="font-medium text-slate-700 capitalize">{ev.changed_field}:</span>
                                                    <span className="line-through text-slate-400">{ev.old_value || '-'}</span>
                                                    <span className="text-slate-400">→</span>
                                                    <span className="font-bold text-emerald-600">{ev.new_value || '-'}</span>
                                                </div>
                                            )}
                                            
                                            <div className="text-[10px] text-slate-400 mt-2 text-right">
                                                Par {ev.created_by_first_name || 'Système'} {ev.created_by_last_name || ''}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {historyData.length === 0 && <div className="text-xs text-gray-500 italic pl-8">Aucun historique disponible.</div>}
                            </div>
                        )}
                    </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      
      {/* Spacer for scroll */}
      <div className="h-16"></div>

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
              <div className="relative">
                <label className={labelClassName}>Allergène / Molécule (DCI) *</label>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input 
                      type="text" 
                      value={dciSearch} 
                      onChange={(e) => handleDciSearch(e.target.value)} 
                      className={`${inputClassName} pl-10 ${formData.id ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                      placeholder="Ex: Amoxicilline, Arachide... (Min 2 caractères)"
                      autoFocus={!formData.id}
                      disabled={!!formData.id} // Immutable DCI after creation
                    />
                    {searchingDci && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-500 animate-spin" size={16} />}
                </div>
                
                {/* DCI Dropdown */}
                {showDciDropdown && dciResults.length > 0 && !formData.id && (
                    <div className="absolute z-10 w-full mt-1 max-h-48 overflow-auto bg-white border border-gray-200 rounded-lg shadow-xl divide-y divide-gray-100">
                        {dciResults.map(dci => (
                            <button
                                key={dci.id}
                                onClick={() => selectDci(dci)}
                                className="w-full text-left px-4 py-2 hover:bg-rose-50 focus:bg-rose-50 focus:outline-none"
                            >
                                <div className="font-bold text-sm text-gray-900">{dci.name}</div>
                                {dci.atc_code && <div className="text-xs text-gray-500 font-mono">ATC: {dci.atc_code}</div>}
                            </button>
                        ))}
                    </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className={labelClassName}>Type</label>
                  <select name="allergy_type" value={formData.allergy_type} onChange={handleInputChange} className={inputClassName}>
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
                 <label className={labelClassName}>Manifestations Cliniques</label>
                 <div className="flex flex-wrap gap-2 p-4 bg-gray-50 rounded-lg border border-gray-100">
                   {['CUTANEE', 'RESPIRATOIRE', 'DIGESTIVE', 'CARDIOVASCULAIRE', 'NEUROLOGIQUE'].map(m => (
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
                  name="reaction_description" 
                  value={formData.reaction_description || ''} 
                  onChange={handleInputChange} 
                  rows={2} 
                  className={inputClassName}
                  placeholder="Ex: Urticaire géant, gêne respiratoire, œdème..."
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                 <div>
                     <label className={labelClassName}>Première apparition le:</label>
                    <CustomDatePicker 
                        value={formData.declared_at || ''} 
                        onChange={(d) => setFormData(prev => ({ ...prev, declared_at: d }))} 
                        maxDate={new Date().toISOString().split('T')[0]} 
                    />
                 </div>
                 <div>
                    <label className={labelClassName}>Statut</label>
                    <select name="status" value={formData.status} onChange={handleInputChange} className={inputClassName}>
                      <option value="ACTIVE">Active</option>
                      <option value="RESOLVED">Résolue</option>
                      <option value="ENTERED_IN_ERROR" disabled>Erreur (Suppression)</option>
                    </select>
                 </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
               <button onClick={() => setIsModalOpen(false)} disabled={saving} className="px-5 py-2.5 text-gray-700 hover:bg-gray-200 rounded-lg text-sm font-bold transition-colors disabled:opacity-50">Annuler</button>
               <button onClick={handleSave} disabled={!formData.allergen_dci_id || saving} className="px-5 py-2.5 bg-rose-600 text-white hover:bg-rose-700 rounded-lg text-sm font-bold shadow-lg transition-colors flex items-center disabled:opacity-50 disabled:shadow-none">
                 {saving ? <Loader2 size={18} className="mr-2 animate-spin"/> : <Save size={18} className="mr-2"/>} {saving ? 'Enregistrement...' : 'Enregistrer'}
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};