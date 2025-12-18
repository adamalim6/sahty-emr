import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { MOCK_PATIENTS, calculateAge } from '../../constants';
import { 
  Plus, 
  Droplet, 
  ShieldCheck, 
  AlertTriangle, 
  Thermometer, 
  Activity, 
  Heart, 
  Wind, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  X, 
  Save, 
  FileText,
  Syringe,
  AlertOctagon,
  UserCheck
} from 'lucide-react';

// --- Types ---

type ProductType = 'CGR' | 'PFC' | 'Plaquettes' | 'Cryo';
type ToleranceType = 'Bonne' | 'Incident';
type LocationType = 'Reanimation' | 'Bloc' | 'Service';

interface TransfusionRecord {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  location: LocationType;
  indication: string;
  
  // Product
  productType: ProductType;
  pouchNumber: string;
  productGroup: string;
  productRhesus: string;
  volume: string;
  units?: string; // Nbr d'unités
  
  // Specifics
  preHb?: string; // For CGR
  plateletType?: 'Standard' | 'Apherese'; // For Plaquettes
  
  // Security
  patientGroupConfirmed: boolean;
  compatibilityVerified: boolean;
  bedsideTestRealized: boolean;
  bedsideTestTime: string;
  bedsideTestUser: string;

  // Vitals
  sysBP?: string;
  diaBP?: string;
  heartRate?: string;
  temp?: string;
  spO2?: string;

  // Tolerance
  tolerance: ToleranceType;
  incidentType?: string;
  incidentDescription?: string;

  // Traceability
  nurseName: string;
  doctorName: string;
  status: 'Terminée' | 'En cours' | 'Interrompue';
}

const INITIAL_FORM: Partial<TransfusionRecord> = {
  date: new Date().toISOString().split('T')[0],
  startTime: '',
  endTime: '',
  location: 'Service',
  productType: 'CGR', // Default
  tolerance: 'Bonne',
  patientGroupConfirmed: true, // Usually pre-checked if valid in system
  compatibilityVerified: false,
  bedsideTestRealized: false,
  status: 'Terminée'
};

// --- Helpers ---

