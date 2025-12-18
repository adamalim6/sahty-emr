import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, X, Save, Activity, Heart, Ruler, Scale, Wind, 
  Check, TriangleAlert, Thermometer, Weight, Gauge, 
  Calculator, Scan, Stethoscope 
} from 'lucide-react';
import { Patient } from '../../types';
import { calculateAge } from '../../constants';

// --- Types & Interfaces ---

interface ClinicalExam {
  id: string;
  date: string;
  // General
  temperature: string;
  weight: string;
  height: string;
  bmi: string; // IMC
  bsa: string; // Surface Corporelle
  pulse: string;
  sao2: string;
  sysBP: string; // TA Max
  diaBP: string; // TA Min
  // Specific
  conjunctiva: string;
  hippocratisme: boolean;
  hippocratismeComment: string;
  // Heart
  souffleType: string;
  souffleLocation: string;
  souffleGrade: string;
  // Failure Signs
  failureSigns: string[];
}

const INITIAL_FORM_STATE: ClinicalExam = {
  id: '',
  date: '',
  temperature: '',
  weight: '',
  height: '',
  bmi: '',
  bsa: '',
  pulse: '',
  sao2: '',
  sysBP: '',
  diaBP: '',
  conjunctiva: 'normale',
  hippocratisme: false,
  hippocratismeComment: '',
  souffleType: 'Aucun souffle détecté',
  souffleLocation: '',
  souffleGrade: '1/6',
  failureSigns: [],
};

// --- Configuration for Smart Inputs ---

interface ParamConfig {
  min: number;
  max: number;
  safeMin: number;
  safeMax: number;
  step: number;
  label: string;
  unit: string;
}

// Generate configuration based on age
const getParamConfig = (age: number): Record<string, ParamConfig> => {
  // Default (Adult/Adolescent > 12)
  let config: Record<string, ParamConfig> = {
      temperature: { min: 34, max: 43, safeMin: 36.1, safeMax: 37.8, step: 0.1, label: "Température", unit: "°C" },
      weight: { min: 30, max: 200, safeMin: 45, safeMax: 120, step: 0.5, label: "Poids", unit: "kg" },
      height: { min: 100, max: 230, safeMin: 150, safeMax: 200, step: 1, label: "Taille", unit: "cm" },
      pulse: { min: 30, max: 200, safeMin: 50, safeMax: 100, step: 1, label: "Pouls", unit: "bpm" },
      sao2: { min: 70, max: 100, safeMin: 90, safeMax: 100, step: 1, label: "SaO₂", unit: "%" },
      sysBP: { min: 70, max: 220, safeMin: 90, safeMax: 140, step: 1, label: "TA Max (Sys)", unit: "mmHg" },
      diaBP: { min: 30, max: 130, safeMin: 60, safeMax: 90, step: 1, label: "TA Min (Dia)", unit: "mmHg" },
  };

  if (age <= 2) {
    // Infant / Toddler
    config.weight = { min: 2, max: 20, safeMin: 3, safeMax: 15, step: 0.1, label: "Poids", unit: "kg" };
    config.height = { min: 40, max: 100, safeMin: 45, safeMax: 90, step: 0.5, label: "Taille", unit: "cm" };
    config.pulse = { min: 60, max: 200, safeMin: 80, safeMax: 160, step: 1, label: "Pouls", unit: "bpm" };
    config.sysBP = { min: 50, max: 120, safeMin: 70, safeMax: 100, step: 1, label: "TA Max (Sys)", unit: "mmHg" };
    config.diaBP = { min: 30, max: 80, safeMin: 40, safeMax: 60, step: 1, label: "TA Min (Dia)", unit: "mmHg" };
  } else if (age <= 12) {
    // Child
    config.weight = { min: 10, max: 80, safeMin: 15, safeMax: 60, step: 0.5, label: "Poids", unit: "kg" };
    config.height = { min: 80, max: 160, safeMin: 90, safeMax: 150, step: 1, label: "Taille", unit: "cm" };
    config.pulse = { min: 50, max: 160, safeMin: 70, safeMax: 120, step: 1, label: "Pouls", unit: "bpm" };
    config.sysBP = { min: 70, max: 140, safeMin: 80, safeMax: 120, step: 1, label: "TA Max (Sys)", unit: "mmHg" };
    config.diaBP = { min: 40, max: 90, safeMin: 50, safeMax: 80, step: 1, label: "TA Min (Dia)", unit: "mmHg" };
  }

  return config;
};

// --- Options Constants ---

