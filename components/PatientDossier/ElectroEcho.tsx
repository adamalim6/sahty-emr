import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Plus, 
  Activity, 
  Heart, 
  Zap, 
  Ruler, 
  FileText, 
  X, 
  Save, 
  CalendarClock,
  AlertTriangle,
  FileCheck,
  Stethoscope,
  Paperclip,
  Check,
  Pencil,
  Trash2,
  Waves,
  ScanLine,
  ArrowRightLeft,
  Minimize2,
  Maximize2,
  Filter
} from 'lucide-react';

// --- Types ECG ---

interface ECGRecord {
  id: string;
  date: string;
  time: string;
  
  // 1. General
  type: 'Repos' | 'Controle' | 'Effort';
  position: 'Decubitus' | 'Assis';
  
  // 2. Technical
  speed: '25' | '50';
  quality: 'Bonne' | 'Artefacts';
  
  // 3. Rhythm
  rhythm: 'Sinusal' | 'Atrial' | 'Jonctionnel' | 'Ventriculaire';
  regularity: 'Regulier' | 'Irregulier';
  pWave: 'Presentes' | 'Absentes';
  
  // 4. Disorders (Split for UI)
  rhythmDisorders: string[]; 
  conductionDisorders: string[];
  
  // 5. Repolarization (ST-T)
  repolarization: 'Normal' | 'Anomalie';
  repolarizationDetails: string[];
  
  // 6. Ischemia / Necrosis
  ischemia: 'Aucune' | 'Presente';
  ischemiaType?: 'Ischémie' | 'SCA ST+' | 'SCA ST-' | 'Infarctus ancien';
  ischemiaLoc: string[];

  // 7. Measures
  fc: string;
  pr: string;
  qrs: string;
  qt: string;
  qtc: string;
  axisP: string;
  axisQRS: string;
  axisT: string;
  
  // 8. Other
  otherAnomalies: string;
  
  // 9. Conclusion
  conclusion: string;
  comparison: boolean;
  
  doctor: string;
  hasAttachment: boolean;
}

// --- Types ECHO ---

interface EchoRecord {
  id: string;
  date: string;
  time: string;
  
  // 1. General
  type: 'ETT' | 'ETO' | 'Stress' | 'POCUS';
  modalities: string[]; // Doppler, 3D...

  // 2. Ventricule Gauche
  fevg: string; // %
  gls?: string; // %
  mapse?: string; // mm
  dtd_vg: string; // mm
  dtd_index?: string;
  siv: string; // mm
  pp: string; // mm
  hvg: 'Absente' | 'Modérée' | 'Sévère';

  // 3. Cinétique
  troubleCinétique: boolean;
  segments: string[]; // Hypo, Akinésie...

  // 4. Ventricule Droit
  tapse: string; // mm
  fonctionVD: 'Normale' | 'Altérée';
  surfaceVD?: string;

  // 5. Oreillettes
  og_taille: 'Normale' | 'Dilatée';
  od_taille: 'Normale' | 'Dilatée';

  // 6. Pressions
  paps: string; // mmHg
  vci: 'Normale' | 'Dilatée' | 'Peu Collabable';

  // 7. Valves (Simplified structure for UI)
  valves: {
    mitrale: ValveStatus;
    aortique: ValveStatus;
    tricuspide: ValveStatus;
    pulmonaire: ValveStatus;
  };

  // 8. Autres
  pericarde: 'Sec' | 'Epanchement Minime' | 'Epanchement Modéré' | 'Epanchement Abondant';
  thrombus: boolean;
  vegetation: boolean;
  autreAnomalie: string;

  // 9. Conclusion
  conclusion: string;
  doctor: string;
  hasAttachment: boolean;
}

interface ValveStatus {
  status: 'Normale' | 'Pathologique';
  type: string[]; // Insuffisance, Rétrécissement
  severity: 'Minime' | 'Modérée' | 'Sévère';
}

const INITIAL_ECG: ECGRecord = {
  id: '',
  date: new Date().toISOString().split('T')[0],
  time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  type: 'Repos',
  position: 'Decubitus',
  speed: '25',
  quality: 'Bonne',
  rhythm: 'Sinusal',
  regularity: 'Regulier',
  pWave: 'Presentes',
  rhythmDisorders: ['Aucun'],
  conductionDisorders: ['Aucun'],
  repolarization: 'Normal',
  repolarizationDetails: [],
  ischemia: 'Aucune',
  ischemiaLoc: [],
  fc: '',
  pr: '',
  qrs: '',
  qt: '',
  qtc: '',
  axisP: '',
  axisQRS: '',
  axisT: '',
  otherAnomalies: '',
  conclusion: '',
  comparison: false,
  doctor: 'Dr. Alami',
  hasAttachment: false
};

const INITIAL_VALVE: ValveStatus = { status: 'Normale', type: [], severity: 'Minime' };

const INITIAL_ECHO: EchoRecord = {
  id: '',
  date: new Date().toISOString().split('T')[0],
  time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  type: 'ETT',
  modalities: [],
  fevg: '',
  dtd_vg: '',
  siv: '',
  pp: '',
  hvg: 'Absente',
  troubleCinétique: false,
  segments: [],
  tapse: '',
  fonctionVD: 'Normale',
  og_taille: 'Normale',
  od_taille: 'Normale',
  paps: '',
  vci: 'Normale',
  valves: {
    mitrale: { ...INITIAL_VALVE },
    aortique: { ...INITIAL_VALVE },
    tricuspide: { ...INITIAL_VALVE },
    pulmonaire: { ...INITIAL_VALVE },
  },
  pericarde: 'Sec',
  thrombus: false,
  vegetation: false,
  autreAnomalie: '',
  conclusion: '',
  doctor: 'Dr. Alami',
  hasAttachment: false
};

// --- Helper Components ---

const SectionTitle = ({ icon: Icon, title, colorClass = "text-gray-800", compact = false }: { icon: any, title: string, colorClass?: string, compact?: boolean }) => (
  <div className={`flex items-center space-x-2 border-b border-gray-100 ${compact ? 'pb-1 mb-2' : 'pb-2 mb-3'}`}>
    <Icon size={compact ? 14 : 16} className={colorClass} />
    <h4 className={`font-bold text-gray-800 uppercase tracking-wider ${compact ? 'text-[11px]' : 'text-xs'}`}>{title}</h4>
  </div>
);

