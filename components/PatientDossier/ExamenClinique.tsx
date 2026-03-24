import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, X, Save, Activity, Heart, Ruler, Scale, Wind, 
  Check, TriangleAlert, Thermometer, Weight, Gauge, 
  Calculator, Scan, Stethoscope, Edit, Trash2, Clock, User,
  Brain, Focus, Eye
} from 'lucide-react';
import { Patient } from '../../types';
import { calculateAge } from '../../constants';
import { api } from '../../services/api';

// --- Types & Interfaces ---

interface ClinicalExam {
  id: string; // The clinical_exams header ID
  observedAt: string;
  status: 'active' | 'entered_in_error';
  // Audit 
  recordedByFirstName: string | null;
  recordedByLastName: string | null;
  lastAmendedAt: string | null;
  // Payload (Measurements map)
  measurements: Record<string, any>;
}

// Form state specifically for the modal
interface ClinicalExamFormData {
  date: string; // Used for mapped observed_at
  // A. Paramètres Généraux
  temperature: string;
  weight: string;
  height: string;
  bmi: string; // Computed locally
  bsa: string; // Computed locally
  pulse: string;
  sao2: string;
  sysBP: string; 
  diaBP: string; 
  // B. Neuro Rapide
  glasgow: string;
  ramsay: string;
  eva: string;
  pupilles: string;
  agitation: boolean;
  confusion: boolean;
  // C. Respiratoire Rapide
  fr: string;
  encombrement: boolean;
  toux: boolean;
  dyspnee: boolean;
  cyanose: boolean;
  // D. Cardio / Periphérique Rapide
  marbrures: boolean;
  extremitesFroides: boolean;
  trcAllonge: boolean;
  oedemes: boolean;
  // E. Digestif / Elimination Rapide
  vomissements: boolean;
  diarrhee: boolean;
  constipation: boolean;
  ballonnement: boolean;
  douleurAbdominale: boolean;
  // F. Cutané / Etat Général Rapide
  paleur: boolean;
  ictere: boolean;
  sueurs: boolean;
  deshydratation: boolean;
  asthenie: boolean;
}

const INITIAL_FORM_STATE: ClinicalExamFormData = {
  date: '',
  temperature: '', weight: '', height: '', bmi: '', bsa: '', pulse: '', sao2: '', sysBP: '', diaBP: '',
  glasgow: '', ramsay: '', eva: '', pupilles: '', agitation: false, confusion: false,
  fr: '', encombrement: false, toux: false, dyspnee: false, cyanose: false,
  marbrures: false, extremitesFroides: false, trcAllonge: false, oedemes: false,
  vomissements: false, diarrhee: false, constipation: false, ballonnement: false, douleurAbdominale: false,
  paleur: false, ictere: false, sueurs: false, deshydratation: false, asthenie: false,
};

// --- Configuration for Smart Inputs ---

interface ParamConfig {
  min: number; max: number; safeMin: number; safeMax: number; step: number; label: string; unit: string;
}