const SOUFFLE_OPTIONS = [
  'Aucun souffle détecté',
  'Souffle systolique d’éjection',
  'Souffle systolique holosystolique',
  'Souffle systolique télésystolique',
  'Souffle diastolique de régurgitation',
  'Roulement diastolique',
  'Souffle continu',
];

const LOCALISATION_OPTIONS = ['Aortique', 'Pulmonaire', 'Tricuspide', 'Mitrale'];

const FAILURE_SIGNS_OPTIONS = [
  'Dyspnée (effort)',
  'Dyspnée (repos)',
  'Orthopnée',
  'Dyspnée paroxystique nocturne',
  'Râles crépitants',
  'Tachycardie',
  'Turgescence jugulaire',
  'Reflux hépato-jugulaire',
  'Galop B3',
  'Œdèmes des membres inférieurs',
  'Ascite',
  'Hépatomégalie',
  'Prise de poids rapide',
  'Fatigue marquée',
  'Extrémités froides / marbrures',
];

// --- Sub Components ---

const SmartParamInput = ({ 
  config, 
  name, 
  value, 
  onChange 
}: { 
  config: ParamConfig, 
  name: string, 
  value: string, 
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void 
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
        {/* Slider Container */}
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

        {/* Input Field */}
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

const DataCard = ({ icon: Icon, label, value, unit, colorClass = "text-gray-900" }: { icon: any, label: string, value: string, unit?: string, colorClass?: string }) => (
  <div className="bg-gray-50 rounded-xl p-4 flex flex-col items-center justify-center text-center border border-gray-100 hover:border-gray-200 transition-colors h-32">
    <div className="mb-2 text-gray-400">
      <Icon size={24} />
    </div>
    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</span>
    <div className={`text-xl font-bold ${colorClass} flex items-baseline`}>
      {value || "--"}
      {unit && <span className="ml-1 text-sm font-medium text-gray-500">{unit}</span>}
    </div>
  </div>
);

// --- Main Component ---

interface ExamenCliniqueProps {
  patient: Patient;
}

export const ExamenClinique: React.FC<ExamenCliniqueProps> = ({ patient }) => {
  const [exams, setExams] = useState<ClinicalExam[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<ClinicalExam>(INITIAL_FORM_STATE);

  // Calculate age-based configuration
  const age = useMemo(() => calculateAge(patient.dateOfBirth), [patient.dateOfBirth]);
  const config = useMemo(() => getParamConfig(age), [age]);

  // Calculations
  useEffect(() => {
    const w = parseFloat(formData.weight);
    const h = parseFloat(formData.height);

    if (!isNaN(w) && !isNaN(h) && h > 0) {
      // BMI = kg / m^2
      const hM = h / 100;
      const bmiVal = (w / (hM * hM)).toFixed(2);
      
      // BSA (Du Bois) = 0.007184 * W^0.425 * H^0.725
      const bsaVal = (0.007184 * Math.pow(w, 0.425) * Math.pow(h, 0.725)).toFixed(2);

      setFormData(prev => ({ ...prev, bmi: bmiVal, bsa: bsaVal }));
    }
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

  const toggleFailureSign = (sign: string) => {
    setFormData(prev => {
      const exists = prev.failureSigns.includes(sign);
      if (exists) {
        return { ...prev, failureSigns: prev.failureSigns.filter(s => s !== sign) };
      } else {
        return { ...prev, failureSigns: [...prev.failureSigns, sign] };
      }
    });
  };

  const handleSave = () => {
    const newExam = {
      ...formData,
      id: Date.now().toString(),
      date: new Date().toISOString(),
    };
    setExams([newExam, ...exams]);
    setIsModalOpen(false);
    setFormData(INITIAL_FORM_STATE);
  };

  const renderExamCard = (exam: ClinicalExam) => (
    <div key={exam.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
        <div className="flex items-center space-x-2">
           <Activity className="text-emerald-600" size={20} />
           <h4 className="font-bold text-gray-900">Examen du {new Date(exam.date).toLocaleDateString('fr-FR')} à {new Date(exam.date).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}</h4>
        </div>
        <span className="text-sm bg-white px-3 py-1 rounded-full border border-gray-200 text-gray-600 shadow-sm">Dr. Alami</span>
      </div>
      
      <div className="p-6">
        {/* Constantes Grid */}
        <div className="mb-8">
          <h5 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center">
            <Scale className="mr-2" size={16} /> Constantes
          </h5>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DataCard icon={Gauge} label="TA Sys/Dia" value={`${exam.sysBP}/${exam.diaBP}`} unit="mmHg" />
            <DataCard icon={Heart} label="Pouls" value={exam.pulse} unit="bpm" colorClass="text-red-600" />
            <DataCard icon={Wind} label="SaO₂" value={exam.sao2} unit="%" colorClass="text-blue-600" />
            <DataCard icon={Thermometer} label="Température" value={exam.temperature} unit="°C" colorClass={parseFloat(exam.temperature) > 37.8 ? "text-orange-600" : "text-gray-900"} />
            <DataCard icon={Weight} label="Poids" value={exam.weight} unit="kg" />
            <DataCard icon={Ruler} label="Taille" value={exam.height} unit="cm" />
            <DataCard icon={Calculator} label="IMC" value={exam.bmi} colorClass="text-indigo-600" />
            <DataCard icon={Scan} label="Surface Corp." value={exam.bsa} unit="m²" colorClass="text-indigo-600" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           {/* Cardiovasculaire */}
           <div className="bg-white rounded-lg p-5 border border-gray-100 shadow-sm">
             <h5 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center">
               <Stethoscope className="mr-2" size={16} /> Cardiovasculaire
             </h5>
             <div className="space-y-4">
                <div>
                  <span className="text-sm text-gray-500 block mb-1">Souffle Cardiaque</span>
                  <p className="text-gray-900 font-medium text-lg">{exam.souffleType}</p>
                  {exam.souffleType !== 'Aucun souffle détecté' && (
                    <p className="text-sm text-gray-600 mt-1">
                      {exam.souffleLocation} - Grade {exam.souffleGrade}
                    </p>
                  )}
                </div>
                
                {exam.failureSigns.length > 0 && (
                   <div>
                     <span className="text-sm text-gray-500 block mb-2">Signes d'insuffisance</span>
                     <div className="flex flex-wrap gap-2">
                       {exam.failureSigns.map(sign => (
                         <span key={sign} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-red-50 text-red-700 border border-red-100">
                           {sign}
                         </span>
                       ))}
                     </div>
                   </div>
                )}
                 {exam.failureSigns.length === 0 && (
                  <p className="text-sm text-gray-400 italic">Aucun signe d'insuffisance cardiaque relevé.</p>
                )}
             </div>
           </div>

           {/* Examen Spécifique */}
           <div className="bg-white rounded-lg p-5 border border-gray-100 shadow-sm">
              <h5 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center">
               <Scan className="mr-2" size={16} /> Examen Spécifique
             </h5>
             <div className="space-y-4">
                <div className="flex justify-between border-b border-gray-50 pb-2">
                  <span className="text-gray-600">Conjonctives</span>
                  <span className="font-semibold text-gray-900 capitalize">{exam.conjunctiva}</span>
                </div>
                <div>
                   <div className="flex justify-between items-center mb-1">
                      <span className="text-gray-600">Hippocratisme digital</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${exam.hippocratisme ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-600'}`}>
                        {exam.hippocratisme ? 'OUI' : 'NON'}
                      </span>
                   </div>
                   {exam.hippocratisme && (
                     <p className="text-sm bg-gray-50 p-3 rounded-lg text-gray-700 mt-2 border border-gray-100">
                       {exam.hippocratismeComment}
                     </p>
                   )}
                </div>
             </div>
           </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative min-h-[500px]">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-800">Historique des Examens</h3>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm font-medium"
        >
          <Plus size={18} />
          <span>Ajouter</span>
        </button>
      </div>

      {exams.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
          <Activity className="mx-auto h-12 w-12 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Aucun examen clinique enregistré.</p>
          <p className="text-sm text-gray-400">Cliquez sur "Ajouter" pour créer un nouveau rapport.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {exams.map(renderExamCard)}
        </div>
      )}

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <div className="flex items-center space-x-2">
                 <Activity className="text-emerald-600" />
                 <h3 className="text-xl font-bold text-gray-900">Nouvel Examen Clinique</h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-8 bg-gray-50/50">
              
              {/* Paramètres Généraux */}
              <section>
                 <h4 className="text-sm font-bold text-indigo-600 uppercase tracking-wider mb-4 flex items-center">
                   <Scale size={18} className="mr-2" /> Paramètres Généraux
                 </h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <SmartParamInput config={config.temperature} name="temperature" value={formData.temperature} onChange={handleInputChange} />
                    <SmartParamInput config={config.weight} name="weight" value={formData.weight} onChange={handleInputChange} />
                    <SmartParamInput config={config.height} name="height" value={formData.height} onChange={handleInputChange} />
                    
                    {/* Calculated Fields Display */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex flex-col justify-center">
                        <span className="text-xs font-bold text-indigo-400 uppercase">IMC (Calculé)</span>
                        <span className="text-2xl font-bold text-indigo-900">{formData.bmi || "--"}</span>
                      </div>
                      <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex flex-col justify-center">
                        <span className="text-xs font-bold text-indigo-400 uppercase">Surface (m²)</span>
                        <span className="text-2xl font-bold text-indigo-900">{formData.bsa || "--"}</span>
                      </div>
                    </div>

                    <SmartParamInput config={config.pulse} name="pulse" value={formData.pulse} onChange={handleInputChange} />
                    <SmartParamInput config={config.sao2} name="sao2" value={formData.sao2} onChange={handleInputChange} />
                    <SmartParamInput config={config.sysBP} name="sysBP" value={formData.sysBP} onChange={handleInputChange} />
                    <SmartParamInput config={config.diaBP} name="diaBP" value={formData.diaBP} onChange={handleInputChange} />
                 </div>
              </section>

              {/* Examen Spécifique */}
              <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                 <h4 className="text-sm font-bold text-indigo-600 uppercase tracking-wider mb-4 flex items-center">
                   <Scan size={18} className="mr-2" /> Examen Spécifique
                 </h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">État des conjonctives</label>
                      <select 
                        name="conjunctiva" 
                        value={formData.conjunctiva} 
                        onChange={handleInputChange}
                        className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 bg-white text-gray-900"
                      >
                        <option value="normale">Normale</option>
                        <option value="pâle">Pâle</option>
                        <option value="congestive">Congestive</option>
                        <option value="ictérique">Ictérique</option>
                      </select>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                       <div className="flex items-center justify-between mb-3">
                          <label className="text-sm font-medium text-gray-900">Hippocratisme digital</label>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" name="hippocratisme" checked={formData.hippocratisme} onChange={handleInputChange} className="sr-only peer" />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                          </label>
                       </div>
                       {formData.hippocratisme && (
                         <textarea
                            name="hippocratismeComment"
                            value={formData.hippocratismeComment}
                            onChange={handleInputChange}
                            placeholder="Décrire l'hippocratisme..."
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm p-2 text-gray-900 bg-white"
                            rows={2}
                         />
                       )}
                    </div>
                 </div>
              </section>

              {/* Souffles Cardiaques */}
              <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                 <h4 className="text-sm font-bold text-indigo-600 uppercase tracking-wider mb-4 flex items-center">
                   <Heart size={18} className="mr-2" /> Souffles Cardiaques
                 </h4>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Type de souffle</label>
                      <select 
                        name="souffleType" 
                        value={formData.souffleType} 
                        onChange={handleInputChange}
                        className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 bg-white text-gray-900"
                      >
                        {SOUFFLE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>

                    {formData.souffleType !== 'Aucun souffle détecté' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Localisation</label>
                          <select 
                            name="souffleLocation" 
                            value={formData.souffleLocation} 
                            onChange={handleInputChange}
                            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 bg-white text-gray-900"
                          >
                             <option value="">Sélectionner...</option>
                             {LOCALISATION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Intensité (Grade)</label>
                          <select 
                            name="souffleGrade" 
                            value={formData.souffleGrade} 
                            onChange={handleInputChange}
                            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 bg-white text-gray-900"
                          >
                            {[1,2,3,4,5,6].map(g => <option key={g} value={`${g}/6`}>{g}/6</option>)}
                          </select>
                        </div>
                      </>
                    )}
                 </div>
              </section>

               {/* Signes d'insuffisance */}
               <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                 <h4 className="text-sm font-bold text-indigo-600 uppercase tracking-wider mb-4 flex items-center">
                   <Activity size={18} className="mr-2" /> Signes d'insuffisance cardiaque
                 </h4>
                 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {FAILURE_SIGNS_OPTIONS.map(sign => {
                      const isSelected = formData.failureSigns.includes(sign);
                      return (
                        <button
                          key={sign}
                          onClick={() => toggleFailureSign(sign)}
                          className={`
                            px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 border text-left flex items-center justify-between
                            ${isSelected 
                              ? 'bg-red-50 border-red-200 text-red-700 shadow-sm' 
                              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'}
                          `}
                        >
                          <span>{sign}</span>
                          {isSelected && <Check size={16} className="text-red-500 shrink-0 ml-2" />}
                        </button>
                      );
                    })}
                 </div>
              </section>

            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-white flex justify-end space-x-4">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button 
                onClick={handleSave}
                className="px-6 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-colors flex items-center"
              >
                <Save size={18} className="mr-2" />
                Enregistrer l'examen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
