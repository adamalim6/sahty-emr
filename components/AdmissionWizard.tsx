
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
import { MOCK_PATIENTS, generateIPP, calculateAge, generateNDA } from '../constants';
import { Patient, Gender, Admission } from '../types';
import { api } from '../services/api';
import { PatientIdentityForm } from './PatientIdentityForm';

interface WizardProps {
  isOpen: boolean;
  onClose: () => void;
}

// --- SEARCHABLE SELECT COMPONENT ---
const SearchableSelect = ({ label, value, onChange, options, required = false, icon: Icon, placeholder = "Rechercher...", emptyMessage = "Aucun résultat" }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

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
            <div className="px-4 py-3 text-xs text-slate-400 italic text-center">{emptyMessage}</div>
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

export const AdmissionWizard: React.FC<WizardProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(1);
  const [selectedBedId, setSelectedBedId] = useState<string | null>(null);
  const navigate = useNavigate();

  // --- DYNAMIC DATA FETCHING ---
  const [doctorsList, setDoctorsList] = useState<string[]>([]);
  const [servicesList, setServicesList] = useState<string[]>([]);
  const [serviceMap, setServiceMap] = useState<Record<string, string>>({}); // Name -> ID
  const [roomDefs, setRoomDefs] = useState<any[]>([]); // Room Definitions
  const [dynamicRooms, setDynamicRooms] = useState<any[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  // Fetch Initial Data
  useEffect(() => {
    // Load patients from API for search
    api.getPatients().then(setApiPatients).catch(console.error);

    const loadData = async () => {
      try {
        // 1. Fetch Users (Doctors)
        const users = await api.getTenantUsers();
        // Assuming strict ID 'role_medecin' as per roles.json
        const docs = users
          .filter((u: any) => u.role_id === 'role_medecin')
          .map((u: any) => `Dr. ${u.prenom?.charAt(0)}. ${u.nom}`.toUpperCase());
        
        setDoctorsList(docs);

        // 2. Fetch Services
        const services = await api.getServices();
        const sList = services.map((s: any) => s.name);
        const sMap: Record<string, string> = {};
        services.forEach((s: any) => sMap[s.name] = s.id);
        
        setServicesList(sList);
        setServiceMap(sMap);

        // 3. Fetch Room Definitions (for bed counts)
        const rooms = await api.getTenantRooms(); 
        setRoomDefs(rooms);

      } catch (err) {
        console.error("Error loading dynamic data:", err);
      }
    };
    loadData();
  }, []);

  const [patientData, setPatientData] = useState<Partial<Patient>>({
    id: undefined, 
    ipp: generateIPP(), firstName: '', lastName: '', gender: Gender.Male, dateOfBirth: '', phone: '', cin: '', country: 'Maroc', city: '', zipCode: '', nationality: 'Marocaine', address: '', isPayant: false, profession: '', bloodGroup: '',
    insurance: { mainOrg: '', relationship: 'Lui-même', registrationNumber: '' }, emergencyContacts: [{ name: '', relationship: 'Père', phone: '' }],
    guardian: { firstName: '', lastName: '', phone: '', relationship: 'Père', idType: 'CIN', idNumber: '', address: '', habilitation: '' }
  });

  const [admissionData, setAdmissionData] = useState<any>({
    type: '', 
    doctorName: '',
    reason: '',
    service: '',
    currency: 'MAD (Dirham)',
    arrivalMode: '',
    provenance: ''
  });

  // Fetch Rooms when Service Changes
  useEffect(() => {
    const fetchServiceRooms = async () => {
      setDynamicRooms([]);
      if (!admissionData.service || !serviceMap[admissionData.service]) return;

      setLoadingRooms(true);
      try {
        const serviceId = serviceMap[admissionData.service];
        const units = await api.getServiceUnits(serviceId); // Get operational units
        
        // Map Units to UI Room Structure
        const mapped = units.map((u: any) => {
           const def = roomDefs.find((r: any) => r.id === u.unit_type_id);
           if (!def || def.unit_category !== 'CHAMBRE') return null; 

           // Generate Beds based on definition
           const bedCount = def.number_of_beds || 1;
           const beds = Array.from({ length: bedCount }, (_, i) => ({
             id: `${u.id}-bed-${i+1}`,
             label: bedCount > 1 ? `LIT ${String.fromCharCode(65 + i)}` : 'LIT', 
             status: 'available' 
           }));

           return {
             id: u.id,
             number: u.name, 
             type: def.unit_category === 'CHAMBRE' ? (def.number_of_beds === 1 ? 'Individuelle' : 'Double') : 'Autre',
             beds
           };
        }).filter(Boolean);

        setDynamicRooms(mapped);
      } catch (err) {
        console.error("Error fetching service rooms:", err);
      } finally {
        setLoadingRooms(false);
      }
    };

    fetchServiceRooms();
  }, [admissionData.service, serviceMap, roomDefs]);

  // Constants
  const ADMISSION_TYPES = ["Hospitalisation complète", "Ambulatoire", "Hôpital de jour", "Urgence", "Séance de soins"];
  const CURRENCIES = ["MAD (Dirham)", "EUR (Euro)", "USD (Dollar)"];
  const ADMISSION_REASONS = ["Chirurgie programmée", "Bilan diagnostique", "Pathologie aiguë", "Suivi post-op", "Obstétrique"];
  const ARRIVAL_MODES = ["Marche", "Fauteuil roulant", "Brancard", "Ambulance", "SMUR"];
  const PROVENANCES = ["Domicile", "Urgences", "Consultation externe", "Transfert inter-hôpital", "Clinique privée"];

  const handleServiceChange = (newService: string) => {
    setAdmissionData({ ...admissionData, service: newService });
    setSelectedBedId(null);
  };

  const handleCreateAdmission = async () => {
    if (!admissionData.type || !admissionData.doctorName) return;

    // Build the admission object
    const newId = `adm-${Date.now()}`;
    const newNDA = generateNDA();

    // Find the room and bed labels
    let roomNum = "";
    let bedLab = "";
    dynamicRooms.forEach((r: any) => {
      const bed = r.beds.find((b: any) => b.id === selectedBedId);
      if (bed) {
        roomNum = r.number;
        bedLab = bed.label;
      }
    });

    try {
      const finalPatientId = patientData.id;

      if (!finalPatientId) {
        console.error("No patient ID found for admission creation.");
        return;
      }

      const newAdmission: Admission = {
        id: newId,
        nda: newNDA,
        patientId: finalPatientId, 
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

      await api.createAdmission(newAdmission);
      onClose();
      navigate(`/admission/${newId}`);
    } catch (error) {
      console.error('Error creating admission:', error);
      alert('Erreur lors de la création de l\'admission');
    }
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
             <div className="animate-in slide-in-from-bottom-4 duration-300">
               <PatientIdentityForm 
                  onSubmit={async (patientId) => {
                      try {
                          const patient = await api.getPatient(patientId);
                          setPatientData({
                              ...patient,
                              insurance: patient.insurance || { mainOrg: '', relationship: 'Lui-même', registrationNumber: '' },
                              emergencyContacts: (patient.emergencyContacts && patient.emergencyContacts.length > 0) ? patient.emergencyContacts : [{ name: '', relationship: 'Père', phone: '' }],
                              guardian: patient.guardian || { firstName: '', lastName: '', phone: '', relationship: 'Père', idType: 'CIN', idNumber: '', address: '', habilitation: '' }
                          });
                          setStep(2);
                      } catch (e) {
                          console.error("Failed to fetch patient details", e);
                      }
                  }}
                  onCancel={onClose}
               />
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
                <SearchableSelect label="Médecin traitant" options={doctorsList} value={admissionData.doctorName} onChange={(v: string) => setAdmissionData({ ...admissionData, doctorName: v })} icon={Stethoscope} required emptyMessage="Aucun médecin disponible pour ce client" />
                <SearchableSelect label="Motif d'admission" options={ADMISSION_REASONS} value={admissionData.reason} onChange={(v: string) => setAdmissionData({ ...admissionData, reason: v })} icon={Hash} required />
                <SearchableSelect label="Mode d'arrivée" options={ARRIVAL_MODES} value={admissionData.arrivalMode} onChange={(v: string) => setAdmissionData({ ...admissionData, arrivalMode: v })} icon={Truck} required />
                <SearchableSelect label="Provenance" options={PROVENANCES} value={admissionData.provenance} onChange={(v: string) => setAdmissionData({ ...admissionData, provenance: v })} icon={MapPin} required />
                <div className="md:col-span-2">
                  <SearchableSelect
                    label="Service Hospitalier"
                    options={servicesList}
                    value={admissionData.service}
                    onChange={handleServiceChange}
                    icon={Building2}
                    required
                    emptyMessage="Aucun service hospitalier configuré pour ce client"
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
                ) : loadingRooms ? (
                   <div className="flex justify-center p-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div></div>
                ) : dynamicRooms.length === 0 ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-slate-400 font-medium italic">
                        Aucune chambre configurée pour ce service.
                    </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    {dynamicRooms.map(room => (
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

        {/* Footer - Only for Step 2 */}
        {step === 2 && (
          <div className="px-8 py-5 bg-white border-t flex justify-between items-center shrink-0">
            <div><button onClick={() => setStep(1)} className="text-slate-400 font-black uppercase text-xs hover:text-slate-900 transition-colors border border-transparent hover:border-slate-100 px-4 py-2 rounded-xl">Retour</button></div>
            <div className="flex space-x-4">
              <button onClick={onClose} className="px-6 py-2.5 text-slate-400 font-black uppercase text-xs hover:text-slate-600">Annuler</button>
              <button
                onClick={handleCreateAdmission}
                className={`px-10 py-3 rounded-xl font-black uppercase text-xs transition-all shadow-xl flex items-center active:scale-95 ${
                  (admissionData.type && admissionData.doctorName && admissionData.service)
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-600/30'
                    : 'bg-slate-300 text-slate-100 cursor-not-allowed grayscale'
                  }`}
              >
                <span>Créer l'admission</span>
                <ChevronRight size={18} className="ml-2" />
              </button>
            </div>
          </div>
        )}
    </div>

      {/* Search Overlay - REMOVED */}
    </div>
  );
};
