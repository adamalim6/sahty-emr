
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Search,
  ChevronRight,
  Plus,
  Activity,
  User,
  Calendar,
  ChevronDown,
  Hash,
  CheckCircle2,
  MapPin,
  Phone,
  Mail,
  Fingerprint,
  Briefcase,
  Globe,
  Flag,
  CreditCard,
  Building2,
  Bed,
  Stethoscope,
  Clock,
  ArrowRightLeft,
  ShieldCheck,
  Smartphone,
  Trash2,
  Check,
  AlertCircle,
  Baby,
  Users,
  IdCard,
  AlertOctagon,
  Coins,
  Truck,
  Hospital,
  ArrowUpRight
} from 'lucide-react';
import { MOCK_PATIENTS, MOCK_ROOMS, generateIPP, calculateAge, generateNDA, MOCK_ADMISSIONS } from '../constants';
import { Patient, Gender, Admission } from '../types';

interface WizardProps {
  isOpen: boolean;
  onClose: () => void;
}

// --- MOCK DATA FOR STEP 2 ---
const DOCTORS = ["Dr. S. Alami", "Dr. Y. Benjelloun", "Dr. K. Tazi", "Dr. M. Idrissi", "Dr. A. Mansouri", "Dr. F. Zahra"];
const ADMISSION_TYPES = ["Hospitalisation complète", "Ambulatoire", "Hôpital de jour", "Urgence", "Séance de soins"];
const CURRENCIES = ["MAD (Dirham)", "EUR (Euro)", "USD (Dollar)"];
const ADMISSION_REASONS = ["Chirurgie programmée", "Bilan diagnostique", "Pathologie aiguë", "Suivi post-op", "Obstétrique"];
const ARRIVAL_MODES = ["Marche", "Fauteuil roulant", "Brancard", "Ambulance", "SMUR"];
const PROVENANCES = ["Domicile", "Urgences", "Consultation externe", "Transfert inter-hôpital", "Clinique privée"];
const SERVICES = ["Cardiologie", "Chirurgie Générale", "Réanimation", "Pédiatrie", "Neurologie", "Gastro-entérologie"];

// --- MOCK ROOMS MAPPED BY SERVICE ---
const MOCK_ROOMS_BY_SERVICE: Record<string, any[]> = {
  "Cardiologie": [
    { id: 'c1', number: '101', type: 'Individuelle', beds: [{ id: 'c1-a', label: 'Lit A', status: 'available' }] },
    { id: 'c2', number: '102', type: 'Double', beds: [{ id: 'c2-a', label: 'Lit A', status: 'occupied' }, { id: 'c2-b', label: 'Lit B', status: 'available' }] },
    { id: 'c3', number: '103', type: 'Double', beds: [{ id: 'c3-a', label: 'Lit A', status: 'available' }, { id: 'c3-b', label: 'Lit B', status: 'available' }] },
    { id: 'c4', number: '104', type: 'Individuelle', beds: [{ id: 'c4-a', label: 'Lit A', status: 'occupied' }] },
  ],
  "Chirurgie Générale": [
    { id: 's1', number: '201', type: 'Individuelle', beds: [{ id: 's1-a', label: 'Lit A', status: 'available' }] },
    { id: 's2', number: '202', type: 'Double', beds: [{ id: 's2-a', label: 'Lit A', status: 'available' }, { id: 's2-b', label: 'Lit B', status: 'available' }] },
    { id: 's3', number: '203', type: 'Double', beds: [{ id: 's3-a', label: 'Lit A', status: 'occupied' }, { id: 's3-b', label: 'Lit B', status: 'occupied' }] },
    { id: 's4', number: '204', type: 'Double', beds: [{ id: 's4-a', label: 'Lit A', status: 'available' }, { id: 's4-b', label: 'Lit B', status: 'available' }] },
  ],
  "Réanimation": [
    { id: 'r1', number: 'REA-01', type: 'Individuelle', beds: [{ id: 'r1-a', label: 'Secteur A', status: 'available' }] },
    { id: 'r2', number: 'REA-02', type: 'Individuelle', beds: [{ id: 'r2-a', label: 'Secteur A', status: 'occupied' }] },
    { id: 'r3', number: 'REA-03', type: 'Individuelle', beds: [{ id: 'r3-a', label: 'Secteur A', status: 'available' }] },
    { id: 'r4', number: 'REA-04', type: 'Individuelle', beds: [{ id: 'r4-a', label: 'Secteur A', status: 'available' }] },
  ],
  "Pédiatrie": [
    { id: 'p1', number: 'PED-10', type: 'Double', beds: [{ id: 'p1-a', label: 'Lit A', status: 'available' }, { id: 'p1-b', label: 'Lit B', status: 'available' }] },
    { id: 'p2', number: 'PED-11', type: 'Double', beds: [{ id: 'p2-a', label: 'Lit A', status: 'occupied' }, { id: 'p2-b', label: 'Lit B', status: 'available' }] },
    { id: 'p3', number: 'PED-12', type: 'Individuelle', beds: [{ id: 'p3-a', label: 'Lit A', status: 'available' }] },
    { id: 'p4', number: 'PED-13', type: 'Double', beds: [{ id: 'p4-a', label: 'Lit A', status: 'available' }, { id: 'p4-b', label: 'Lit B', status: 'available' }] },
  ],
  "Neurologie": [
    { id: 'n1', number: '301', type: 'Individuelle', beds: [{ id: 'n1-a', label: 'Lit A', status: 'available' }] },
    { id: 'n2', number: '302', type: 'Double', beds: [{ id: 'n2-a', label: 'Lit A', status: 'available' }, { id: 'n2-b', label: 'Lit B', status: 'available' }] },
  ],
  "Gastro-entérologie": [
    { id: 'g1', number: '401', type: 'Double', beds: [{ id: 'g1-a', label: 'Lit A', status: 'available' }, { id: 'g1-b', label: 'Lit B', status: 'available' }] },
  ]
};