const getParamConfig = (age: number): Record<string, ParamConfig> => {
  let config: Record<string, ParamConfig> = {
      temperature: { min: 34, max: 43, safeMin: 36.1, safeMax: 37.8, step: 0.1, label: "Température", unit: "°C" },
      weight: { min: 30, max: 200, safeMin: 45, safeMax: 120, step: 0.5, label: "Poids", unit: "kg" },
      height: { min: 100, max: 230, safeMin: 150, safeMax: 200, step: 1, label: "Taille", unit: "cm" },
      pulse: { min: 30, max: 200, safeMin: 50, safeMax: 100, step: 1, label: "Pouls", unit: "bpm" },
      sao2: { min: 70, max: 100, safeMin: 90, safeMax: 100, step: 1, label: "SaO₂", unit: "%" },
      sysBP: { min: 70, max: 220, safeMin: 90, safeMax: 140, step: 1, label: "TA Max (Sys)", unit: "mmHg" },
      diaBP: { min: 30, max: 130, safeMin: 60, safeMax: 90, step: 1, label: "TA Min (Dia)", unit: "mmHg" },
      fr: { min: 6, max: 60, safeMin: 12, safeMax: 20, step: 1, label: "Fréq. Resp (FR)", unit: "/min" },
  };

  if (age <= 2) {
    config.weight = { min: 2, max: 20, safeMin: 3, safeMax: 15, step: 0.1, label: "Poids", unit: "kg" };
    config.height = { min: 40, max: 100, safeMin: 45, safeMax: 90, step: 0.5, label: "Taille", unit: "cm" };
    config.pulse = { min: 60, max: 200, safeMin: 80, safeMax: 160, step: 1, label: "Pouls", unit: "bpm" };
    config.sysBP = { min: 50, max: 120, safeMin: 70, safeMax: 100, step: 1, label: "TA Max (Sys)", unit: "mmHg" };
    config.diaBP = { min: 30, max: 80, safeMin: 40, safeMax: 60, step: 1, label: "TA Min (Dia)", unit: "mmHg" };
    config.fr = { min: 20, max: 80, safeMin: 30, safeMax: 50, step: 1, label: "Fréq. Resp (FR)", unit: "/min" };
  } else if (age <= 12) {
    config.weight = { min: 10, max: 80, safeMin: 15, safeMax: 60, step: 0.5, label: "Poids", unit: "kg" };
    config.height = { min: 80, max: 160, safeMin: 90, safeMax: 150, step: 1, label: "Taille", unit: "cm" };
    config.pulse = { min: 50, max: 160, safeMin: 70, safeMax: 120, step: 1, label: "Pouls", unit: "bpm" };
    config.sysBP = { min: 70, max: 140, safeMin: 80, safeMax: 120, step: 1, label: "TA Max (Sys)", unit: "mmHg" };
    config.diaBP = { min: 40, max: 90, safeMin: 50, safeMax: 80, step: 1, label: "TA Min (Dia)", unit: "mmHg" };
    config.fr = { min: 15, max: 60, safeMin: 20, safeMax: 30, step: 1, label: "Fréq. Resp (FR)", unit: "/min" };
  }

  return config;
};

// Computations
const computeDerived = (weightPayload: any, heightPayload: any) => {
    const w = parseFloat(weightPayload);
    const h = parseFloat(heightPayload);
    let bmi = '--', bsa = '--';
    if (!isNaN(w) && !isNaN(h) && h > 0) {
      const hM = h / 100;
      bmi = (w / (hM * hM)).toFixed(2);
      bsa = (0.007184 * Math.pow(w, 0.425) * Math.pow(h, 0.725)).toFixed(2);
    }
    return { bmi, bsa };
};

// --- Sub Components ---

const SmartParamInput = ({ 
  config, name, value, onChange 
}: { 
  config: ParamConfig, name: string, value: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void 
}) => {
  const numVal = parseFloat(value);
  const isWarning = !isNaN(numVal) && value !== '' && (numVal < config.safeMin || numVal > config.safeMax);
  const sliderValue = isNaN(numVal) ? config.min : numVal;

  return (
    <div className={`p-4 rounded-xl border transition-all duration-300 ${isWarning ? 'bg-red-50 border-red-200 shadow-sm' : 'bg-white border-gray-200'}`}>
      <div className="flex justify-between items-center mb-3">
        <label className={`block text-sm font-semibold ${isWarning ? 'text-red-800' : 'text-gray-700'}`}>
          {config.label}
        </label>
        {isWarning && (
          <span className="flex items-center text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full animate-pulse">
            <TriangleAlert size={12} className="mr-1" />
            Hors normes
          </span>
        )}
      </div>
      
      <div className="flex items-center space-x-4">
        <div className="flex-1 relative">
           <input 
              type="range" 
              name={name}
              min={config.min} 
              max={config.max} 
              step={config.step} 
              value={sliderValue} 
              onChange={onChange}
              className={`w-full h-2 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 ${isWarning ? 'accent-red-500 bg-red-200' : 'accent-emerald-600 bg-gray-200'}`} 
            />
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-gray-400 font-mono">{config.min}</span>
              <span className="text-[10px] text-gray-400 font-mono">{config.max}</span>
            </div>
        </div>
        <div className="relative w-28 shrink-0">
          <input 
            type="number" 
            name={name}
            value={value} 
            onChange={onChange}
            step={config.step}
            className={`block w-full text-right font-bold rounded-lg shadow-sm sm:text-sm p-2 pr-14 border focus:ring-2 focus:ring-offset-0 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
              isWarning 
              ? 'text-red-700 border-red-300 focus:border-red-500 focus:ring-red-200 bg-white' 
              : 'text-gray-900 border-gray-300 focus:border-emerald-500 focus:ring-emerald-200 bg-white'
            }`}
          />
          <span className={`absolute right-8 top-2 text-xs text-gray-400 pointer-events-none ${value ? 'opacity-0' : 'opacity-100'}`}>
            --
          </span>
          <span className="absolute right-2 top-2.5 text-xs text-gray-500 pointer-events-none">
            {config.unit}
          </span>
        </div>
      </div>
    </div>
  );
};