const getProductColor = (type: ProductType) => {
  switch (type) {
    case 'CGR': return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', activeRing: 'ring-red-500', fill: 'bg-red-600' };
    case 'PFC': return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', activeRing: 'ring-blue-500', fill: 'bg-blue-600' };
    case 'Plaquettes': return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', activeRing: 'ring-amber-500', fill: 'bg-amber-500' };
    case 'Cryo': return { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', activeRing: 'ring-purple-500', fill: 'bg-purple-600' };
  }
};

// --- Styled Components Helper ---
const InputWithIcon = ({ 
  icon: Icon, 
  name, 
  value, 
  onChange, 
  placeholder, 
  type = "text", 
  suffix 
}: { 
  icon?: any, 
  name: string, 
  value: string, 
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, 
  placeholder?: string, 
  type?: string,
  suffix?: string
}) => (
  <div className="relative rounded-md shadow-sm">
    {Icon && (
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
        <Icon className="h-5 w-5 text-gray-500" aria-hidden="true" />
      </div>
    )}
    <input
      type={type}
      name={name}
      id={name}
      value={value}
      onChange={onChange}
      className={`block w-full rounded-lg border border-gray-300 bg-white py-2.5 text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 sm:text-sm font-medium transition-all ${Icon ? 'pl-10' : 'pl-3'} ${suffix ? 'pr-12' : 'pr-3'}`}
      placeholder={placeholder}
    />
    {suffix && (
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
        <span className="text-gray-500 sm:text-xs font-bold">{suffix}</span>
      </div>
    )}
  </div>
);

export const Transfusions: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const patient = MOCK_PATIENTS.find(p => p.id === id);

  const [records, setRecords] = useState<TransfusionRecord[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<TransfusionRecord>>(INITIAL_FORM);

  // Validation Check
  const isSecurityValid = formData.compatibilityVerified && formData.bedsideTestRealized && formData.bedsideTestUser && formData.pouchNumber;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleProductSelect = (type: ProductType) => {
    setFormData(prev => ({ ...prev, productType: type }));
  };

  const handleSave = () => {
    if (!isSecurityValid) return;

    const newRecord: TransfusionRecord = {
      ...formData as TransfusionRecord,
      id: Date.now().toString(),
    };

    setRecords([newRecord, ...records]);
    
    // Émettre l'événement pour le tab Antécédents
    window.dispatchEvent(new CustomEvent('patient-transfused', { detail: newRecord }));
    
    setIsModalOpen(false);
    setFormData(INITIAL_FORM);
  };

  const renderProductToggle = (type: ProductType, label: string) => {
    const colors = getProductColor(type);
    const isSelected = formData.productType === type;
    
    return (
      <button
        type="button"
        onClick={() => handleProductSelect(type)}
        className={`
          relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200 w-full h-24
          ${isSelected ? `${colors.bg} ${colors.border} ${colors.activeRing} ring-2 ring-offset-1` : 'bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50'}
        `}
      >
        <div className={`mb-2 ${isSelected ? colors.text : 'text-gray-400'}`}>
          <Droplet size={24} className={isSelected ? 'fill-current' : ''} />
        </div>
        <span className={`text-sm font-bold ${isSelected ? colors.text : 'text-gray-500'}`}>{label}</span>
        {isSelected && (
           <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${colors.fill}`}></div>
        )}
      </button>
    );
  };

  return (
    <div className="min-h-[500px] relative">
      {/* --- Header --- */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Transfusions Sanguines</h3>
          <p className="text-sm text-gray-500">Historique et traçabilité des PSL administrés.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm font-medium"
        >
          <Plus size={18} />
          <span>Ajouter une transfusion</span>
        </button>
      </div>

      {/* --- Empty State --- */}
      {records.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
          <div className="mx-auto h-16 w-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
            <Droplet className="h-8 w-8 text-red-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">Aucune transfusion enregistrée</h3>
          <p className="mt-1 text-gray-500 max-w-sm mx-auto">Cliquez sur "Ajouter" pour saisir une nouvelle administration de produit sanguin labile.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
           {records.map(record => {
             const colors = getProductColor(record.productType);
             return (
               <div key={record.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                 <div className="flex flex-col md:flex-row">
                    {/* Color Strip */}
                    <div className={`w-full md:w-2 ${colors.fill}`}></div>
                    
                    <div className="p-5 flex-1">
                      <div className="flex justify-between items-start mb-4">
                         <div className="flex items-center space-x-3">
                            <span className={`px-3 py-1 rounded-lg text-sm font-bold border ${colors.bg} ${colors.text} ${colors.border}`}>
                              {record.productType}
                            </span>
                            <span className="text-gray-900 font-medium">Poche N° {record.pouchNumber}</span>
                            <span className="text-gray-400 text-sm">|</span>
                            <span className="font-mono text-gray-700 font-bold">{record.productGroup} {record.productRhesus}</span>
                         </div>
                         <div className="flex items-center text-sm text-gray-500">
                           <Clock size={14} className="mr-1" />
                           {new Date(record.date).toLocaleDateString('fr-FR')} de {record.startTime} à {record.endTime}
                         </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                         <div>
                           <p className="text-gray-500 mb-1">Indication</p>
                           <p className="font-medium text-gray-800">{record.indication}</p>
                         </div>
                         <div>
                            <p className="text-gray-500 mb-1">Surveillance</p>
                            <div className="flex space-x-3 text-gray-700">
                               <span title="TA">{record.sysBP}/{record.diaBP} mmHg</span>
                               <span title="FC">{record.heartRate} bpm</span>
                               <span title="Temp">{record.temp}°C</span>
                            </div>
                         </div>
                         <div>
                            <p className="text-gray-500 mb-1">Tolérance</p>
                            {record.tolerance === 'Bonne' ? (
                              <span className="inline-flex items-center text-emerald-700 font-medium">
                                <CheckCircle2 size={14} className="mr-1" /> Bonne tolérance
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-red-700 font-bold bg-red-50 px-2 py-0.5 rounded">
                                <AlertTriangle size={14} className="mr-1" /> Incident: {record.incidentType}
                              </span>
                            )}
                         </div>
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500">
                         <div className="flex items-center space-x-4">
                           <span className="flex items-center"><UserCheck size={12} className="mr-1"/> INF: {record.nurseName}</span>
                           <span className="flex items-center"><UserCheck size={12} className="mr-1"/> MED: {record.doctorName}</span>
                         </div>
                         <div className="flex items-center space-x-1 text-emerald-600 font-medium">
                            <ShieldCheck size={12} />
                            <span>Contrôle ultime réalisé par {record.bedsideTestUser}</span>
                         </div>
                      </div>
                    </div>
                 </div>
               </div>
             );
           })}
        </div>
      )}

      {/* --- Full Screen Modal --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
               <div className="flex items-center space-x-3">
                 <div className="bg-red-500 p-2 rounded-lg">
                   <Droplet className="text-white" size={20} />
                 </div>
                 <div>
                   <h2 className="text-lg font-bold">Saisie d'une Transfusion</h2>
                   <p className="text-slate-400 text-xs">Assurez-vous d'avoir réalisé le contrôle ultime au lit du patient.</p>
                 </div>
               </div>
               <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                 <X size={24} />
               </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
               
               {/* 1. Patient ID (Read Only) */}
               <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex items-center space-x-4">
                     <div className="bg-gray-100 p-3 rounded-full text-gray-600 font-bold text-xl">
                       {patient?.firstName[0]}{patient?.lastName[0]}
                     </div>
                     <div>
                       <h3 className="text-lg font-bold text-gray-900">{patient?.lastName.toUpperCase()} {patient?.firstName}</h3>
                       <div className="flex items-center text-sm text-gray-500 space-x-3">
                         <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 font-mono">{patient?.ipp}</span>
                         <span>{calculateAge(patient?.dateOfBirth || '')} ans</span>
                         <span>{patient?.gender}</span>
                       </div>
                     </div>
                  </div>
                  <div className="text-right text-sm">
                     <div className="font-medium text-gray-900">Service de Chirurgie</div>
                     <div className="text-gray-500">Chambre 104 - Lit 1</div>
                  </div>
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* LEFT COLUMN: GENERAL & PRODUCT */}
                  <div className="lg:col-span-2 space-y-6">
                     
                     {/* 2. General Data */}
                     <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                        <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center">
                          <Clock size={16} className="mr-2"/> Données Générales
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                           <div>
                             <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                             <input type="date" name="date" value={formData.date} onChange={handleInputChange} className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 px-3 text-gray-900 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm" />
                           </div>
                           <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Début</label>
                                <input type="time" name="startTime" value={formData.startTime} onChange={handleInputChange} className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 px-3 text-gray-900 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm" />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Fin</label>
                                <input type="time" name="endTime" value={formData.endTime} onChange={handleInputChange} className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 px-3 text-gray-900 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm" />
                              </div>
                           </div>
                           <div>
                             <label className="block text-sm font-medium text-gray-700 mb-1">Lieu</label>
                             <select name="location" value={formData.location} onChange={handleInputChange} className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 px-3 text-gray-900 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm">
                               <option value="Service">Service</option>
                               <option value="Bloc">Bloc Opératoire</option>
                               <option value="Reanimation">Réanimation</option>
                             </select>
                           </div>
                           <div className="md:col-span-3">
                             <label className="block text-sm font-medium text-gray-700 mb-1">Indication</label>
                             <input type="text" name="indication" placeholder="Ex: Anémie aiguë post-opératoire" value={formData.indication || ''} onChange={handleInputChange} className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 px-3 text-gray-900 placeholder-gray-400 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm" />
                           </div>
                        </div>
                     </div>

                     {/* 3. Product Selection */}
                     <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                        <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center">
                          <Droplet size={16} className="mr-2"/> Produit Sanguin Labile
                        </h4>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                           {renderProductToggle('CGR', 'C.G.R')}
                           {renderProductToggle('PFC', 'P.F.C')}
                           {renderProductToggle('Plaquettes', 'Plaquettes')}
                           {renderProductToggle('Cryo', 'Cryoprécipité')}
                        </div>

                        {/* Product Details - Dynamic */}
                        <div className={`p-4 rounded-lg border border-dashed border-gray-300 bg-gray-50/50`}>
                           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="col-span-2 md:col-span-1">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">N° de Poche</label>
                                <input type="text" name="pouchNumber" value={formData.pouchNumber || ''} onChange={handleInputChange} placeholder="Scan ou Saisie" className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 px-3 text-gray-900 placeholder-gray-400 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm font-mono" />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Groupe</label>
                                <select name="productGroup" value={formData.productGroup} onChange={handleInputChange} className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 px-3 text-gray-900 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm font-bold">
                                  <option value="">?</option>
                                  <option value="A">A</option>
                                  <option value="B">B</option>
                                  <option value="AB">AB</option>
                                  <option value="O">O</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Rhésus</label>
                                <select name="productRhesus" value={formData.productRhesus} onChange={handleInputChange} className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 px-3 text-gray-900 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm font-bold">
                                  <option value="">?</option>
                                  <option value="+">+</option>
                                  <option value="-">-</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Volume (ml)</label>
                                <input type="number" name="volume" value={formData.volume || ''} onChange={handleInputChange} className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 px-3 text-gray-900 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm" />
                              </div>

                              {/* Conditional Fields based on Type */}
                              {formData.productType === 'CGR' && (
                                <div className="col-span-2">
                                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Hb pré-transfusionnelle (g/dL)</label>
                                  <input type="number" step="0.1" name="preHb" value={formData.preHb || ''} onChange={handleInputChange} className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 px-3 text-gray-900 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm" />
                                </div>
                              )}
                              {(formData.productType === 'Plaquettes' || formData.productType === 'Cryo') && (
                                 <div>
                                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Unités</label>
                                  <input type="number" name="units" value={formData.units || ''} onChange={handleInputChange} className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 px-3 text-gray-900 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm" />
                                </div>
                              )}
                           </div>
                        </div>
                     </div>

                  </div>

                  {/* RIGHT COLUMN: SECURITY & SURVEILLANCE */}
                  <div className="space-y-6">
                     
                     {/* 4. Security Check (CRITICAL) */}
                     <div className="bg-white rounded-xl border-2 border-orange-100 shadow-sm overflow-hidden">
                        <div className="bg-orange-50 px-4 py-3 border-b border-orange-100 flex items-center">
                           <ShieldCheck className="text-orange-600 mr-2" size={20} />
                           <h4 className="font-bold text-orange-800 text-sm uppercase">Sécurité Transfusionnelle</h4>
                        </div>
                        <div className="p-5 space-y-4">
                           <label className="flex items-start p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors bg-white">
                              <input 
                                type="checkbox" 
                                name="compatibilityVerified" 
                                checked={formData.compatibilityVerified} 
                                onChange={handleInputChange} 
                                className="mt-1 h-5 w-5 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded" 
                              />
                              <div className="ml-3">
                                 <span className="block text-sm font-bold text-gray-900">Compatibilité Vérifiée</span>
                                 <span className="block text-xs text-gray-500">Concordance carte de groupe / produit</span>
                              </div>
                           </label>

                           <div className={`p-3 rounded-lg border transition-colors ${formData.bedsideTestRealized ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                             <label className="flex items-center cursor-pointer mb-3">
                                <input 
                                  type="checkbox" 
                                  name="bedsideTestRealized" 
                                  checked={formData.bedsideTestRealized} 
                                  onChange={handleInputChange} 
                                  className="h-5 w-5 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded" 
                                />
                                <span className="ml-3 text-sm font-bold text-gray-900">Contrôle Ultime au lit (CULT)</span>
                             </label>
                             {formData.bedsideTestRealized && (
                               <div className="grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-2">
                                  <input 
                                    type="time" 
                                    name="bedsideTestTime" 
                                    value={formData.bedsideTestTime || ''} 
                                    onChange={handleInputChange} 
                                    className="block w-full text-xs rounded border border-gray-300 bg-white py-2 px-2 text-gray-900 shadow-sm"
                                    placeholder="Heure"
                                  />
                                  <input 
                                    type="text" 
                                    name="bedsideTestUser" 
                                    value={formData.bedsideTestUser || ''} 
                                    onChange={handleInputChange} 
                                    className="block w-full text-xs rounded border border-gray-300 bg-white py-2 px-2 text-gray-900 shadow-sm" 
                                    placeholder="Réalisé par (Initiales)"
                                  />
                               </div>
                             )}
                           </div>
                        </div>
                     </div>

                     {/* 5. Clinical Surveillance */}
                     <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                        <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center">
                          <Activity size={16} className="mr-2"/> Surveillance Clinique
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                           <InputWithIcon 
                             icon={Heart} 
                             name="heartRate" 
                             value={formData.heartRate || ''} 
                             onChange={handleInputChange} 
                             placeholder="FC" 
                             suffix="bpm"
                             type="number"
                           />
                           <InputWithIcon 
                             icon={Activity} 
                             name="sysBP" 
                             value={formData.sysBP || ''} 
                             onChange={handleInputChange} 
                             placeholder="TA Sys" 
                             suffix="mmHg"
                           />
                           <InputWithIcon 
                             icon={Thermometer} 
                             name="temp" 
                             value={formData.temp || ''} 
                             onChange={handleInputChange} 
                             placeholder="Temp" 
                             suffix="°C"
                             type="number"
                           />
                           <InputWithIcon 
                             icon={Wind} 
                             name="spO2" 
                             value={formData.spO2 || ''} 
                             onChange={handleInputChange} 
                             placeholder="SpO2" 
                             suffix="%"
                             type="number"
                           />
                        </div>
                     </div>
                     
                     {/* 6. Tolerance */}
                     <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                        <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Tolérance</h4>
                        <div className="flex bg-gray-100 p-1 rounded-lg mb-4">
                           <button 
                             onClick={() => setFormData(p => ({...p, tolerance: 'Bonne'}))}
                             className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${formData.tolerance === 'Bonne' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                           >
                             Bonne
                           </button>
                           <button 
                             onClick={() => setFormData(p => ({...p, tolerance: 'Incident'}))}
                             className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${formData.tolerance === 'Incident' ? 'bg-red-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                           >
                             Incident
                           </button>
                        </div>
                        
                        {formData.tolerance === 'Incident' && (
                           <div className="bg-red-50 p-3 rounded-lg border border-red-100 space-y-3 animate-in fade-in">
                              <div>
                                <label className="block text-xs font-bold text-red-800 mb-1">Type d'incident</label>
                                <select name="incidentType" value={formData.incidentType} onChange={handleInputChange} className="block w-full rounded-lg border border-red-300 bg-white py-2.5 px-3 text-gray-900 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm">
                                   <option value="">Sélectionner...</option>
                                   <option value="Fievre">Fièvre / Frissons</option>
                                   <option value="Allergie">Réaction Allergique</option>
                                   <option value="OAP">Surcharge (OAP)</option>
                                   <option value="Choc">Choc</option>
                                </select>
                              </div>
                              <textarea 
                                name="incidentDescription" 
                                placeholder="Description de l'incident et CAT..." 
                                value={formData.incidentDescription}
                                onChange={handleInputChange}
                                className="block w-full rounded-lg border border-red-300 bg-white py-2.5 px-3 text-gray-900 placeholder-gray-400 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm h-20" 
                              />
                           </div>
                        )}
                     </div>

                  </div>
               </div>

               {/* 7. Traceability Footer (Inside Scroll) */}
               <div className="mt-6 bg-gray-100 rounded-xl p-4 border border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Infirmier(e)</label>
                    <InputWithIcon 
                      icon={Syringe} 
                      name="nurseName" 
                      value={formData.nurseName || ''} 
                      onChange={handleInputChange} 
                      placeholder="Nom Prénom" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Médecin Resp.</label>
                    <InputWithIcon 
                      icon={FileText} 
                      name="doctorName" 
                      value={formData.doctorName || ''} 
                      onChange={handleInputChange} 
                      placeholder="Dr..." 
                    />
                  </div>
               </div>

            </div>

            {/* Modal Footer (Fixed) */}
            <div className="bg-white border-t border-gray-200 p-4 flex justify-between items-center shrink-0">
               <div className="text-xs text-gray-500 flex items-center">
                 {!isSecurityValid ? (
                   <>
                     <AlertOctagon size={16} className="text-red-500 mr-2" />
                     <span className="text-red-600 font-medium">Validation impossible : Sécurité incomplète.</span>
                   </>
                 ) : (
                   <span className="text-emerald-600 font-medium flex items-center">
                     <CheckCircle2 size={16} className="mr-2" /> Tous les contrôles sont valides.
                   </span>
                 )}
               </div>
               <div className="flex space-x-3">
                  <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                    Annuler
                  </button>
                  <button 
                    onClick={handleSave}
                    disabled={!isSecurityValid}
                    className={`
                      px-5 py-2.5 text-sm font-bold text-white rounded-lg shadow-sm flex items-center transition-all
                      ${isSecurityValid ? 'bg-slate-900 hover:bg-black hover:scale-105' : 'bg-gray-300 cursor-not-allowed'}
                    `}
                  >
                    <Save size={18} className="mr-2" />
                    Enregistrer la transfusion
                  </button>
               </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};