// --- SEARCHABLE SELECT COMPONENT ---
const SearchableSelect = ({ label, value, onChange, options, required = false, icon: Icon, placeholder = "Rechercher..." }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync searchTerm with initial value if it exists
  useEffect(() => {
    setSearchTerm(value || '');
  }, [value]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm || searchTerm === value) return options;
    return options.filter((opt: string) =>
      opt.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, options, value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        // If closed without picking, reset to current value
        setSearchTerm(value || '');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value]);

  const handleSelect = (opt: string) => {
    onChange(opt);
    setSearchTerm(opt);
    setIsOpen(false);
  };

  return (
    <div className="flex flex-col space-y-1.2 w-full text-left relative" ref={containerRef}>
      <label className="text-[10px] font-extrabold uppercase tracking-wider flex items-center text-slate-500">
        {label} {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="relative group">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 pointer-events-none transition-colors">
            <Icon size={14} />
          </div>
        )}
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={`w-full rounded-xl border border-slate-200 py-2 text-sm outline-none transition-all focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 ${Icon ? 'pl-9' : 'pl-3'} pr-8 font-medium`}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none">
          <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border border-slate-200 rounded-xl shadow-2xl z-[150] overflow-hidden max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt: string) => (
              <button
                key={opt}
                type="button"
                onClick={() => handleSelect(opt)}
                className={`w-full text-left px-4 py-2 text-sm font-bold transition-colors border-b border-slate-50 last:border-none ${opt === value ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50 hover:text-emerald-600'}`}
              >
                {opt}
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-xs text-slate-400 italic text-center">Aucun résultat</div>
          )}
        </div>
      )}
    </div>
  );
};