const SimpleInput = ({ label, name, value, onChange, type = "text", unit = "" }: any) => (
  <div className="p-4 rounded-xl border border-gray-200 bg-white relative">
    <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
    <div className="relative">
      <input 
        type={type} 
        name={name} 
        value={value} 
        onChange={onChange}
        className="block w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 bg-gray-50"
      />
      {unit && <span className="absolute right-3 top-2 text-gray-400 text-sm pointer-events-none">{unit}</span>}
    </div>
  </div>
);

const CheckboxTile = ({ label, name, checked, onChange }: any) => (
  <label className={`flex items-start p-4 rounded-xl border cursor-pointer transition-colors ${checked ? 'bg-indigo-50/50 border-indigo-200 shadow-sm' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
    <div className="flex items-center h-5">
      <input type="checkbox" name={name} checked={checked} onChange={onChange} className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded" />
    </div>
    <div className="ml-3 text-sm flex-1">
      <span className={`font-medium ${checked ? 'text-indigo-900' : 'text-gray-700'}`}>{label}</span>
    </div>
  </label>
);

class ExamenErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Examen Clinique render error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 mt-4 mx-2">
          <h4 className="font-bold flex items-center mb-2"><TriangleAlert size={18} className="mr-2" />Erreur d'affichage de la matrice</h4>
          <p className="text-sm">Une erreur s'est produite lors de l'affichage des anciens examens cliniques. Les données ont pu être mal enregistrées.</p>
          <p className="text-xs mt-2 font-mono bg-red-100 p-2 rounded max-h-32 overflow-y-auto">{this.state.error?.toString()}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Main Component ---

interface ExamenCliniqueProps {
  patient: Patient;
}

export const ExamenClinique: React.FC<ExamenCliniqueProps> = ({ patient }) => {
  const [exams, setExams] = useState<ClinicalExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<ClinicalExamFormData>(INITIAL_FORM_STATE);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);

  const age = useMemo(() => calculateAge(patient.dateOfBirth), [patient.dateOfBirth]);
  const config = useMemo(() => getParamConfig(age), [age]);

  // Ensure 'max' limit for datetime-local picker to block future dates
  const currentDateTimeLocal = useMemo(() => {
     const now = new Date();
     const offset = now.getTimezoneOffset() * 60000;
     const localIso = new Date(now.getTime() - offset).toISOString().slice(0, 16);
     return localIso;
  }, []);

  const fetchExams = async () => {
    try {
      setLoading(true);
      const data = await api.getClinicalExams(patient.id, true);
      setExams(data);
    } catch (error) {
       console.error("Failed to fetch clinical exams:", error);
    } finally {
       setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, [patient.id]);

  useEffect(() => {
    const { bmi, bsa } = computeDerived(formData.weight, formData.height);
    setFormData(prev => ({ ...prev, bmi, bsa }));
  }, [formData.weight, formData.height]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
       const checked = (e.target as HTMLInputElement).checked;
       setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
       setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const openNewExam = () => {
    setEditingExamId(null);
    setFormData({
      ...INITIAL_FORM_STATE,
      date: currentDateTimeLocal
    });
    setIsModalOpen(true);
  };

  const openEditExam = (exam: ClinicalExam) => {
    if (!exam) return;
    setEditingExamId(exam.id);
    
    // Parse date for input safely
    const d = exam.observedAt ? new Date(exam.observedAt) : new Date();
    const validD = isNaN(d.getTime()) ? new Date() : d;
    const offset = validD.getTimezoneOffset() * 60000;
    const localIso = new Date(validD.getTime() - offset).toISOString().slice(0, 16);

    const m = exam.measurements || {};
    
    setFormData({
      date: localIso,
      temperature: m.temperature || '',
      weight: m.weight || '',
      height: m.height || '',
      bmi: '', bsa: '',
      pulse: m.pulse || '',
      sao2: m.sao2 || '',
      sysBP: m.sysBP || '',
      diaBP: m.diaBP || '',
      glasgow: m.glasgow || '',
      ramsay: m.ramsay || '',
      eva: m.eva || '',
      pupilles: m.pupilles || '',
      agitation: m.agitation === true || m.agitation === 'true',
      confusion: m.confusion === true || m.confusion === 'true',
      fr: m.fr || '',
      encombrement: m.encombrement === true || m.encombrement === 'true',
      toux: m.toux === true || m.toux === 'true',
      dyspnee: m.dyspnee === true || m.dyspnee === 'true',
      cyanose: m.cyanose === true || m.cyanose === 'true',
      marbrures: m.marbrures === true || m.marbrures === 'true',
      extremitesFroides: m.extremitesFroides === true || m.extremitesFroides === 'true',
      trcAllonge: m.trcAllonge === true || m.trcAllonge === 'true',
      oedemes: m.oedemes === true || m.oedemes === 'true',
      vomissements: m.vomissements === true || m.vomissements === 'true',
      diarrhee: m.diarrhee === true || m.diarrhee === 'true',
      constipation: m.constipation === true || m.constipation === 'true',
      ballonnement: m.ballonnement === true || m.ballonnement === 'true',
      douleurAbdominale: m.douleurAbdominale === true || m.douleurAbdominale === 'true',
      paleur: m.paleur === true || m.paleur === 'true',
      ictere: m.ictere === true || m.ictere === 'true',
      sueurs: m.sueurs === true || m.sueurs === 'true',
      deshydratation: m.deshydratation === true || m.deshydratation === 'true',
      asthenie: m.asthenie === true || m.asthenie === 'true',
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    try {
      // Create payload dynamically by spreading formData (excluding derived or irrelevant fields)
      const payload: Record<string, any> = {
         date: new Date(formData.date).toISOString()
      };
      
      const payloadKeys = Object.keys(formData).filter(k => !['date', 'bmi', 'bsa'].includes(k));
      for (const key of payloadKeys) {
        payload[key] = (formData as any)[key];
      }

      if (editingExamId) {
         await api.updateClinicalExam(patient.id, editingExamId, payload);
      } else {
         await api.createClinicalExam(patient.id, payload);
      }

      setIsModalOpen(false);
      setFormData(INITIAL_FORM_STATE);
      await fetchExams();
    } catch (e) {
      alert("Erreur lors de l'enregistrement de l'examen");
      console.error(e);
    }
  };

  const renderCellContent = (value: string | boolean | undefined, unit: string = '') => {
    if (value === undefined || value === null || value === '') return <span className="text-gray-300">--</span>;
    if (typeof value === 'boolean') {
        return value ? <Check className="text-emerald-500" size={16} /> : <span className="text-gray-300">Non</span>;
    }
    return (
      <span className="font-semibold text-gray-900">
        {value} <span className="text-xs text-gray-500 font-normal">{unit}</span>
      </span>
    );
  };

  const renderRow = (label: string, field: string, unit: string = '') => (
    <tr className="hover:bg-gray-50">
      <td className="sticky left-0 z-10 bg-white border-r border-gray-200 py-3 pl-4 pr-3 text-sm font-medium text-gray-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
        {label}
      </td>
      {exams.map(exam => (
        <td key={exam?.id || Math.random()} className="whitespace-nowrap px-4 py-3 text-sm text-gray-500 border-l border-gray-200">
            {renderCellContent(exam?.measurements?.[field], unit)}
        </td>
      ))}
    </tr>
  );

  return (
    <div className="relative min-h-[500px]">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold text-gray-800 flex items-center">
            <Activity className="mr-2 text-indigo-600" size={24} /> 
            Longitudinal Examen Clinique
        </h3>
        <button 
          onClick={openNewExam}
          className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm font-medium"
        >
          <Plus size={18} />
          <span>Nouvel Examen</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
           <Activity className="animate-spin text-emerald-600" size={32} />
        </div>
      ) : exams.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300 shadow-sm">
          <Activity className="mx-auto h-12 w-12 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Aucun examen clinique enregistré.</p>
          <p className="text-sm text-gray-400 mt-1">Cliquez sur "Nouvel Examen" pour créer un profil de base.</p>
        </div>
      ) : (
        <ExamenErrorBoundary>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm ring-1 ring-black ring-opacity-5">
           <table className="min-w-full divide-y divide-gray-200 border-collapse">
              <thead className="bg-gray-50">
                 <tr>
                    <th scope="col" className="sticky left-0 z-20 bg-gray-50 py-4 pl-4 pr-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider border-r border-gray-200 w-48 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                       Indicateurs Cliniques
                    </th>
                    {exams.map(exam => {
                       const d = exam?.observedAt ? new Date(exam.observedAt) : new Date();
                       const isValidDate = !isNaN(d.getTime());
                       const dateStr = isValidDate ? d.toLocaleDateString('fr-FR') : 'Invalide';
                       const timeStr = isValidDate ? d.toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'}) : '--:--';
                       const isErr = exam?.status === 'entered_in_error';
                       return (
                         <th key={exam?.id || Math.random()} scope="col" className={`min-w-[160px] max-w-[200px] px-4 py-3 text-left border-l border-gray-200 ${isErr ? 'bg-red-50/50' : ''}`}>
                            <div className="flex flex-col">
                               <div className="flex items-center justify-between mb-1">
                                  <span className={`text-sm font-bold ${isErr ? 'text-red-700 line-through' : 'text-gray-900'}`}>
                                    {dateStr} {timeStr}
                                  </span>
                                  {!isErr && exam && (
                                     <button onClick={() => openEditExam(exam)} className="text-indigo-600 hover:text-indigo-800 transition-colors p-1 rounded-md hover:bg-indigo-50">
                                        <Edit size={14} />
                                     </button>
                                  )}
                               </div>
                               <div className="text-xs text-gray-500 flex items-center">
                                  <User size={12} className="mr-1" />
                                  <span className="truncate">{exam?.recordedByFirstName || ''} {exam?.recordedByLastName || 'Utilisateur'}</span>
                               </div>
                               {exam?.lastAmendedAt && (
                                  <div className="text-[10px] text-gray-400 mt-1 flex flex-col">
                                    <span className="flex items-center"><Clock size={10} className="mr-1"/> Modifié: {new Date(exam.lastAmendedAt).toLocaleDateString('fr-FR')}</span>
                                  </div>
                               )}
                               {isErr && (
                                  <span className="text-xs font-bold text-red-600 mt-2 bg-red-100 px-2 py-0.5 rounded-full inline-block w-max">
                                     Annulé (Erreur)
                                  </span>
                               )}
                            </div>
                         </th>
                       );
                    })}
                 </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                 
                 {/* A. PARAMÈTRES GÉNÉRAUX */}
                 <tr className="bg-gray-100/50">
                    <td colSpan={exams.length + 1} className="py-2 pl-4 text-xs font-bold text-indigo-700 uppercase tracking-wider sticky left-0 z-10 w-full">
                       <span className="flex items-center"><Scale size={14} className="mr-2"/> Paramètres Généraux</span>
                    </td>
                 </tr>
                 {renderRow("Poids", "weight", "kg")}
                 {renderRow("Taille", "height", "cm")}
                 <tr className="bg-indigo-50/30 hover:bg-indigo-50">
                    <td className="sticky left-0 z-10 bg-indigo-50/30 border-r border-gray-200 py-3 pl-4 pr-3 text-sm font-bold text-indigo-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                       IMC (Calculé)
                    </td>
                    {exams.map(exam => {
                       const { bmi } = computeDerived(exam?.measurements?.weight, exam?.measurements?.height);
                       return <td key={exam?.id || Math.random()} className="whitespace-nowrap px-4 py-3 text-sm text-indigo-700 font-bold border-l border-gray-200">{bmi}</td>;
                    })}
                 </tr>
                 <tr className="bg-indigo-50/30 hover:bg-indigo-50">
                    <td className="sticky left-0 z-10 bg-indigo-50/30 border-r border-gray-200 py-3 pl-4 pr-3 text-sm font-bold text-indigo-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                       Surf. Corporelle
                    </td>
                    {exams.map(exam => {
                       const { bsa } = computeDerived(exam?.measurements?.weight, exam?.measurements?.height);
                       return <td key={exam?.id || Math.random()} className="whitespace-nowrap px-4 py-3 text-sm text-indigo-700 font-bold border-l border-gray-200">{bsa !== '--' ? <>{bsa} <span className="text-xs text-indigo-500">m²</span></> : '--'}</td>;
                    })}
                 </tr>
                 {renderRow("Température", "temperature", "°C")}
                 {renderRow("Pouls", "pulse", "bpm")}
                 {renderRow("SaO₂", "sao2", "%")}
                 <tr className="hover:bg-gray-50">
                    <td className="sticky left-0 z-10 bg-white border-r border-gray-200 py-3 pl-4 pr-3 text-sm font-medium text-gray-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                       TA (Sys/Dia)
                    </td>
                    {exams.map(exam => {
                        const hasBp = exam?.measurements?.sysBP || exam?.measurements?.diaBP;
                        return (
                          <td key={exam?.id || Math.random()} className="whitespace-nowrap px-4 py-3 text-sm text-gray-500 border-l border-gray-200">
                              {hasBp ? <span className="font-semibold text-gray-900">{exam?.measurements?.sysBP || '--'} / {exam?.measurements?.diaBP || '--'} <span className="text-xs text-gray-500 font-normal">mmHg</span></span> : <span className="text-gray-300">--</span>}
                          </td>
                        )
                    })}
                 </tr>

                 {/* B. NEURO RAPIDE */}
                 <tr className="bg-gray-100/50">
                    <td colSpan={exams.length + 1} className="py-2 pl-4 text-xs font-bold text-indigo-700 uppercase tracking-wider sticky left-0 z-10 w-full mt-4 border-t-2 border-gray-200">
                       <span className="flex items-center"><Brain size={14} className="mr-2"/> Neuro Rapide</span>
                    </td>
                 </tr>
                 {renderRow("Score Glasgow", "glasgow")}
                 {renderRow("Score Ramsay", "ramsay")}
                 {renderRow("Douleur (EVA)", "eva")}
                 {renderRow("Pupilles", "pupilles")}
                 {renderRow("Agitation", "agitation")}
                 {renderRow("Confusion", "confusion")}

                 {/* C. RESPIRATOIRE RAPIDE */}
                 <tr className="bg-gray-100/50">
                    <td colSpan={exams.length + 1} className="py-2 pl-4 text-xs font-bold text-indigo-700 uppercase tracking-wider sticky left-0 z-10 w-full mt-4 border-t-2 border-gray-200">
                       <span className="flex items-center"><Wind size={14} className="mr-2"/> Respiratoire Rapide</span>
                    </td>
                 </tr>
                 {renderRow("Fréquence Resp.", "fr", "/min")}
                 {renderRow("Encombrement", "encombrement")}
                 {renderRow("Toux", "toux")}
                 {renderRow("Dyspnée", "dyspnee")}
                 {renderRow("Cyanose", "cyanose")}

                 {/* D. CARDIO / PERIPHERIQUE */}
                 <tr className="bg-gray-100/50">
                    <td colSpan={exams.length + 1} className="py-2 pl-4 text-xs font-bold text-indigo-700 uppercase tracking-wider sticky left-0 z-10 w-full mt-4 border-t-2 border-gray-200">
                       <span className="flex items-center"><Heart size={14} className="mr-2"/> Cardio / Périphérique Rapide</span>
                    </td>
                 </tr>
                 {renderRow("Marbrures", "marbrures")}
                 {renderRow("Extrémités froides", "extremitesFroides")}
                 {renderRow("TRC allongé", "trcAllonge")}
                 {renderRow("Œdèmes", "oedemes")}

                 {/* E. DIGESTIF / ELIMINATION */}
                 <tr className="bg-gray-100/50">
                    <td colSpan={exams.length + 1} className="py-2 pl-4 text-xs font-bold text-indigo-700 uppercase tracking-wider sticky left-0 z-10 w-full mt-4 border-t-2 border-gray-200">
                       <span className="flex items-center"><Focus size={14} className="mr-2"/> Digestif / Elimination Rapide</span>
                    </td>
                 </tr>
                 {renderRow("Vomissements", "vomissements")}
                 {renderRow("Diarrhée", "diarrhee")}
                 {renderRow("Constipation", "constipation")}
                 {renderRow("Ballonnement", "ballonnement")}
                 {renderRow("Douleur abdominale", "douleurAbdominale")}

                 {/* F. CUTANE / ETAT GENERAL */}
                 <tr className="bg-gray-100/50">
                    <td colSpan={exams.length + 1} className="py-2 pl-4 text-xs font-bold text-indigo-700 uppercase tracking-wider sticky left-0 z-10 w-full mt-4 border-t-2 border-gray-200">
                       <span className="flex items-center"><User size={14} className="mr-2"/> Cutané / État Général Rapide</span>
                    </td>
                 </tr>
                 {renderRow("Pâleur", "paleur")}
                 {renderRow("Ictère", "ictere")}
                 {renderRow("Sueurs", "sueurs")}
                 {renderRow("Déshydratation clinique", "deshydratation")}
                 {renderRow("Asthénie", "asthenie")}

              </tbody>
           </table>
        </div>
        </ExamenErrorBoundary>
      )}

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <div className="flex items-center space-x-2">
                 <Activity className="text-emerald-600" />
                 <h3 className="text-xl font-bold text-gray-900">{editingExamId ? "Modifier l'Examen Clinique" : "Nouvel Examen Clinique"}</h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-8 bg-gray-50/50">
              
              {/* Entête Temporelle */}
              <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl flex items-center shadow-sm">
                 <Clock className="text-blue-500 mr-3" size={20} />
                 <div className="flex-1">
                    <label className="block text-sm font-bold text-blue-900 mb-1">Date et Heure de l'Observation</label>
                    <input 
                       type="datetime-local" 
                       name="date"
                       value={formData.date}
                       max={currentDateTimeLocal}
                       onChange={handleInputChange}
                       className="border border-blue-200 rounded-lg p-2 text-sm focus:ring-blue-500 focus:border-blue-500 w-64 bg-white"
                    />
                 </div>
              </div>

              {/* A. Paramêtres Généraux */}
              <section>
                 <h4 className="text-sm font-bold text-indigo-600 uppercase tracking-wider mb-4 flex items-center">
                   <Scale size={18} className="mr-2" /> Paramètres Généraux
                 </h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <SmartParamInput config={config.temperature} name="temperature" value={formData.temperature} onChange={handleInputChange} />
                    <SmartParamInput config={config.weight} name="weight" value={formData.weight} onChange={handleInputChange} />
                    <SmartParamInput config={config.height} name="height" value={formData.height} onChange={handleInputChange} />
                    <SmartParamInput config={config.pulse} name="pulse" value={formData.pulse} onChange={handleInputChange} />
                    <SmartParamInput config={config.sao2} name="sao2" value={formData.sao2} onChange={handleInputChange} />
                    <SmartParamInput config={config.sysBP} name="sysBP" value={formData.sysBP} onChange={handleInputChange} />
                    <SmartParamInput config={config.diaBP} name="diaBP" value={formData.diaBP} onChange={handleInputChange} />
                    
                    {/* Calculated Fields Display */}
                    <div className="col-span-1 md:col-span-2 lg:col-span-2 grid grid-cols-2 gap-4">
                      <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex flex-col justify-center">
                        <span className="text-xs font-bold text-indigo-400 uppercase">IMC (Calculé)</span>
                        <span className="text-2xl font-bold text-indigo-900">{formData.bmi || "--"}</span>
                      </div>
                      <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex flex-col justify-center">
                        <span className="text-xs font-bold text-indigo-400 uppercase">Surface (m²)</span>
                        <span className="text-2xl font-bold text-indigo-900">{formData.bsa || "--"}</span>
                      </div>
                    </div>
                 </div>
              </section>

              <hr className="border-gray-200" />

              {/* B. Neuro Rapide */}
              <section>
                 <h4 className="text-sm font-bold text-indigo-600 uppercase tracking-wider mb-4 flex items-center">
                   <Brain size={18} className="mr-2" /> Neuro Rapide
                 </h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <SimpleInput label="Score Glasgow" name="glasgow" value={formData.glasgow} onChange={handleInputChange} type="number" />
                    <SimpleInput label="Score Ramsay" name="ramsay" value={formData.ramsay} onChange={handleInputChange} type="number" />
                    <SimpleInput label="Douleur (EVA)" name="eva" value={formData.eva} onChange={handleInputChange} type="number" />
                    <SimpleInput label="Pupilles" name="pupilles" value={formData.pupilles} onChange={handleInputChange} />
                    <div className="col-span-1 md:col-span-2 lg:col-span-2 grid grid-cols-2 gap-4">
                      <CheckboxTile label="Agitation" name="agitation" checked={formData.agitation} onChange={handleInputChange} />
                      <CheckboxTile label="Confusion" name="confusion" checked={formData.confusion} onChange={handleInputChange} />
                    </div>
                 </div>
              </section>

              <hr className="border-gray-200" />

              {/* C. Respiratoire Rapide */}
              <section>
                 <h4 className="text-sm font-bold text-indigo-600 uppercase tracking-wider mb-4 flex items-center">
                   <Wind size={18} className="mr-2" /> Respiratoire Rapide
                 </h4>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <SmartParamInput config={config.fr} name="fr" value={formData.fr} onChange={handleInputChange} />
                    <div className="col-span-1 md:col-span-2 grid grid-cols-2 gap-4">
                      <CheckboxTile label="Encombrement" name="encombrement" checked={formData.encombrement} onChange={handleInputChange} />
                      <CheckboxTile label="Toux" name="toux" checked={formData.toux} onChange={handleInputChange} />
                      <CheckboxTile label="Dyspnée" name="dyspnee" checked={formData.dyspnee} onChange={handleInputChange} />
                      <CheckboxTile label="Cyanose" name="cyanose" checked={formData.cyanose} onChange={handleInputChange} />
                    </div>
                 </div>
              </section>

              <hr className="border-gray-200" />

              {/* D. Cardio / Peripherique Rapide */}
              <section>
                 <h4 className="text-sm font-bold text-indigo-600 uppercase tracking-wider mb-4 flex items-center">
                   <Heart size={18} className="mr-2" /> Cardio / Périphérique Rapide
                 </h4>
                 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <CheckboxTile label="Marbrures" name="marbrures" checked={formData.marbrures} onChange={handleInputChange} />
                    <CheckboxTile label="Extrémités froides" name="extremitesFroides" checked={formData.extremitesFroides} onChange={handleInputChange} />
                    <CheckboxTile label="TRC allongé" name="trcAllonge" checked={formData.trcAllonge} onChange={handleInputChange} />
                    <CheckboxTile label="Œdèmes" name="oedemes" checked={formData.oedemes} onChange={handleInputChange} />
                 </div>
              </section>

              <hr className="border-gray-200" />

              {/* E. Digestif / Elimination Rapide */}
              <section>
                 <h4 className="text-sm font-bold text-indigo-600 uppercase tracking-wider mb-4 flex items-center">
                   <Focus size={18} className="mr-2" /> Digestif / Elimination Rapide
                 </h4>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <CheckboxTile label="Vomissements" name="vomissements" checked={formData.vomissements} onChange={handleInputChange} />
                    <CheckboxTile label="Diarrhée" name="diarrhee" checked={formData.diarrhee} onChange={handleInputChange} />
                    <CheckboxTile label="Constipation" name="constipation" checked={formData.constipation} onChange={handleInputChange} />
                    <CheckboxTile label="Ballonnement" name="ballonnement" checked={formData.ballonnement} onChange={handleInputChange} />
                    <CheckboxTile label="Douleur abdominale" name="douleurAbdominale" checked={formData.douleurAbdominale} onChange={handleInputChange} />
                 </div>
              </section>

              <hr className="border-gray-200" />

              {/* F. Cutane / Etat General Rapide */}
              <section>
                 <h4 className="text-sm font-bold text-indigo-600 uppercase tracking-wider mb-4 flex items-center">
                   <User size={18} className="mr-2" /> Cutané / État Général Rapide
                 </h4>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <CheckboxTile label="Pâleur" name="paleur" checked={formData.paleur} onChange={handleInputChange} />
                    <CheckboxTile label="Ictère" name="ictere" checked={formData.ictere} onChange={handleInputChange} />
                    <CheckboxTile label="Sueurs" name="sueurs" checked={formData.sueurs} onChange={handleInputChange} />
                    <CheckboxTile label="Déshydratation clinique" name="deshydratation" checked={formData.deshydratation} onChange={handleInputChange} />
                    <CheckboxTile label="Asthénie" name="asthenie" checked={formData.asthenie} onChange={handleInputChange} />
                 </div>
              </section>

            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-white flex justify-between space-x-4 items-center">
              <div>
                 {editingExamId && (
                    <button 
                       onClick={async () => {
                         if (!window.confirm("Voulez-vous marquer cet examen comme saisi par erreur ? Les valeurs retourneront à leur état antérieur.")) return;
                         try {
                           await api.invalidateClinicalExam(patient.id, editingExamId, "Invalider par le praticien");
                           setIsModalOpen(false);
                           fetchExams();
                         } catch(e) {
                           alert("Erreur lors de l'invalidation");
                         }
                       }}
                       className="flex items-center text-red-600 hover:bg-red-50 font-bold px-4 py-2 rounded-lg transition-colors border border-transparent hover:border-red-200"
                    >
                       <Trash2 size={18} className="mr-2" />
                       Saisi par erreur
                    </button>
                 )}
              </div>
              <div className="flex space-x-3">
                 <button 
                   onClick={() => setIsModalOpen(false)}
                   className="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                 >
                   Annuler
                 </button>
                 <button 
                   onClick={handleSave}
                   className="px-6 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 shadow-[0_4px_10px_-2px_rgba(16,185,129,0.3)] transition-colors flex items-center"
                 >
                   <Save size={18} className="mr-2" />
                   {editingExamId ? "Sauvegarder l'amendement" : "Enregistrer l'examen"}
                 </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