const ToggleGroup = ({ 
  options, 
  value, 
  onChange, 
  label,
  compact = false,
  disabledOptions = []
}: { 
  options: { label: string, value: string }[], 
  value: string, 
  onChange: (val: any) => void,
  label?: string,
  compact?: boolean,
  disabledOptions?: string[]
}) => (
  <div className="flex flex-col w-full">
    {label && (
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">{label}</span>
    )}
    <div className={`flex bg-gray-100 p-0.5 rounded-lg border border-gray-200 ${compact ? 'text-[11px]' : 'text-xs'}`}>
      {options.map((opt) => {
        const isSelected = value === opt.value;
        const isDisabled = disabledOptions.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            disabled={isDisabled}
            onClick={() => onChange(opt.value)}
            className={`
              flex-1 text-center font-medium rounded-md transition-all duration-200 whitespace-nowrap
              ${compact ? 'py-1 px-1' : 'py-1.5 px-2'}
              ${isDisabled 
                ? 'text-gray-300 cursor-not-allowed bg-gray-50' 
                : (isSelected 
                    ? 'bg-white text-slate-900 shadow-sm border border-gray-100 ring-1 ring-black/5 font-bold' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50')
              }
            `}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  </div>
);

const MultiSelectPill = ({ 
  options, 
  selectedValues, 
  onChange,
  noneValue = 'Aucun',
  label,
  disabledOptions = []
}: { 
  options: string[], 
  selectedValues: string[], 
  onChange: (vals: string[]) => void,
  noneValue?: string,
  label?: string,
  disabledOptions?: string[]
}) => {
  const toggle = (opt: string) => {
    if (disabledOptions.includes(opt)) return;

    let newValues = [...selectedValues];
    
    if (opt === noneValue) {
      newValues = [noneValue];
    } else {
      if (newValues.includes(noneValue)) {
        newValues = newValues.filter(v => v !== noneValue);
      }
      if (newValues.includes(opt)) {
        newValues = newValues.filter(v => v !== opt);
      } else {
        newValues.push(opt);
      }
      if (newValues.length === 0) {
        newValues = [noneValue];
      }
    }
    onChange(newValues);
  };

  return (
    <div>
      {label && <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">{label}</span>}
      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => {
          const isSelected = selectedValues.includes(opt);
          const isDisabled = disabledOptions.includes(opt);
          const isNone = opt === noneValue;
          
          let colorClass = 'bg-white text-gray-600 border-gray-300 hover:border-gray-400 hover:bg-gray-50';
          if (isDisabled) {
            colorClass = 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed decoration-slice';
          } else if (isSelected) {
             if (isNone) colorClass = 'bg-gray-600 text-white border-gray-600';
             else colorClass = 'bg-indigo-600 text-white border-indigo-600 shadow-sm';
          }

          return (
            <button
              key={opt}
              type="button"
              disabled={isDisabled}
              onClick={() => toggle(opt)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-all duration-200 flex items-center ${colorClass}`}
            >
              {opt}
              {isSelected && !isNone && !isDisabled && <Check size={10} className="ml-1.5" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const MetricInput = ({ 
  label, 
  value, 
  onChange, 
  unit,
  highlight = false,
  warning = false,
  compact = false,
  type = "number"
}: { 
  label: string, 
  value: string, 
  onChange: (val: string) => void, 
  unit?: string,
  highlight?: boolean,
  warning?: boolean,
  compact?: boolean,
  type?: string
}) => (
  <div className="flex flex-col w-full group min-w-[70px]"> 
    <label className={`text-[10px] font-bold uppercase mb-0.5 text-center ${warning ? 'text-red-600' : (highlight ? 'text-indigo-700' : 'text-gray-400 group-hover:text-gray-600 transition-colors')}`}>{label}</label>
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`
          block w-full rounded-md border shadow-sm focus:ring-1 text-center font-bold transition-all
          ${compact ? 'py-0.5 px-1 text-xs h-7' : 'py-1.5 px-2 text-sm'}
          ${warning 
            ? 'border-red-300 bg-red-50 text-red-900 focus:border-red-500 focus:ring-red-200'
            : (highlight 
                ? 'border-indigo-200 focus:border-indigo-500 focus:ring-indigo-200 bg-indigo-50/50 text-indigo-900' 
                : 'border-gray-200 bg-white text-gray-800 focus:border-emerald-500 focus:ring-emerald-500 hover:border-gray-300')
          }
        `}
        placeholder="-"
      />
      {unit && <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none">{unit}</span>}
    </div>
  </div>
);

// --- 🧠 LOGIC ENGINE : CLINICAL TRUTH TABLES (ECG) ---

// Helpers
const has = (arr: string[], val: string) => arr.includes(val);
const hasAny = (arr: string[], vals: string[]) => vals.some(v => arr.includes(v));

const applyClinicalRules = (currentData: ECGRecord, field: keyof ECGRecord, value: any): ECGRecord => {
  let d = { ...currentData, [field]: value };

  // --- 1. RHYTHM & DISORDERS LOGIC ---
  if (field === 'rhythm') {
    if (value === 'Sinusal') {
       d.pWave = 'Presentes';
       d.rhythmDisorders = d.rhythmDisorders.filter(x => !['FA', 'Flutter', 'TSV', 'TV'].includes(x));
       if (d.rhythmDisorders.length === 0) d.rhythmDisorders = ['Aucun'];
    } else if (value === 'Atrial') {
       // Typically Atrial implies FA/Flutter
    } else if (value === 'Ventriculaire') {
       d.pWave = 'Absentes';
       d.rhythmDisorders = ['TV']; // Forces TV
       d.regularity = 'Regulier'; // TV is typically regular (mostly)
    }
  }

  if (field === 'rhythmDisorders') {
    let disorders = value as string[];

    // Priority 1: TV Exclusive
    if (disorders.includes('TV')) {
       if (!currentData.rhythmDisorders.includes('TV')) {
          disorders = ['TV'];
          d.rhythm = 'Ventriculaire';
          d.pWave = 'Absentes';
          d.conductionDisorders = ['Aucun']; 
       } else if (disorders.length > 1) {
          disorders = disorders.filter(x => x !== 'TV');
       }
    }

    // Priority 2: FA vs Flutter (Exclusive)
    if (disorders.includes('FA') && disorders.includes('Flutter')) {
       const oldHadFA = currentData.rhythmDisorders.includes('FA');
       if (oldHadFA) disorders = disorders.filter(x => x !== 'FA'); 
       else disorders = disorders.filter(x => x !== 'Flutter'); 
    }

    // Priority 3: FA/Flutter Constraints
    if (hasAny(disorders, ['FA', 'Flutter'])) {
       disorders = disorders.filter(x => !['ESA', 'ESV', 'TV', 'TSV'].includes(x));
       d.rhythm = 'Atrial';
       
       if (disorders.includes('FA')) {
         d.regularity = 'Irregulier';
         d.pWave = 'Absentes';
       }
       if (disorders.includes('Flutter')) {
         d.regularity = 'Regulier'; 
       }
    }

    // Priority 4: Bradycardie Compatibility
    if (disorders.includes('Bradycardie')) {
       if (hasAny(disorders, ['TV', 'TSV'])) {
         disorders = disorders.filter(x => x !== 'Bradycardie'); 
       }
    }

    if (disorders.length === 0) disorders = ['Aucun'];
    d.rhythmDisorders = disorders;
  }

  // --- 2. CONDUCTION LOGIC ---
  if (field === 'conductionDisorders') {
    let cond = value as string[];

    // Exclusivity: BAV (I, II, III)
    const bavs = ['BAV I', 'BAV II', 'BAV III'];
    const selectedBAVs = cond.filter(c => bavs.includes(c));
    if (selectedBAVs.length > 1) {
       const lastAdded = selectedBAVs[selectedBAVs.length - 1];
       cond = cond.filter(c => !bavs.includes(c) || c === lastAdded);
    }

    // BAV III Logic
    if (cond.includes('BAV III')) {
       cond = cond.filter(c => !['BBD', 'BBG', 'Hémibloc'].includes(c));
    }

    // Exclusivity: BBD vs BBG
    if (cond.includes('BBD') && cond.includes('BBG')) {
       const oldHadBBD = currentData.conductionDisorders.includes('BBD');
       if (oldHadBBD) cond = cond.filter(x => x !== 'BBD');
       else cond = cond.filter(x => x !== 'BBG');
    }

    // Exclusivity: BBG vs Hémibloc
    if (cond.includes('BBG') && cond.includes('Hémibloc')) {
       cond = cond.filter(x => x !== 'Hémibloc');
    }

    if (cond.length === 0) cond = ['Aucun'];
    d.conductionDisorders = cond;
  }

  // --- 3. REPOLARIZATION & ISCHEMIA LOGIC ---
  if (field === 'repolarizationDetails') {
     const details = value as string[];
     if (details.includes('Sus-décalage ST')) {
        d.ischemia = 'Presente';
        if (d.ischemiaType !== 'SCA ST+') d.ischemiaType = 'SCA ST+';
     } else if (currentData.repolarizationDetails.includes('Sus-décalage ST')) {
        if (d.ischemiaType === 'SCA ST+') {
           d.ischemiaType = undefined;
           if (details.length === 0) d.ischemia = 'Aucune';
        }
     }
  }

  if (field === 'ischemiaType') {
     if (value === 'SCA ST+') {
        d.repolarization = 'Anomalie';
        if (!d.repolarizationDetails.includes('Sus-décalage ST')) {
           d.repolarizationDetails = [...d.repolarizationDetails.filter(x => x !== 'Aucun'), 'Sus-décalage ST'];
        }
        d.repolarizationDetails = d.repolarizationDetails.filter(x => x !== 'Sous-décalage ST');
     }
     if (value === 'SCA ST-') {
        d.repolarization = 'Anomalie';
        d.repolarizationDetails = d.repolarizationDetails.filter(x => x !== 'Sus-décalage ST');
        if (!hasAny(d.repolarizationDetails, ['Sous-décalage ST', 'Onde T négative'])) {
           d.repolarizationDetails = [...d.repolarizationDetails.filter(x => x !== 'Aucun'), 'Sous-décalage ST'];
        }
     }
  }

  if (field === 'ischemiaLoc') {
     const locs = value as string[];
     if (locs.includes('VD')) {
        if (!hasAny(locs, ['Inférieur', 'Postérieur'])) {
           const hadVD = currentData.ischemiaLoc.includes('VD');
           if (!hadVD) {
              alert("Le territoire VD doit être associé à Inférieur ou Postérieur."); 
              d.ischemiaLoc = locs.filter(l => l !== 'VD');
           } else {
              d.ischemiaLoc = locs.filter(l => l !== 'VD');
           }
        }
     }
  }

  return d;
};

// --- 🧠 LOGIC ENGINE : CLINICAL TRUTH TABLES (ECHO) ---

const validateEchoCoherence = (data: EchoRecord): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // POCUS Constraints
  if (data.type === 'POCUS') {
    if (data.gls || data.mapse || data.surfaceVD) {
       warnings.push("Mesures avancées (GLS, MAPSE) non standards en POCUS.");
    }
  }

  // Stress Echo
  if (data.type === 'Stress' && !data.troubleCinétique && data.conclusion.length < 10) {
    warnings.push("Echo de stress: Veuillez détailler la cinétique dans la conclusion.");
  }

  // LV Rules
  const fe = parseFloat(data.fevg);
  if (!isNaN(fe) && fe < 40 && !data.conclusion.toLowerCase().includes('dysfonction')) {
     warnings.push("FEVG < 40% : Mentionner dysfonction systolique dans la conclusion.");
  }

  // RV Rules
  const tapse = parseFloat(data.tapse);
  if (!isNaN(tapse) && tapse < 17 && data.fonctionVD === 'Normale') {
     errors.push("Incohérence: TAPSE < 17 mm est incompatible avec une fonction VD Normale.");
  }

  // Pressures
  const paps = parseFloat(data.paps);
  if (!isNaN(paps) && paps > 45 && data.vci === 'Normale') {
     warnings.push("PAPS élevée (>45) : Vérifier la VCI (souvent dilatée/peu collabable).");
  }

  // Valves
  const valves = Object.values(data.valves);
  if (valves.some(v => v.severity === 'Sévère') && data.conclusion.length < 5) {
     errors.push("Valvulopathie Sévère : Conclusion obligatoire.");
  }

  // Mandatory
  if (!data.conclusion) errors.push("Conclusion obligatoire.");

  return { errors, warnings };
};

// --- Validation Logic (ECG) ---

interface ValidationResult {
  errors: string[];
  warnings: string[];
}

const validateClinicalCoherence = (data: ECGRecord): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Mandatory Fields
  if (!data.conclusion || data.conclusion.trim() === '') {
    errors.push("Conclusion obligatoire");
  }

  // 2. Ischemia Coherence
  if (data.ischemia === 'Presente') {
    if (!data.ischemiaType) {
      errors.push("Type d'ischémie manquant (SCA ST+, ST- ou Ancien)");
    }
    if (data.ischemiaLoc.length === 0) {
      warnings.push("Aucun territoire ischémique précisé");
    }
  }

  // 3. Rhythm Coherence 
  if (data.rhythm === 'Sinusal' && (data.rhythmDisorders.includes('FA') || data.rhythmDisorders.includes('Flutter'))) {
    errors.push("Incohérence Rythme: Sinusal vs FA/Flutter");
  }
  if (data.rhythm === 'Ventriculaire' && data.rhythmDisorders.includes('FA')) {
     errors.push("Incohérence: Rythme Ventriculaire ne peut être FA");
  }

  // 4. Measures
  const fc = parseInt(data.fc);
  if (!isNaN(fc)) {
    if (fc < 30) warnings.push("Bradycardie extrême (< 30 bpm)");
    if (fc > 200) warnings.push("Tachycardie extrême (> 200 bpm)");
  }

  const qtc = parseInt(data.qtc);
  if (!isNaN(qtc) && qtc > 500) {
    warnings.push("QTc allongé (> 500ms) : Risque de Torsade");
  }

  // 5. Repolarization
  if (data.repolarization === 'Anomalie' && data.repolarizationDetails.length === 0) {
    warnings.push("Anomalie de repolarisation indiquée sans détail");
  }

  return { errors, warnings };
};


// --- Main Component ---

export const ElectroEcho: React.FC = () => {
  // ECG State
  const [ecgs, setEcgs] = useState<ECGRecord[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<ECGRecord>(INITIAL_ECG);
  const [validation, setValidation] = useState<ValidationResult>({ errors: [], warnings: [] });
  
  // Echo State
  const [echos, setEchos] = useState<EchoRecord[]>([]);
  const [isEchoModalOpen, setIsEchoModalOpen] = useState(false);
  const [echoFormData, setEchoFormData] = useState<EchoRecord>(INITIAL_ECHO);
  const [echoValidation, setEchoValidation] = useState<ValidationResult>({ errors: [], warnings: [] });
  
  // Combined Data Logic
  const sortedRecords = useMemo(() => {
    const ecgItems = ecgs.map(item => ({ ...item, entryType: 'ECG' as const }));
    const echoItems = echos.map(item => ({ ...item, entryType: 'ECHO' as const }));
    
    return [...ecgItems, ...echoItems].sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time}`);
      const dateB = new Date(`${b.date}T${b.time}`);
      return dateB.getTime() - dateA.getTime();
    });
  }, [ecgs, echos]);

  // --- Dynamic Option Disabling Helpers (ECG) ---
  const getDisabledRhythmDisorders = useCallback(() => {
     const { rhythm, rhythmDisorders } = formData;
     const disabled: string[] = [];
     if (rhythm === 'Sinusal') disabled.push('FA', 'Flutter', 'TSV', 'TV');
     if (rhythm === 'Atrial') disabled.push('ESA'); 
     if (rhythm === 'Ventriculaire') return ['FA', 'Flutter', 'ESA', 'ESV', 'TSV', 'Bradycardie']; 
     if (rhythmDisorders.includes('TV')) return ['FA', 'Flutter', 'ESA', 'ESV', 'TSV', 'Bradycardie'];
     if (rhythmDisorders.includes('FA')) disabled.push('Flutter', 'ESA', 'ESV', 'TSV');
     if (rhythmDisorders.includes('Flutter')) disabled.push('FA', 'ESA', 'ESV', 'TSV');
     return disabled;
  }, [formData]);

  const getDisabledConduction = useCallback(() => {
     const { conductionDisorders } = formData;
     const disabled: string[] = [];
     if (conductionDisorders.includes('BAV III')) return ['BAV I', 'BAV II', 'BBD', 'BBG', 'Hémibloc'];
     if (conductionDisorders.includes('BBD')) disabled.push('BBG');
     if (conductionDisorders.includes('BBG')) disabled.push('BBD', 'Hémibloc');
     return disabled;
  }, [formData]);

  const getDisabledRegularity = useCallback(() => {
     const { rhythmDisorders } = formData;
     if (rhythmDisorders.includes('FA')) return ['Regulier'];
     if (rhythmDisorders.includes('Flutter')) return ['Irregulier'];
     return [];
  }, [formData]);

  const getDisabledPWave = useCallback(() => {
     const { rhythm, rhythmDisorders } = formData;
     if (rhythm === 'Sinusal') return ['Absentes'];
     if (rhythmDisorders.includes('FA') || rhythmDisorders.includes('Flutter') || rhythmDisorders.includes('TV')) return ['Presentes'];
     return [];
  }, [formData]);

  // --- Echo Logic Helpers ---
  const handleEchoInputChange = (field: keyof EchoRecord, value: any) => {
    setEchoFormData(prev => {
      // Clinical rules applied on change
      const d = { ...prev, [field]: value };
      
      // Rule: POCUS hides details
      if (field === 'type' && value === 'POCUS') {
        d.modalities = [];
        d.gls = '';
        d.mapse = '';
        d.dtd_index = '';
        d.surfaceVD = '';
      }
      
      return d;
    });
  };
  
  const handleValveChange = (valve: keyof EchoRecord['valves'], key: keyof ValveStatus, value: any) => {
    setEchoFormData(prev => ({
      ...prev,
      valves: {
        ...prev.valves,
        [valve]: { ...prev.valves[valve], [key]: value }
      }
    }));
  };

  const isEchoFieldHidden = (field: string) => {
    if (echoFormData.type === 'POCUS') {
      return ['gls', 'mapse', 'dtd_index', 'surfaceVD', 'strain'].includes(field);
    }
    return false;
  };

  // ----------------------------------------

  useEffect(() => {
    if (isModalOpen) setValidation(validateClinicalCoherence(formData));
  }, [formData, isModalOpen]);
  
  useEffect(() => {
    if (isEchoModalOpen) setEchoValidation(validateEchoCoherence(echoFormData));
  }, [echoFormData, isEchoModalOpen]);

  // SMART CHANGE HANDLER
  const handleInputChange = (field: keyof ECGRecord, value: any) => {
    setFormData(prev => applyClinicalRules(prev, field, value));
  };

  const handleSave = () => {
    if (validation.errors.length > 0) return;
    if (formData.id) {
       setEcgs(prev => prev.map(item => item.id === formData.id ? formData : item));
    } else {
       const newRecord = { ...formData, id: Date.now().toString() };
       setEcgs(prev => [newRecord, ...prev]);
    }
    setIsModalOpen(false);
    setFormData(INITIAL_ECG);
  };

  const handleSaveEcho = () => {
    if (echoValidation.errors.length > 0) return;
    if (echoFormData.id) {
      setEchos(prev => prev.map(item => item.id === echoFormData.id ? echoFormData : item));
    } else {
      const newRecord = { ...echoFormData, id: Date.now().toString() };
      setEchos(prev => [newRecord, ...prev]);
    }
    setIsEchoModalOpen(false);
    setEchoFormData(INITIAL_ECHO);
  };

  const handleEdit = (record: ECGRecord) => {
     setFormData(record);
     setIsModalOpen(true);
  };
  
  const handleEditEcho = (record: EchoRecord) => {
    setEchoFormData(record);
    setIsEchoModalOpen(true);
  };

  const handleDelete = (id: string) => {
     if (window.confirm("Êtes-vous sûr de vouloir supprimer cet ECG ?")) {
        setEcgs(prev => prev.filter(e => e.id !== id));
     }
  };

  const handleDeleteEcho = (id: string) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cet Écho ?")) {
       setEchos(prev => prev.filter(e => e.id !== id));
    }
 };

  return (
    <div className="min-h-[500px] relative">
      {/* Header Page */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Cardiologie</h3>
          <p className="text-sm text-gray-500">Historique unifié des examens (ECG & Écho).</p>
        </div>
        
        <div className="flex gap-3">
             <button 
               onClick={() => { setFormData(INITIAL_ECG); setIsModalOpen(true); }}
               className="flex items-center space-x-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg transition-colors shadow-sm font-medium"
             >
               <Plus size={18} className="text-emerald-600" />
               <span>Nouvel ECG</span>
             </button>
            <button 
               onClick={() => { setEchoFormData(INITIAL_ECHO); setIsEchoModalOpen(true); }}
               className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm font-medium"
             >
               <Plus size={18} />
               <span>Nouvel Echo</span>
             </button>
        </div>
      </div>

      {/* --- COMBINED LIST VIEW --- */}
      {sortedRecords.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
            <Activity className="mx-auto h-12 w-12 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">Aucun examen enregistré.</p>
          </div>
      ) : (
          <div className="grid gap-6">
            {sortedRecords.map((record) => {
              if (record.entryType === 'ECG') {
                const ecg = record as ECGRecord;
                return (
                  <div key={`ecg-${ecg.id}`} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col">
                      <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${ecg.ischemia === 'Presente' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                <Activity size={20} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-gray-900 text-lg">{ecg.rhythm}</span>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-500 font-medium">{ecg.type}</span>
                                </div>
                                <div className="text-xs text-gray-500 flex items-center gap-2">
                                    <span>{new Date(ecg.date).toLocaleDateString()} à {ecg.time}</span>
                                    <span>•</span>
                                    <span>{ecg.speed} mm/s</span>
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-black text-slate-800">{ecg.fc || '--'} <span className="text-sm font-medium text-gray-400">bpm</span></div>
                        </div>
                    </div>

                    <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-6">
                        {/* Col 1 */}
                        <div className="md:col-span-4 space-y-3">
                            <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1"><Heart size={10}/> Rythme & Conduction</h5>
                            <div className="text-sm space-y-1">
                                <div className="flex justify-between border-b border-dashed border-gray-100 pb-1">
                                    <span className="text-gray-500">Régularité</span>
                                    <span className="font-medium text-gray-800">{ecg.regularity}</span>
                                </div>
                                <div className="flex justify-between border-b border-dashed border-gray-100 pb-1">
                                    <span className="text-gray-500">Ondes P</span>
                                    <span className="font-medium text-gray-800">{ecg.pWave}</span>
                                </div>
                                <div className="pt-2">
                                    {(!ecg.rhythmDisorders.includes('Aucun') || !ecg.conductionDisorders.includes('Aucun')) ? (
                                        <div className="flex flex-wrap gap-1">
                                            {ecg.rhythmDisorders.filter(x => x !== 'Aucun').map(t => <span key={t} className="px-1.5 py-0.5 bg-orange-50 text-orange-700 text-xs font-medium rounded border border-orange-100">{t}</span>)}
                                            {ecg.conductionDisorders.filter(x => x !== 'Aucun').map(t => <span key={t} className="px-1.5 py-0.5 bg-amber-50 text-amber-700 text-xs font-medium rounded border border-amber-100">{t}</span>)}
                                        </div>
                                    ) : (
                                        <span className="text-xs text-gray-400 italic">Aucun trouble du rythme ou de conduction notable.</span>
                                    )}
                                </div>
                            </div>
                        </div>
                        {/* Col 2 */}
                        <div className="md:col-span-4 space-y-3 border-l border-gray-100 md:pl-4">
                            <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1"><Ruler size={10}/> Mesures</h5>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div className="bg-gray-50 p-1.5 rounded text-center border border-gray-100">
                                    <span className="block text-[10px] text-gray-400 uppercase">PR</span>
                                    <span className="font-bold text-gray-800">{ecg.pr ? `${ecg.pr} ms` : '-'}</span>
                                </div>
                                <div className="bg-gray-50 p-1.5 rounded text-center border border-gray-100">
                                    <span className="block text-[10px] text-gray-400 uppercase">QRS</span>
                                    <span className="font-bold text-gray-800">{ecg.qrs ? `${ecg.qrs} ms` : '-'}</span>
                                </div>
                                <div className="bg-gray-50 p-1.5 rounded text-center border border-gray-100">
                                    <span className="block text-[10px] text-gray-400 uppercase">QT</span>
                                    <span className="font-bold text-gray-800">{ecg.qt ? `${ecg.qt} ms` : '-'}</span>
                                </div>
                                <div className={`p-1.5 rounded text-center border ${parseInt(ecg.qtc) > 480 ? 'bg-red-50 text-red-700 border-red-100' : 'bg-gray-50 text-gray-800 border-gray-100'}`}>
                                    <span className="block text-[10px] opacity-70 uppercase">QTc</span>
                                    <span className="font-bold">{ecg.qtc ? `${ecg.qtc} ms` : '-'}</span>
                                </div>
                            </div>
                            <div className="flex justify-between items-center bg-gray-50/50 p-2 rounded border border-gray-100 mt-2">
                                <div className="text-center flex-1">
                                    <span className="block text-[9px] text-gray-400 uppercase font-bold">Axe P</span>
                                    <span className="text-xs font-bold text-gray-700">{ecg.axisP ? `${ecg.axisP}°` : '-'}</span>
                                </div>
                                <div className="w-px h-6 bg-gray-200"></div>
                                <div className="text-center flex-1">
                                    <span className="block text-[9px] text-gray-400 uppercase font-bold">Axe QRS</span>
                                    <span className="text-xs font-bold text-gray-700">{ecg.axisQRS ? `${ecg.axisQRS}°` : '-'}</span>
                                </div>
                                <div className="w-px h-6 bg-gray-200"></div>
                                <div className="text-center flex-1">
                                    <span className="block text-[9px] text-gray-400 uppercase font-bold">Axe T</span>
                                    <span className="text-xs font-bold text-gray-700">{ecg.axisT ? `${ecg.axisT}°` : '-'}</span>
                                </div>
                            </div>
                        </div>
                        {/* Col 3 */}
                        <div className="md:col-span-4 space-y-3 border-l border-gray-100 md:pl-4">
                            <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1"><Zap size={10}/> Morphologie</h5>
                            {ecg.ischemia === 'Presente' ? (
                                <div className="bg-red-50 border border-red-100 rounded p-2">
                                    <div className="flex items-center text-red-700 font-bold text-xs mb-1"><AlertTriangle size={12} className="mr-1"/> {ecg.ischemiaType}</div>
                                    <div className="flex flex-wrap gap-1">{ecg.ischemiaLoc.map(l => <span key={l} className="text-[10px] bg-white px-1.5 py-0.5 rounded text-red-600 border border-red-100 font-medium">{l}</span>)}</div>
                                </div>
                            ) : (
                                <div className="text-xs text-gray-500 flex items-center py-1"><div className="w-2 h-2 rounded-full bg-emerald-400 mr-2 shadow-sm shadow-emerald-200"></div> Pas d'ischémie</div>
                            )}
                            {ecg.repolarization === 'Anomalie' && (
                                <div className="text-xs space-y-1 mt-2">
                                    {ecg.repolarizationDetails.map(d => <div key={d} className="text-orange-700 flex items-start"><span className="mr-1">•</span>{d}</div>)}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="bg-slate-50 px-4 py-3 border-t border-gray-200">
                        <div className="flex items-start gap-2">
                            <FileText size={16} className="text-slate-400 mt-0.5 shrink-0" />
                            <div className="flex-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Conclusion</span>
                                <p className="text-sm text-slate-800 font-medium leading-relaxed">{ecg.conclusion || <span className="italic text-gray-400">...</span>}</p>
                            </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center text-xs">
                            <div className="flex items-center gap-3">
                                <span className="bg-white border border-gray-200 px-2 py-0.5 rounded text-gray-600 font-medium flex items-center"><Stethoscope size={10} className="mr-1"/> Dr. {ecg.doctor}</span>
                            </div>
                            <div className="flex items-center gap-2">
                            {ecg.hasAttachment && <span className="text-indigo-600 font-bold flex items-center cursor-pointer hover:underline bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 mr-2"><Paperclip size={10} className="mr-1"/> PDF</span>}
                            <div className="flex items-center gap-1 border-l border-gray-200 pl-2">
                                <button onClick={() => handleEdit(ecg)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Modifier"><Pencil size={14} /></button>
                                <button onClick={() => handleDelete(ecg.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Supprimer"><Trash2 size={14} /></button>
                            </div>
                            </div>
                        </div>
                    </div>
                  </div>
                );
              } else {
                const echo = record as EchoRecord;
                return (
                  <div key={`echo-${echo.id}`} className="bg-white rounded-xl border border-indigo-100 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col">
                    <div className="bg-indigo-50/50 px-4 py-3 border-b border-indigo-100 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600">
                            <Waves size={20} />
                          </div>
                          <div>
                              <div className="flex items-center gap-2">
                                  <span className="font-bold text-gray-900 text-lg">Echo {echo.type}</span>
                                  {parseFloat(echo.fevg) < 40 && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200 font-bold">FEVG {echo.fevg}%</span>}
                              </div>
                              <div className="text-xs text-gray-500 flex items-center gap-2">
                                  <span>{new Date(echo.date).toLocaleDateString()} à {echo.time}</span>
                              </div>
                          </div>
                      </div>
                      <div className="text-right">
                          <div className="text-2xl font-black text-indigo-900">{echo.fevg || '--'} <span className="text-sm font-medium text-gray-400">%</span></div>
                          <span className="text-[10px] text-gray-400 uppercase font-bold">FEVG</span>
                      </div>
                    </div>

                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                          <h6 className="text-[10px] font-bold text-gray-400 uppercase mb-2">Ventricule Gauche</h6>
                          <div className="space-y-1">
                            <div className="flex justify-between"><span>DTD</span> <span className="font-bold">{echo.dtd_vg || '-'} mm</span></div>
                            <div className="flex justify-between"><span>SIV</span> <span className="font-bold">{echo.siv || '-'} mm</span></div>
                            <div className="flex justify-between"><span>PP</span> <span className="font-bold">{echo.pp || '-'} mm</span></div>
                          </div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                          <h6 className="text-[10px] font-bold text-gray-400 uppercase mb-2">Ventricule Droit</h6>
                          <div className="space-y-1">
                            <div className="flex justify-between"><span>TAPSE</span> <span className={`font-bold ${parseFloat(echo.tapse) < 17 ? 'text-red-600' : ''}`}>{echo.tapse || '-'} mm</span></div>
                            <div className="flex justify-between"><span>Fonction</span> <span className="font-bold">{echo.fonctionVD}</span></div>
                            <div className="flex justify-between"><span>PAPS</span> <span className="font-bold">{echo.paps || '-'} mmHg</span></div>
                          </div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 col-span-1 md:col-span-2">
                          <h6 className="text-[10px] font-bold text-gray-400 uppercase mb-2">Valves & Morpho</h6>
                          <div className="flex flex-wrap gap-2">
                            {(Object.entries(echo.valves) as [string, ValveStatus][]).map(([key, val]) => (
                                val.status === 'Pathologique' && (
                                  <span key={key} className="px-2 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded text-xs font-medium capitalize">
                                    {key}: {val.type.join(', ')} ({val.severity})
                                  </span>
                                )
                            ))}
                            {echo.pericarde !== 'Sec' && <span className="px-2 py-1 bg-blue-50 text-blue-800 border border-blue-200 rounded text-xs font-medium">{echo.pericarde}</span>}
                            {echo.thrombus && <span className="px-2 py-1 bg-red-50 text-red-800 border border-red-200 rounded text-xs font-bold">Thrombus !</span>}
                          </div>
                      </div>
                    </div>
                    
                    <div className="bg-slate-50 px-4 py-3 border-t border-indigo-100">
                        <p className="text-sm text-slate-800 font-medium leading-relaxed mb-3">
                            <span className="font-bold text-indigo-900 mr-2">Conclusion:</span>
                            {echo.conclusion}
                        </p>
                        <div className="flex justify-between items-center text-xs border-t border-gray-200 pt-2">
                            <span className="font-bold text-gray-500">Dr. {echo.doctor}</span>
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleEditEcho(echo)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"><Pencil size={14} /></button>
                              <button onClick={() => handleDeleteEcho(echo.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={14} /></button>
                            </div>
                        </div>
                    </div>
                  </div>
                );
              }
            })}
          </div>
      )}

      {/* --- ECG MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-2 lg:p-4">
          <div className="bg-gray-50 w-[98vw] lg:w-[95vw] h-[95vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
             {/* ... (Existing ECG Modal Content) ... */}
             <div className="bg-white border-b border-gray-200 px-4 py-3 shrink-0 flex flex-col md:flex-row items-center justify-between gap-4">
               <div className="flex items-center gap-4 w-full md:w-auto">
                 <div className="flex items-center gap-2 shrink-0">
                    <div className="bg-emerald-600 p-1.5 rounded text-white"><Activity size={18} /></div>
                    <h2 className="text-lg font-bold text-gray-800 tracking-tight hidden sm:block">Saisie ECG</h2>
                 </div>
                 {/* Quick Context Bar */}
                 <div className="flex items-center gap-3 md:pl-4 md:border-l border-gray-200 flex-1 md:flex-initial overflow-x-auto py-1">
                    <div className="flex items-center bg-white border border-gray-200 rounded-lg p-1 pr-3 shadow-sm shrink-0">
                       <div className="bg-indigo-100 p-1.5 rounded text-indigo-700 mr-2"><CalendarClock size={16} strokeWidth={2.5} /></div>
                       <div className="flex items-center gap-2">
                           <input type="date" value={formData.date} onChange={(e) => handleInputChange('date', e.target.value)} className="bg-transparent border-none p-0 text-sm font-bold text-gray-900 w-24 sm:w-28 focus:ring-0" />
                           <span className="text-gray-300">|</span>
                           <input type="time" value={formData.time} onChange={(e) => handleInputChange('time', e.target.value)} className="bg-transparent border-none p-0 text-sm font-bold text-gray-900 w-16 sm:w-20 focus:ring-0" />
                       </div>
                    </div>
                 </div>
               </div>
               <div className="flex items-center gap-3">
                 <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-800 p-1"><X size={24} /></button>
               </div>
             </div>

             <div className="flex-1 overflow-y-auto p-4 lg:p-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
                  {/* ECG Form Layout (Condensed for brevity, same as previous implementation) */}
                  <div className="lg:col-span-3 flex flex-col gap-4">
                     <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex-1">
                        <SectionTitle icon={Heart} title="Rythme & Conduction" colorClass="text-rose-500" />
                        <div className="space-y-5">
                           <ToggleGroup label="Rythme Dominant" value={formData.rhythm} onChange={(v) => handleInputChange('rhythm', v)} options={[{label: 'Sinusal', value: 'Sinusal'}, {label: 'Atrial', value: 'Atrial'}, {label: 'Jonct.', value: 'Jonctionnel'}, {label: 'Vent.', value: 'Ventriculaire'}]} />
                           <div className="grid grid-cols-2 gap-3">
                              <ToggleGroup label="Régularité" value={formData.regularity} onChange={(v) => handleInputChange('regularity', v)} options={[{label: 'Régulier', value: 'Regulier'}, {label: 'Irrég.', value: 'Irregulier'}]} disabledOptions={getDisabledRegularity()}/>
                              <ToggleGroup label="Ondes P" value={formData.pWave} onChange={(v) => handleInputChange('pWave', v)} options={[{label: 'Présentes', value: 'Presentes'}, {label: 'Abs.', value: 'Absentes'}]} disabledOptions={getDisabledPWave()}/>
                           </div>
                           <div className="pt-4 border-t border-gray-100"><MultiSelectPill label="Troubles du Rythme" options={['Aucun', 'FA', 'Flutter', 'ESA', 'TSV', 'ESV', 'TV', 'Bradycardie']} selectedValues={formData.rhythmDisorders} onChange={(vals) => handleInputChange('rhythmDisorders', vals)} disabledOptions={getDisabledRhythmDisorders()}/></div>
                           <div className="pt-4 border-t border-gray-100"><MultiSelectPill label="Troubles de Conduction" options={['Aucun', 'BAV I', 'BAV II', 'BAV III', 'BBD', 'BBG', 'Hémibloc']} selectedValues={formData.conductionDisorders} onChange={(vals) => handleInputChange('conductionDisorders', vals)} disabledOptions={getDisabledConduction()}/></div>
                        </div>
                     </div>
                  </div>
                  <div className="lg:col-span-5 flex flex-col gap-4">
                     <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <SectionTitle icon={Ruler} title="Mesures & Axes" colorClass="text-indigo-600" compact />
                        {/* Modified Input Grid to Prevent Collapsing */}
                        <div className="flex gap-2 mb-4 bg-indigo-50/30 p-2 rounded-lg border border-indigo-50/50 overflow-x-auto">
                           <MetricInput label="FC (bpm)" value={formData.fc} onChange={(v) => handleInputChange('fc', v)} />
                           <div className="w-px bg-indigo-100 mx-1 shrink-0"></div>
                           <MetricInput label="PR (ms)" value={formData.pr} onChange={(v) => handleInputChange('pr', v)} />
                           <MetricInput label="QRS (ms)" value={formData.qrs} onChange={(v) => handleInputChange('qrs', v)} />
                           <MetricInput label="QT (ms)" value={formData.qt} onChange={(v) => handleInputChange('qt', v)} />
                           <MetricInput label="QTc (ms)" value={formData.qtc} onChange={(v) => handleInputChange('qtc', v)} highlight warning={parseInt(formData.qtc) > 480} />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                           <MetricInput compact label="Axe P" unit="°" value={formData.axisP} onChange={(v) => handleInputChange('axisP', v)} />
                           <MetricInput compact label="Axe QRS" unit="°" value={formData.axisQRS} onChange={(v) => handleInputChange('axisQRS', v)} />
                           <MetricInput compact label="Axe T" unit="°" value={formData.axisT} onChange={(v) => handleInputChange('axisT', v)} />
                        </div>
                     </div>
                     <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex-1">
                        <SectionTitle icon={Activity} title="Morphologie" colorClass="text-emerald-600" />
                        <div className="space-y-4">
                           <ToggleGroup label="Segment ST & Onde T" value={formData.repolarization} onChange={(v) => {handleInputChange('repolarization', v); if(v === 'Normal') handleInputChange('repolarizationDetails', []);}} options={[{label: 'Normal / Isoélectrique', value: 'Normal'}, {label: 'Anomalie Présente', value: 'Anomalie'}]}/>
                           {formData.repolarization === 'Anomalie' && (<div className="bg-orange-50 p-3 rounded-lg border border-orange-100"><MultiSelectPill noneValue="" options={['Sus-décalage ST', 'Sous-décalage ST', 'Onde T négative', 'Onde T ample', 'Miroir']} selectedValues={formData.repolarizationDetails} onChange={(vals) => handleInputChange('repolarizationDetails', vals)}/></div>)}
                        </div>
                     </div>
                  </div>
                  <div className="lg:col-span-4 flex flex-col gap-4">
                     <div className={`p-4 rounded-xl border transition-all duration-300 ${formData.ischemia === 'Presente' ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200 shadow-sm'}`}>
                        <div className="flex justify-between items-center mb-3">
                           <SectionTitle icon={Zap} title="Ischémie" colorClass={formData.ischemia === 'Presente' ? 'text-red-600' : 'text-gray-400'} compact />
                           <input type="checkbox" checked={formData.ischemia === 'Presente'} onChange={(e) => handleInputChange('ischemia', e.target.checked ? 'Presente' : 'Aucune')} className="h-5 w-5 text-red-600" />
                        </div>
                        {formData.ischemia === 'Presente' && (
                          <div className="space-y-3">
                             <ToggleGroup compact value={formData.ischemiaType || ''} onChange={(v) => handleInputChange('ischemiaType', v)} options={[{label: 'SCA ST+', value: 'SCA ST+'}, {label: 'SCA ST-', value: 'SCA ST-'}, {label: 'Ancien', value: 'Infarctus ancien'}]} />
                             <MultiSelectPill noneValue="" label="Topographie" options={['Antérieur', 'Inférieur', 'Latéral', 'Postérieur', 'Septal', 'Apicale', 'VD']} selectedValues={formData.ischemiaLoc} onChange={(vals) => handleInputChange('ischemiaLoc', vals)}/>
                          </div>
                        )}
                     </div>
                     <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col flex-1 min-h-[250px]">
                        <SectionTitle icon={FileText} title="Conclusion" colorClass="text-slate-800" compact />
                        <textarea value={formData.conclusion} onChange={(e) => handleInputChange('conclusion', e.target.value)} className="w-full flex-1 rounded-lg p-3 text-sm focus:ring-2 focus:ring-emerald-500 border-gray-300 resize-none bg-yellow-50/30 text-gray-900 focus:bg-white transition-colors" placeholder="Rédigez votre conclusion..." />
                     </div>
                  </div>
                </div>
             </div>
             
             <div className="bg-white border-t border-gray-200 px-6 py-4 flex justify-end items-center shrink-0 gap-3">
                  <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Annuler</button>
                  <button onClick={handleSave} disabled={validation.errors.length > 0} className={`px-8 py-2.5 text-sm font-bold text-white rounded-lg shadow-lg ${validation.errors.length > 0 ? 'bg-gray-400' : 'bg-slate-900 hover:bg-black'}`}>Valider</button>
             </div>
          </div>
        </div>
      )}

      {/* --- ECHO MODAL --- */}
      {isEchoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-indigo-900/80 backdrop-blur-sm p-2 lg:p-4">
          <div className="bg-gray-50 w-[98vw] lg:w-[95vw] h-[95vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-4 py-3 shrink-0 flex flex-col md:flex-row items-center justify-between gap-4">
               <div className="flex items-center gap-4">
                 <div className="bg-indigo-600 p-1.5 rounded text-white"><Waves size={18} /></div>
                 <h2 className="text-lg font-bold text-gray-800">Nouvelle Échocardiographie</h2>
                 <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200">
                   <input type="date" value={echoFormData.date} onChange={(e) => handleEchoInputChange('date', e.target.value)} className="bg-transparent border-none text-xs font-bold text-gray-700 w-24 p-0 focus:ring-0" />
                   <div className="w-px h-4 bg-gray-300 mx-2"></div>
                   <input type="time" value={echoFormData.time} onChange={(e) => handleEchoInputChange('time', e.target.value)} className="bg-transparent border-none text-xs font-bold text-gray-700 w-16 p-0 focus:ring-0" />
                 </div>
               </div>
               <button onClick={() => setIsEchoModalOpen(false)} className="text-gray-400 hover:text-gray-800"><X size={24}/></button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 lg:p-6 bg-slate-50/50">
               <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
                 
                 {/* Left Column (Type & VG) */}
                 <div className="lg:col-span-4 space-y-6">
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                       <SectionTitle icon={ScanLine} title="Type d'examen" colorClass="text-indigo-600" />
                       <ToggleGroup 
                          options={[{label:'ETT', value:'ETT'}, {label:'ETO', value:'ETO'}, {label:'Stress', value:'Stress'}, {label:'POCUS', value:'POCUS'}]}
                          value={echoFormData.type}
                          onChange={(v) => handleEchoInputChange('type', v)}
                       />
                       {echoFormData.type !== 'POCUS' && (
                         <div className="mt-4">
                            <MultiSelectPill label="Modalités" options={['Doppler Couleur', 'Doppler Pulsé', 'Doppler Continu', '3D']} selectedValues={echoFormData.modalities} onChange={(v) => handleEchoInputChange('modalities', v)} />
                         </div>
                       )}
                    </div>

                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                       <SectionTitle icon={Maximize2} title="Ventricule Gauche" colorClass="text-rose-600" />
                       <div className="space-y-4">
                          <div className="flex gap-4 items-center bg-rose-50 p-3 rounded-lg border border-rose-100">
                             <div className="flex-1">
                                <label className="text-xs font-bold text-rose-800 uppercase block mb-1">FEVG (%)</label>
                                <input type="range" min="10" max="80" step="5" value={echoFormData.fevg || 60} onChange={(e) => handleEchoInputChange('fevg', e.target.value)} className="w-full accent-rose-600" />
                             </div>
                             <input type="number" value={echoFormData.fevg} onChange={(e) => handleEchoInputChange('fevg', e.target.value)} className="w-16 p-1 text-center font-bold text-rose-900 border-rose-200 rounded" placeholder="%" />
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                             <MetricInput label="DTD (mm)" value={echoFormData.dtd_vg} onChange={(v) => handleEchoInputChange('dtd_vg', v)} />
                             {!isEchoFieldHidden('dtd_index') && <MetricInput label="DTD Indexé" value={echoFormData.dtd_index || ''} onChange={(v) => handleEchoInputChange('dtd_index', v)} unit="mm/m²" />}
                             <MetricInput label="SIV (mm)" value={echoFormData.siv} onChange={(v) => handleEchoInputChange('siv', v)} />
                             <MetricInput label="PP (mm)" value={echoFormData.pp} onChange={(v) => handleEchoInputChange('pp', v)} />
                          </div>

                          {!isEchoFieldHidden('gls') && (
                             <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                                <MetricInput label="GLS (%)" value={echoFormData.gls || ''} onChange={(v) => handleEchoInputChange('gls', v)} />
                                <MetricInput label="MAPSE (mm)" value={echoFormData.mapse || ''} onChange={(v) => handleEchoInputChange('mapse', v)} />
                             </div>
                          )}
                          
                          <div className="pt-2">
                             <span className="text-xs font-bold text-gray-500 uppercase block mb-1">Hypertrophie (HVG)</span>
                             <ToggleGroup options={[{label:'Absente', value:'Absente'}, {label:'Modérée', value:'Modérée'}, {label:'Sévère', value:'Sévère'}]} value={echoFormData.hvg} onChange={(v) => handleEchoInputChange('hvg', v)} compact />
                          </div>
                       </div>
                    </div>
                 </div>

                 {/* Middle Column (VD, Atria, Pressures) */}
                 <div className="lg:col-span-4 space-y-6">
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                       <SectionTitle icon={Minimize2} title="Ventricule Droit" colorClass="text-blue-600" />
                       <div className="grid grid-cols-2 gap-4 mb-4">
                          <MetricInput label="TAPSE (mm)" value={echoFormData.tapse} onChange={(v) => handleEchoInputChange('tapse', v)} warning={parseInt(echoFormData.tapse) < 17} />
                          <MetricInput label="PAPS (mmHg)" value={echoFormData.paps} onChange={(v) => handleEchoInputChange('paps', v)} />
                       </div>
                       <div className="space-y-3">
                          <div>
                            <span className="text-xs font-bold text-gray-500 uppercase block mb-1">Fonction VD</span>
                            <ToggleGroup options={[{label:'Normale', value:'Normale'}, {label:'Altérée', value:'Altérée'}]} value={echoFormData.fonctionVD} onChange={(v) => handleEchoInputChange('fonctionVD', v)} compact />
                          </div>
                          <div>
                             <span className="text-xs font-bold text-gray-500 uppercase block mb-1">VCI</span>
                             <select className="w-full text-sm border-gray-300 rounded-md" value={echoFormData.vci} onChange={(e) => handleEchoInputChange('vci', e.target.value)}>
                                <option value="Normale">Normale et collabable</option>
                                <option value="Dilatée">Dilatée</option>
                                <option value="Peu Collabable">Peu collabable</option>
                             </select>
                          </div>
                       </div>
                    </div>

                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                       <SectionTitle icon={ArrowRightLeft} title="Oreillettes" colorClass="text-purple-600" />
                       <div className="grid grid-cols-2 gap-4">
                          <div>
                             <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">OG (Gauche)</span>
                             <ToggleGroup options={[{label:'Norm.', value:'Normale'}, {label:'Dilat.', value:'Dilatée'}]} value={echoFormData.og_taille} onChange={(v) => handleEchoInputChange('og_taille', v)} compact />
                          </div>
                          <div>
                             <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">OD (Droite)</span>
                             <ToggleGroup options={[{label:'Norm.', value:'Normale'}, {label:'Dilat.', value:'Dilatée'}]} value={echoFormData.od_taille} onChange={(v) => handleEchoInputChange('od_taille', v)} compact />
                          </div>
                       </div>
                    </div>
                 </div>

                 {/* Right Column (Valves & Conclusion) */}
                 <div className="lg:col-span-4 space-y-6">
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                       <SectionTitle icon={Activity} title="Valves" colorClass="text-emerald-600" />
                       <div className="space-y-4">
                          {['mitrale', 'aortique', 'tricuspide', 'pulmonaire'].map((vKey) => {
                             const valve = echoFormData.valves[vKey as keyof typeof echoFormData.valves];
                             const isPatho = valve.status === 'Pathologique';
                             return (
                               <div key={vKey} className={`rounded-lg border p-2 transition-all ${isPatho ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100'}`}>
                                  <div className="flex justify-between items-center mb-1">
                                     <span className="text-xs font-bold uppercase text-gray-700">{vKey}</span>
                                     <button 
                                        onClick={() => handleValveChange(vKey as any, 'status', isPatho ? 'Normale' : 'Pathologique')}
                                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isPatho ? 'bg-amber-200 text-amber-800' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'}`}
                                     >
                                        {isPatho ? 'Pathologique' : 'Normale'}
                                     </button>
                                  </div>
                                  {isPatho && (
                                     <div className="mt-2 space-y-2 animate-in fade-in">
                                        <MultiSelectPill options={['Insuffisance', 'Rétrécissement', 'Maladie']} selectedValues={valve.type} onChange={(val) => handleValveChange(vKey as any, 'type', val)} label="Type" />
                                        <ToggleGroup options={[{label:'Minime', value:'Minime'}, {label:'Modérée', value:'Modérée'}, {label:'Sévère', value:'Sévère'}]} value={valve.severity} onChange={(val) => handleValveChange(vKey as any, 'severity', val)} compact />
                                     </div>
                                  )}
                               </div>
                             );
                          })}
                       </div>
                    </div>

                    <div className="bg-indigo-50 p-5 rounded-xl border border-indigo-100 shadow-sm flex flex-col h-[300px]">
                       <SectionTitle icon={FileText} title="Conclusion" colorClass="text-indigo-800" />
                       <textarea 
                          value={echoFormData.conclusion} 
                          onChange={(e) => handleEchoInputChange('conclusion', e.target.value)}
                          className="flex-1 w-full p-3 rounded-lg border-indigo-200 bg-white text-sm focus:ring-2 focus:ring-indigo-500 resize-none"
                          placeholder="Synthèse de l'examen..."
                       />
                       {echoValidation.errors.length > 0 && (
                          <div className="mt-3 bg-red-100 text-red-700 text-xs p-2 rounded border border-red-200 font-medium">
                             {echoValidation.errors[0]}
                          </div>
                       )}
                    </div>
                 </div>

               </div>
            </div>

            {/* Footer */}
            <div className="bg-white border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
               <button onClick={() => setIsEchoModalOpen(false)} className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Annuler</button>
               <button onClick={handleSaveEcho} disabled={echoValidation.errors.length > 0} className={`px-8 py-2.5 text-sm font-bold text-white rounded-lg shadow-lg ${echoValidation.errors.length > 0 ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}>Valider</button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};