// --- REUSABLE UI COMPONENTS ---
const InputField = ({ label, value, onChange, placeholder, type = "text", required = false, disabled = false, icon: Icon, error = false }: any) => (
  <div className="flex flex-col space-y-1.2 w-full text-left">
    <label className={`text-[10px] font-extrabold uppercase tracking-wider flex items-center ${error ? 'text-red-600' : 'text-slate-500'}`}>
      {label} {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    <div className="relative group">
      {Icon && <div className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors pointer-events-none ${error ? 'text-red-400' : 'text-slate-400 group-focus-within:text-emerald-500'}`}><Icon size={14} /></div>}
      <input
        type={type}
        value={value || ''}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        className={`w-full rounded-xl border py-2 text-sm transition-all outline-none ${Icon ? 'pl-9' : 'pl-3'} pr-3 ${disabled
          ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200'
          : error
            ? 'bg-red-50 border-red-300 text-red-900 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
            : 'bg-white text-slate-900 border-slate-200 hover:border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10'
          }`}
      />
    </div>
  </div>
);

const SelectField = ({ label, value, onChange, options, required = false, disabled = false, icon: Icon, error = false }: any) => (
  <div className="flex flex-col space-y-1.2 w-full text-left">
    <label className={`text-[10px] font-extrabold uppercase tracking-wider flex items-center ${error ? 'text-red-600' : 'text-slate-500'}`}>
      {label} {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    <div className="relative group">
      {Icon && <div className={`absolute left-3 top-1/2 -translate-y-1/2 z-10 pointer-events-none ${error ? 'text-red-400' : 'text-slate-400'}`}><Icon size={14} /></div>}
      <select
        value={value || ''}
        onChange={onChange}
        disabled={disabled}
        className={`w-full rounded-xl border py-2 text-sm transition-all outline-none appearance-none ${Icon ? 'pl-9' : 'pl-3'} pr-10 ${disabled
          ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200'
          : error
            ? 'bg-red-50 border-red-300 text-red-900 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
            : 'bg-white text-slate-900 border-slate-200 hover:border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10'
          }`}
      >
        <option value="" disabled>Sélectionner...</option>
        {options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><ChevronDown size={14} /></div>
    </div>
  </div>
);

const GenderToggle = ({ value, onChange, disabled = false }: { value: Gender, onChange: (g: Gender) => void, disabled?: boolean }) => (
  <div className="flex flex-col space-y-1.2 w-full text-left">
    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Sexe <span className="text-red-500 ml-1">*</span></label>
    <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200">
      <button type="button" disabled={disabled} onClick={() => onChange(Gender.Male)} className={`flex-1 py-1.5 text-xs font-black rounded-lg transition-all ${value === Gender.Male ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>HOMME</button>
      <button type="button" disabled={disabled} onClick={() => onChange(Gender.Female)} className={`flex-1 py-1.5 text-xs font-black rounded-lg transition-all ${value === Gender.Female ? 'bg-white text-pink-600 shadow-sm' : 'text-slate-500'}`}>FEMME</button>
    </div>
  </div>
);

const CardSection = ({ title, icon: Icon, children, colorClass = "text-emerald-600", bgClass = "bg-emerald-50", action }: any) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-left">
    <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
      <div className="flex items-center space-x-3"><div className={`p-2 rounded-lg ${bgClass} ${colorClass}`}><Icon size={16} /></div><h4 className="font-bold text-slate-800 text-xs uppercase tracking-tight">{title}</h4></div>
      {action && <div>{action}</div>}
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const DuplicateConflictModal = ({ patient, onCancel, onRedirect }: { patient: Patient, onCancel: () => void, onRedirect: () => void }) => (
  <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
    <div className="bg-white border-2 border-red-500 rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300">
      <div className="flex flex-col items-center text-center">
        <div className="w-20 h-20 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center mb-6 shadow-inner"><AlertOctagon size={40} strokeWidth={2.5} /></div>
        <h3 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">Doublon Identifié</h3>
        <p className="text-slate-600 mb-8 font-medium leading-relaxed">
          Le N° de pièce d'identité est déjà attribué au patient <br />
          <span className="font-black text-red-600 text-lg uppercase">{patient.lastName} {patient.firstName}</span>.<br /><br />
          Voulez vous êtres redirigé vers le profil concerné ?
        </p>
        <div className="flex w-full gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-4 text-slate-400 font-black hover:text-slate-600 uppercase text-[10px] tracking-widest border border-slate-200 rounded-2xl transition-all">Annuler</button>
          <button onClick={onRedirect} className="flex-1 px-4 py-4 bg-red-600 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl hover:bg-red-700 shadow-xl transition-all flex items-center justify-center active:scale-95">Rediriger <ChevronRight size={18} className="ml-2" /></button>
        </div>
      </div>
    </div>
  </div>
);

export const AdmissionWizard: React.FC<WizardProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(1);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [duplicateConflict, setDuplicateConflict] = useState<Patient | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [selectedBedId, setSelectedBedId] = useState<string | null>(null);
  const navigate = useNavigate();

  const [patientData, setPatientData] = useState<Partial<Patient>>({
    id: Date.now().toString(), ipp: generateIPP(), firstName: '', lastName: '', gender: Gender.Male, dateOfBirth: '', phone: '', cin: '', country: 'Maroc', city: '', zipCode: '', nationality: 'Marocaine', address: '', isPayant: false, profession: '', bloodGroup: '',
    insurance: { mainOrg: '', relationship: 'Lui-même', registrationNumber: '' }, emergencyContacts: [{ name: '', relationship: 'Père', phone: '' }],
    guardian: { firstName: '', lastName: '', phone: '', relationship: 'Père', idType: 'CIN', idNumber: '', address: '', habilitation: '' }
  });

  const [admissionData, setAdmissionData] = useState<any>({
    type: '', // Initialized to empty for better searchable UX
    doctorName: '',
    reason: '',
    service: '',
    currency: 'MAD (Dirham)',
    arrivalMode: '',
    provenance: ''
  });

  const filteredRooms = useMemo(() => {
    if (!admissionData.service) return [];
    return MOCK_ROOMS_BY_SERVICE[admissionData.service] || [];
  }, [admissionData.service]);

  const handleServiceChange = (newService: string) => {
    setAdmissionData({ ...admissionData, service: newService });
    setSelectedBedId(null);
  };

  const filteredPatients = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return MOCK_PATIENTS;
    return MOCK_PATIENTS.filter(p =>
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(term) ||
      p.ipp.toLowerCase().includes(term) ||
      p.cin?.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  const isMinor = patientData.dateOfBirth ? calculateAge(patientData.dateOfBirth) < 18 : false;

  const isStep1Valid = useMemo(() => {
    const baseValid = !!(patientData.lastName && patientData.firstName && patientData.dateOfBirth && patientData.cin && patientData.country && patientData.city && patientData.address && patientData.nationality);
    if (!baseValid) return false;
    if (isMinor) return !!(patientData.guardian?.lastName && patientData.guardian?.firstName && patientData.guardian?.relationship);
    return true;
  }, [patientData, isMinor]);

  const handlePatientSelect = (p: Patient) => {
    setPatientData({
      ...p,
      insurance: p.insurance || { mainOrg: '', relationship: 'Lui-même', registrationNumber: '' },
      emergencyContacts: (p.emergencyContacts && p.emergencyContacts.length > 0) ? p.emergencyContacts : [{ name: '', relationship: 'Père', phone: '' }],
      guardian: p.guardian || { firstName: '', lastName: '', phone: '', relationship: 'Père', idType: 'CIN', idNumber: '', address: '', habilitation: '' }
    });
    setIsSearchOpen(false);
    setShowErrors(false);
  };

  const handleContinueAdmission = () => {
    if (!isStep1Valid) { setShowErrors(true); return; }
    if (patientData.cin) {
      const duplicate = MOCK_PATIENTS.find(p => p.id !== patientData.id && p.cin?.toLowerCase() === patientData.cin?.toLowerCase());
      if (duplicate) { setDuplicateConflict(duplicate); return; }
    }
    setStep(2);
  };

  const handleCreateAdmission = () => {
    if (!admissionData.type || !admissionData.doctorName || !selectedBedId) return;

    // Build the admission object
    const newId = `adm-${Date.now()}`;
    const newNDA = generateNDA();

    // Find the room and bed labels
    let roomNum = "";
    let bedLab = "";
    filteredRooms.forEach(r => {
      const bed = r.beds.find((b: any) => b.id === selectedBedId);
      if (bed) {
        roomNum = r.number;
        bedLab = bed.label;
      }
    });

    const newAdmission: Admission = {
      id: newId,
      nda: newNDA,
      patientId: patientData.id || "1",
      reason: admissionData.reason,
      service: admissionData.service,
      admissionDate: new Date().toISOString(),
      doctorName: admissionData.doctorName,
      roomNumber: roomNum,
      bedLabel: bedLab,
      status: 'En cours',
      type: admissionData.type,
      currency: admissionData.currency
    };

    // Note: In a real app we'd dispatch to a store or API. 
    // Here we simulate success by adding to MOCK_ADMISSIONS for local navigation context.
    MOCK_ADMISSIONS.unshift(newAdmission);

    onClose();
    navigate(`/admission/${newId}`);
  };

  const handleInsuranceChange = (field: string, value: string) => {
    setPatientData(prev => ({ ...prev, insurance: { ...(prev.insurance || { mainOrg: '', relationship: 'Lui-même' }), [field]: value } }));
  };

  const handleGuardianChange = (field: string, value: string) => {
    setPatientData(prev => ({ ...prev, guardian: { ...(prev.guardian || { firstName: '', lastName: '', phone: '', relationship: 'Père', idType: 'CIN', idNumber: '', address: '', habilitation: '' }), [field]: value } }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed top-0 left-0 w-screen h-screen z-[9999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300 text-left">
      <div className="bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col transition-all duration-500 ease-out w-full max-w-6xl h-[96vh]">

        {/* Header */}
        <div className="px-6 py-4 flex justify-between items-center text-white bg-slate-900 shrink-0">
          <div className="flex items-center space-x-4">
            <div className="p-2.5 bg-emerald-500 rounded-xl shadow-lg shadow-emerald-500/20"><Activity size={20} /></div>
            <div><h2 className="text-sm font-black uppercase tracking-[0.1em] text-white">Admission Patient</h2></div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all border border-transparent hover:border-white/10 active:scale-95"><X size={22} /></button>
        </div>

        {/* Stepper */}
        <div className="bg-slate-50 border-b px-8 py-3 flex items-center shrink-0">
          <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-full border shadow-sm">
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full transition-all ${step === 1 ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'text-slate-400'}`}>
              <span className="text-[10px] font-black uppercase tracking-widest">01. Identité</span>
            </div>
            <ChevronRight size={14} className="text-slate-300" />
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full transition-all ${step === 2 ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'text-slate-400'}`}>
              <span className="text-[10px] font-black uppercase tracking-widest">02. Infos Admission</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-8">
          {step === 1 ? (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-300">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left">
                <CardSection title="1. Informations Patient" icon={User} action={<button onClick={() => setIsSearchOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-black uppercase text-[10px] flex items-center shadow-md active:scale-95 transition-all"><Search size={14} className="mr-2" />Rechercher existant</button>}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <InputField label="IPP" value={patientData.ipp} disabled icon={Fingerprint} />
                    <GenderToggle value={patientData.gender as Gender} onChange={(g: any) => setPatientData({ ...patientData, gender: g })} />
                    <InputField label="Nom" required value={patientData.lastName} error={showErrors && !patientData.lastName} onChange={(e: any) => setPatientData({ ...patientData, lastName: e.target.value.toUpperCase() })} />
                    <InputField label="Prénom" required value={patientData.firstName} error={showErrors && !patientData.firstName} onChange={(e: any) => setPatientData({ ...patientData, firstName: e.target.value })} />
                    <InputField label="Naissance" required type="date" value={patientData.dateOfBirth} error={showErrors && !patientData.dateOfBirth} onChange={(e: any) => setPatientData({ ...patientData, dateOfBirth: e.target.value })} icon={Calendar} />
                    <InputField label="Tél" value={patientData.phone} onChange={(e: any) => setPatientData({ ...patientData, phone: e.target.value.replace(/[^0-9+]/g, '') })} icon={Phone} />
                    <div className="grid grid-cols-2 gap-5 sm:col-span-2">
                      <SelectField label="Nature ID" options={["CIN", "Passeport", "Séjour"]} value="CIN" required />
                      <InputField label="N° Pièce Identité" required value={patientData.cin} error={showErrors && !patientData.cin} onChange={(e: any) => setPatientData({ ...patientData, cin: e.target.value })} />
                    </div>
                    <InputField label="Profession" value={patientData.profession} onChange={(e: any) => setPatientData({ ...patientData, profession: e.target.value })} icon={Briefcase} />
                    <div className="flex flex-col space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Groupe Sanguin</label>
                      <select value={patientData.bloodGroup} onChange={(e: any) => setPatientData({ ...patientData, bloodGroup: e.target.value })} className="bg-white border border-slate-200 rounded-xl py-2 px-4 text-sm font-bold text-red-600 outline-none focus:ring-4 focus:ring-emerald-500/10">
                        <option value="">Inconnu</option>
                        <option>A+</option><option>A-</option><option>B+</option><option>B-</option>
                        <option>AB+</option><option>AB-</option><option>O+</option><option>O-</option>
                      </select>
                    </div>
                  </div>
                </CardSection>

                <div className="space-y-8">
                  <CardSection title="2. Contacts d'urgence" icon={Users} colorClass="text-indigo-600" bgClass="bg-indigo-50" action={<button onClick={() => setPatientData({ ...patientData, emergencyContacts: [...(patientData.emergencyContacts || []), { name: '', relationship: 'Ami(e)', phone: '' }] })} className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-xs font-bold transition-all active:scale-95 shadow-sm">+ Ajouter</button>}>
                    <div className="space-y-4">
                      {patientData.emergencyContacts?.map((c, i) => (
                        <div key={i} className="p-4 bg-slate-50 border rounded-xl relative transition-all hover:border-indigo-200">
                          {patientData.emergencyContacts!.length > 1 && (
                            <button onClick={() => setPatientData({ ...patientData, emergencyContacts: patientData.emergencyContacts?.filter((_, idx) => idx !== i) })} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                          )}
                          <InputField label="Nom" value={c.name} onChange={(e: any) => { const nc = [...patientData.emergencyContacts!]; nc[i].name = e.target.value; setPatientData({ ...patientData, emergencyContacts: nc }); }} />
                          <div className="grid grid-cols-2 gap-4 mt-4">
                            <SelectField label="Relation" options={['Père', 'Mère', 'Conjoint', 'Ami(e)']} value={c.relationship} onChange={(e: any) => { const nc = [...patientData.emergencyContacts!]; nc[i].relationship = e.target.value; setPatientData({ ...patientData, emergencyContacts: nc }); }} />
                            <InputField label="Tél" value={c.phone} onChange={(e: any) => { const nc = [...patientData.emergencyContacts!]; nc[i].phone = e.target.value.replace(/[^0-9+]/g, ''); setPatientData({ ...patientData, emergencyContacts: nc }); }} icon={Phone} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardSection>
                  {isMinor && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-left animate-in zoom-in-95">
                      <div className="flex items-center space-x-3 mb-5"><div className="p-2 bg-amber-500 text-white rounded-lg shadow-sm"><Baby size={20} /></div><h4 className="font-bold text-amber-900 text-xs uppercase tracking-tight">3. Tuteur Légal (Mineur)</h4></div>
                      <div className="grid grid-cols-2 gap-4">
                        <InputField label="Nom" required value={patientData.guardian?.lastName} error={showErrors && !patientData.guardian?.lastName} onChange={(e: any) => handleGuardianChange('lastName', e.target.value.toUpperCase())} />
                        <InputField label="Prénom" required value={patientData.guardian?.firstName} error={showErrors && !patientData.guardian?.firstName} onChange={(e: any) => handleGuardianChange('firstName', e.target.value)} />
                        <SelectField label="Lien" options={['Père', 'Mère', 'Oncle', 'Frère', 'Soeur', 'Tuteur légal']} value={patientData.guardian?.relationship} error={showErrors && !patientData.guardian?.relationship} onChange={(e: any) => handleGuardianChange('relationship', e.target.value)} required />
                        <InputField label="Tél" value={patientData.guardian?.phone} onChange={(e: any) => handleGuardianChange('phone', e.target.value.replace(/[^0-9+]/g, ''))} icon={Phone} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <CardSection title="4. Localisation & Nationalité" icon={MapPin} colorClass="text-blue-600" bgClass="bg-blue-50">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
                  <SelectField label="Pays" required options={['Maroc', 'France', 'Espagne', 'Sénégal', 'USA']} value={patientData.country} error={showErrors && !patientData.country} onChange={(e: any) => setPatientData({ ...patientData, country: e.target.value })} icon={Globe} />
                  <InputField label="Ville" required value={patientData.city} error={showErrors && !patientData.city} onChange={(e: any) => setPatientData({ ...patientData, city: e.target.value })} icon={MapPin} />
                  <InputField label="CP" value={patientData.zipCode} onChange={(e: any) => setPatientData({ ...patientData, zipCode: e.target.value })} />
                  <SelectField label="Nationalité" required options={['Marocaine', 'Française', 'Espagnole', 'Sénégalaise']} value={patientData.nationality} error={showErrors && !patientData.nationality} onChange={(e: any) => setPatientData({ ...patientData, nationality: e.target.value })} icon={Flag} />
                  <div className="sm:col-span-4"><InputField label="Adresse Actuelle" required value={patientData.address} error={showErrors && !patientData.address} onChange={(e: any) => setPatientData({ ...patientData, address: e.target.value })} icon={MapPin} /></div>
                </div>
              </CardSection>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-left mb-10">
                <div className="px-5 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
                  <div className="flex items-center space-x-3"><div className="p-2 bg-violet-50 text-violet-600 rounded-lg"><CreditCard size={18} /></div><h4 className="font-bold text-slate-800 text-xs uppercase tracking-tight">5. Assurance</h4></div>
                  <label onClick={() => setPatientData({ ...patientData, isPayant: !patientData.isPayant })} className={`flex items-center space-x-4 cursor-pointer px-4 py-1.5 rounded-xl border transition-all ${patientData.isPayant ? 'bg-emerald-50 border-emerald-500 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${patientData.isPayant ? 'text-emerald-700' : 'text-slate-500'}`}>Patient Payant (Direct)</span>
                    <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center ${patientData.isPayant ? 'bg-white border-emerald-500 text-emerald-600' : 'bg-white border-slate-300 text-transparent'}`}><Check size={14} strokeWidth={4} /></div>
                  </label>
                </div>
                <div className={`p-5 transition-opacity ${patientData.isPayant ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                  {!patientData.isPayant ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                      <SelectField label="Organisme" options={['CNSS', 'CNOPS', 'AXA', 'WAFA', 'CIMR']} value={patientData.insurance?.mainOrg} onChange={(e: any) => handleInsuranceChange('mainOrg', e.target.value)} required icon={Building2} />
                      <div className="grid grid-cols-2 gap-4">
                        <SelectField label="Lien Assuré" options={['Lui-même', 'Conjoint', 'Enfant', 'Père', 'Mère']} value={patientData.insurance?.relationship} onChange={(e: any) => handleInsuranceChange('relationship', e.target.value)} required />
                        <InputField label="N° Immatriculation" value={patientData.insurance?.registrationNumber} onChange={(e: any) => handleInsuranceChange('registrationNumber', e.target.value.replace(/[^0-9+]/g, ''))} icon={Hash} />
                      </div>
                    </div>
                  ) : <div className="text-center py-4 text-slate-400 text-xs italic">Mode paiement direct activé. Aucun organisme de tiers-payant requis.</div>}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8 animate-in slide-in-from-right-4 duration-300 text-left">
              {/* Patient Banner */}
              <div className="bg-slate-900 rounded-3xl p-5 text-white flex items-center justify-between shadow-2xl ring-1 ring-white/10 shrink-0">
                <div className="flex items-center space-x-5">
                  <div className="h-14 w-14 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400 border border-emerald-500/30 shadow-inner ring-1 ring-white/5">
                    <User size={28} />
                  </div>
                  <div>
                    <h4 className="text-lg font-black uppercase tracking-tight">{patientData.lastName} {patientData.firstName}</h4>
                    <div className="flex items-center space-x-3 mt-0.5">
                      <span className="text-slate-400 text-[10px] font-black bg-white/5 px-2 py-0.5 rounded border border-white/5">{patientData.ipp}</span>
                      <span className="text-slate-500 text-[10px] font-bold uppercase">{calculateAge(patientData.dateOfBirth || '')} ANS • {patientData.gender}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                  <ShieldCheck size={14} className="text-emerald-400" />
                  <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Identité Vérifiée</span>
                </div>
              </div>

              {/* Form Grid with Searchable Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm shrink-0">
                <SearchableSelect label="Type d'admission" options={ADMISSION_TYPES} value={admissionData.type} onChange={(v: string) => setAdmissionData({ ...admissionData, type: v })} icon={Hospital} required />
                <SearchableSelect label="Devise" options={CURRENCIES} value={admissionData.currency} onChange={(v: string) => setAdmissionData({ ...admissionData, currency: v })} icon={Coins} required />
                <SearchableSelect label="Médecin traitant" options={DOCTORS} value={admissionData.doctorName} onChange={(v: string) => setAdmissionData({ ...admissionData, doctorName: v })} icon={Stethoscope} required />
                <SearchableSelect label="Motif d'admission" options={ADMISSION_REASONS} value={admissionData.reason} onChange={(v: string) => setAdmissionData({ ...admissionData, reason: v })} icon={Hash} required />
                <SearchableSelect label="Mode d'arrivée" options={ARRIVAL_MODES} value={admissionData.arrivalMode} onChange={(v: string) => setAdmissionData({ ...admissionData, arrivalMode: v })} icon={Truck} required />
                <SearchableSelect label="Provenance" options={PROVENANCES} value={admissionData.provenance} onChange={(v: string) => setAdmissionData({ ...admissionData, provenance: v })} icon={MapPin} required />
                <div className="md:col-span-2">
                  <SearchableSelect
                    label="Service Hospitalier"
                    options={SERVICES}
                    value={admissionData.service}
                    onChange={handleServiceChange}
                    icon={Building2}
                    required
                  />
                </div>
              </div>

              {/* Room Selection Grid */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center">
                    <Bed size={18} className="mr-2 text-indigo-600" />
                    Choix de la Chambre & du Lit
                  </h3>
                  <span className={`text-[10px] font-bold px-3 py-1 rounded-full border transition-all ${selectedBedId ? 'bg-indigo-50 text-indigo-600 border-indigo-200 shadow-sm' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                    SÉLECTION : {selectedBedId ? `LIT #${selectedBedId.toUpperCase()}` : 'AUCUNE'}
                  </span>
                </div>

                {!admissionData.service ? (
                  <div className="bg-slate-100/50 border-2 border-dashed border-slate-200 rounded-[2rem] py-16 flex flex-col items-center justify-center text-slate-400 space-y-4 animate-pulse">
                    <div className="p-4 bg-white rounded-full shadow-sm">
                      <ArrowUpRight size={32} />
                    </div>
                    <p className="text-sm font-bold uppercase tracking-widest">Veuillez d'abord sélectionner un service hospitalier</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    {filteredRooms.map(room => (
                      <div key={room.id} className={`bg-white rounded-2xl border transition-all overflow-hidden flex flex-col group ${selectedBedId?.startsWith(room.id) ? 'border-indigo-500 shadow-lg ring-1 ring-indigo-500/20' : 'border-slate-200 shadow-sm hover:border-indigo-300'}`}>
                        <div className={`px-4 py-2 border-b flex justify-between items-center transition-colors ${selectedBedId?.startsWith(room.id) ? 'bg-indigo-600 text-white' : 'bg-slate-50 border-slate-100 group-hover:bg-indigo-50/30'}`}>
                          <span className="text-[10px] font-black uppercase tracking-wider">CHAMBRE {room.number}</span>
                          <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase ${selectedBedId?.startsWith(room.id) ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>{room.type}</span>
                        </div>
                        <div className="p-4 grid grid-cols-2 gap-3">
                          {room.beds.map((bed: any) => {
                            const isOccupied = bed.status === 'occupied';
                            const isSelected = selectedBedId === bed.id;
                            return (
                              <button
                                key={bed.id}
                                disabled={isOccupied}
                                onClick={() => setSelectedBedId(bed.id)}
                                className={`
                                     flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all h-20
                                     ${isOccupied
                                    ? 'bg-red-50 border-red-100 text-red-300 cursor-not-allowed grayscale'
                                    : isSelected
                                      ? 'bg-emerald-50 border-emerald-500 text-emerald-600 ring-2 ring-emerald-100 shadow-md transform scale-105 z-10'
                                      : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-200 hover:text-indigo-500 hover:bg-slate-50'
                                  }
                                   `}
                              >
                                <Bed size={22} className={isSelected ? 'animate-bounce' : ''} />
                                <span className="text-[10px] font-black uppercase mt-1.5">{bed.label}</span>
                                <span className={`text-[8px] font-extrabold uppercase px-1 rounded-sm mt-0.5 ${isOccupied ? 'text-red-500' : isSelected ? 'text-emerald-700' : 'text-slate-400'}`}>
                                  {isOccupied ? 'Occupé' : 'Libre'}
                                </span>
                              </button>
                            );
                          })}
                          {room.type === 'Individuelle' && (
                            <div className="h-20 bg-slate-50/30 rounded-xl border-2 border-dashed border-slate-100 flex items-center justify-center text-[8px] font-black text-slate-200 uppercase px-2 text-center leading-tight">
                              Emplacement<br />vide
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-5 bg-white border-t flex justify-between items-center shrink-0">
          <div>{step === 2 && <button onClick={() => setStep(1)} className="text-slate-400 font-black uppercase text-xs hover:text-slate-900 transition-colors border border-transparent hover:border-slate-100 px-4 py-2 rounded-xl">Retour</button>}</div>
          <div className="flex space-x-4">
            <button onClick={onClose} className="px-6 py-2.5 text-slate-400 font-black uppercase text-xs hover:text-slate-600">Annuler</button>
            <button
              onClick={step === 1 ? handleContinueAdmission : handleCreateAdmission}
              className={`px-10 py-3 rounded-xl font-black uppercase text-xs transition-all shadow-xl flex items-center active:scale-95 ${step === 1
                ? isStep1Valid
                  ? 'bg-slate-900 text-white hover:bg-black shadow-slate-900/20'
                  : 'bg-slate-300 text-slate-100 cursor-not-allowed grayscale'
                : (admissionData.type && admissionData.doctorName && selectedBedId)
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-600/30'
                  : 'bg-slate-300 text-slate-100 cursor-not-allowed grayscale'
                }`}
            >
              <span>{step === 1 ? 'Suivant' : "Créer l'admission"}</span>
              <ChevronRight size={18} className="ml-2" />
            </button>
          </div>
        </div>
      </div>

      {/* Duplicate Conflict Modal */}
      {duplicateConflict && (
        <DuplicateConflictModal
          patient={duplicateConflict}
          onCancel={() => setDuplicateConflict(null)}
          onRedirect={() => { navigate(`/patient/${duplicateConflict.id}`); setDuplicateConflict(null); onClose(); }}
        />
      )}

      {/* Search Overlay */}
      {isSearchOpen && (
        <div className="fixed top-0 left-0 w-screen h-screen z-[200] flex items-center justify-center bg-slate-900/95 p-4 animate-in fade-in duration-200 backdrop-blur-xl">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col h-[70vh] border border-white/20">
            <div className="p-8 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-600">Moteur de Recherche Patient</h4>
                <button onClick={() => setIsSearchOpen(false)} className="p-2 text-slate-400 hover:text-slate-900 transition-colors bg-white rounded-full shadow-sm"><X size={20} /></button>
              </div>
              <div className="relative group">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={24} />
                <input
                  type="text"
                  placeholder="Nom, Prénom, IPP ou CIN..."
                  className="w-full bg-white border-2 border-slate-100 rounded-3xl pl-16 pr-8 py-5 text-lg text-slate-800 focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-500 shadow-inner transition-all outline-none font-bold placeholder:text-slate-300"
                  autoFocus
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-slate-50/30">
              <table className="w-full text-left border-separate border-spacing-y-3">
                <tbody>
                  {filteredPatients.map((p) => (
                    <tr key={p.id} onClick={() => handlePatientSelect(p)} className="group cursor-pointer transition-all">
                      <td className="bg-white rounded-l-3xl p-4 border-l border-y border-slate-100 group-hover:bg-indigo-600 group-hover:border-indigo-600 transition-all">
                        <div className="flex items-center space-x-5">
                          <div className="h-14 w-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-white/20 group-hover:text-white transition-all shadow-inner border border-slate-100 group-hover:border-transparent">
                            <User size={28} />
                          </div>
                          <div>
                            <span className="font-black text-slate-800 uppercase text-lg group-hover:text-white transition-all leading-tight block">{p.lastName} {p.firstName}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-indigo-200 transition-all">{calculateAge(p.dateOfBirth)} ANS • {p.gender}</span>
                          </div>
                        </div>
                      </td>
                      <td className="bg-white rounded-r-3xl p-4 border-r border-y border-slate-100 group-hover:bg-indigo-600 group-hover:border-indigo-600 transition-all text-right pr-8">
                        <div className="flex flex-col items-end">
                          <span className="text-slate-900 font-black font-mono group-hover:text-white transition-all text-sm">{p.ipp}</span>
                          {p.cin && <span className="text-[10px] font-black text-slate-300 uppercase mt-1 group-hover:text-indigo-200 transition-all tracking-tighter">{p.cin}</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-8 border-t border-slate-100 flex justify-end bg-white">
              <button onClick={() => setIsSearchOpen(false)} className="px-10 py-3 bg-slate-900 hover:bg-black rounded-2xl text-white font-black uppercase text-[10px] tracking-[0.2em] transition-all shadow-xl active:scale-95">Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
