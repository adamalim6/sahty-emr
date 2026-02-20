
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { calculateAge, generateIPP } from '../constants';
import { Gender, Patient } from '../types';
import {
  Search,
  User,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ShieldCheck,
  CreditCard,
  MapPin,
  Users,
  Smartphone,
  Calendar,
  Phone,
  Mail,
  Fingerprint,
  Briefcase,
  Droplet,
  Baby,
  ChevronDown,
  Hash,
  Globe,
  Flag,
  Check,
  Trash2,
  IdCard,
  AlertOctagon,
  Building2
} from 'lucide-react';

// --- Constants ---
const ORGANISM_OPTIONS = ["CNSS", "CNOPS", "AXA", "WAFA", "CIMR", "MGBM"];
const RELATIONSHIP_OPTIONS = ["Lui-même", "Conjoint", "Enfant", "Père", "Mère"];
const GUARDIAN_RELATIONSHIPS = ["Père", "Mère", "Oncle", "Frère", "Soeur", "Tuteur légal"];
const EMERGENCY_RELATIONSHIPS = ["Père", "Mère", "Frère", "Soeur", "Oncle", "Ami(e)"];
const IDENTITY_TYPES = ["CIN", "Passeport", "Carte de séjour"];
const WORLD_COUNTRIES = ["Maroc", "France", "Espagne", "Sénégal", "USA"].sort();
const NATIONALITIES = ["Marocaine", "Française", "Espagnole", "Sénégalaise"].sort();

// --- Sub-components ---
const InputField = ({ label, value, onChange, placeholder, type = "text", required = false, disabled = false, icon: Icon }: any) => (
  <div className="flex flex-col space-y-1.5 w-full">
    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center">
      {label} {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    <div className="relative group">
      {Icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors pointer-events-none"><Icon size={16} /></div>}
      <input
        type={type} value={value || ''} onChange={onChange} disabled={disabled} placeholder={placeholder}
        className={`w-full rounded-xl border border-slate-200 py-2.5 text-sm transition-all outline-none ${Icon ? 'pl-10' : 'pl-4'} pr-4 ${disabled ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white text-slate-900 hover:border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10'}`}
      />
    </div>
  </div>
);

const SelectField = ({ label, value, onChange, options, required = false, disabled = false, icon: Icon }: any) => (
  <div className="flex flex-col space-y-1.5 w-full">
    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center">{label} {required && <span className="text-red-500 ml-1">*</span>}</label>
    <div className="relative group">
      {Icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10 pointer-events-none"><Icon size={16} /></div>}
      <select value={value || ''} onChange={onChange} disabled={disabled} className={`w-full rounded-xl border border-slate-200 py-2.5 text-sm transition-all outline-none appearance-none ${Icon ? 'pl-10' : 'pl-4'} pr-10 ${disabled ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white text-slate-900 hover:border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10'}`}>
        <option value="" disabled>Sélectionner...</option>
        {options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><ChevronDown size={16} /></div>
    </div>
  </div>
);

const GenderToggle = ({ value, onChange, disabled = false }: { value: Gender, onChange: (g: Gender) => void, disabled?: boolean }) => (
  <div className="flex flex-col space-y-1.5 w-full">
    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Sexe <span className="text-red-500 ml-1">*</span></label>
    <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200">
      <button type="button" disabled={disabled} onClick={() => onChange(Gender.Male)} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${value === Gender.Male ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Homme</button>
      <button type="button" disabled={disabled} onClick={() => onChange(Gender.Female)} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${value === Gender.Female ? 'bg-white text-pink-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Femme</button>
    </div>
  </div>
);

const CardSection = ({ title, icon: Icon, children, colorClass = "text-emerald-600", bgClass = "bg-emerald-50", action }: any) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
      <div className="flex items-center space-x-3"><div className={`p-2 rounded-lg ${bgClass} ${colorClass}`}><Icon size={18} /></div><h4 className="font-bold text-slate-800 text-sm uppercase tracking-tight">{title}</h4></div>
      {action && <div>{action}</div>}
    </div>
    <div className="p-6">{children}</div>
  </div>
);

// --- Alert Component ---
import { api } from '../services/api';
import { PatientIdentityForm } from './PatientIdentityForm';

// ... (other imports)

export const PatientList: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    api.getPatients()
      .then(setPatients)
      .catch(err => console.error("Failed to fetch patients", err));
  }, []);
  const navigate = useNavigate();

  const filteredPatients = patients.filter(p =>
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.ipp.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.cin?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Cleaned up unused legacy handlers and state (formData, etc)

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div><h2 className="text-2xl font-bold text-slate-900 tracking-tight">Liste des Patients</h2><p className="text-slate-500">Gestion et admission des patients.</p></div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative w-full md:w-80">
            <Search className="absolute inset-y-0 left-3 h-full flex items-center text-slate-400" size={20} />
            <input type="text" className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 focus:ring-4 focus:ring-emerald-500/10" placeholder="Rechercher IPP, nom, CIN..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <button onClick={() => setIsModalOpen(true)} className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg active:scale-95 transition-all"><Plus size={20} /><span>Ajouter un patient</span></button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPatients.map(patient => {
          const docTypeLabel: Record<string, string> = { CIN: 'CIN', PASSPORT: 'Passeport', CARTE_SEJOUR: 'Carte de séjour' };
          const lifecycleLabel: Record<string, string> = { ACTIVE: 'Actif', MERGED: 'Fusionné', INACTIVE: 'Inactif' };
          const identityLabel: Record<string, string> = { UNKNOWN: 'Inconnu', PROVISIONAL: 'Provisoire', VERIFIED: 'Vérifié' };
          const identityColor: Record<string, string> = { UNKNOWN: 'bg-slate-100 text-slate-600 border-slate-200', PROVISIONAL: 'bg-amber-50 text-amber-700 border-amber-200', VERIFIED: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
          const lifecycleColor: Record<string, string> = { ACTIVE: 'bg-blue-50 text-blue-700 border-blue-200', MERGED: 'bg-purple-50 text-purple-700 border-purple-200', INACTIVE: 'bg-red-50 text-red-600 border-red-200' };

          return (
          <div key={patient.id} onClick={() => navigate(`/patient/${patient.id}`)} className="bg-white rounded-2xl shadow-sm border p-6 transition-all cursor-pointer group hover:shadow-xl hover:-translate-y-1">
            <div className="flex items-start space-x-4">
              <div className={`h-14 w-14 rounded-2xl flex items-center justify-center border-2 ${patient.gender === Gender.Female ? 'bg-pink-50 text-pink-500 border-pink-100' : 'bg-blue-50 text-blue-500 border-blue-100'}`}><User size={28} /></div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-slate-900 truncate uppercase">{patient.lastName} {patient.firstName}</h3>
                <div className="flex flex-col space-y-1.5 mt-2">
                  {patient.ipp && <span className="text-[10px] font-black bg-slate-100 border px-2 py-0.5 rounded text-slate-500 uppercase w-fit flex items-center"><Hash size={10} className="mr-1" />IPP: {patient.ipp}</span>}
                  {patient.primaryDocValue && <div className="flex items-center space-x-1.5 text-slate-500"><IdCard size={12} /><span className="text-[10px] font-bold uppercase">{docTypeLabel[patient.primaryDocType || ''] || patient.primaryDocType}: {patient.primaryDocValue}</span></div>}
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center flex-wrap gap-2">
                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${patient.gender === Gender.Female ? 'bg-pink-50 text-pink-700 border-pink-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                  {patient.gender === Gender.Female ? 'FEMME' : 'HOMME'}
                </span>
                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${lifecycleColor[patient.lifecycleStatus || 'ACTIVE']}`}>{lifecycleLabel[patient.lifecycleStatus || 'ACTIVE']}</span>
                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${identityColor[patient.identityStatus || 'UNKNOWN']}`}>{patient.identityStatus === 'VERIFIED' && <CheckCircle2 size={9} className="inline mr-0.5 -mt-px" />}{identityLabel[patient.identityStatus || 'UNKNOWN']}</span>
              </div>
              <ChevronRight className="text-slate-300 group-hover:text-emerald-500 transition-all group-hover:translate-x-1" size={18} />
            </div>
          </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col w-full max-w-6xl h-[92vh]">
            <div className="px-8 py-6 flex justify-between items-center text-white bg-emerald-700 relative shrink-0">
              <div className="flex items-center space-x-5">
                <div className="p-3.5 bg-white/10 rounded-2xl border border-white/10 shadow-inner"><Plus size={28} /></div>
                <div><h3 className="text-2xl font-black uppercase tracking-tight leading-tight">Nouveau Patient</h3><span className="text-[11px] font-black uppercase tracking-widest text-white/50">Création Dossier</span></div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-white/10 rounded-2xl transition-all"><X size={26} /></button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50/50 p-8">
               <PatientIdentityForm 
                  onSubmit={async (patientId) => {
                      try {
                          const newPatient = await api.getPatient(patientId);
                          setPatients(prev => [newPatient, ...prev]);
                          setIsModalOpen(false);
                      } catch (e) {
                          console.error("Failed to fetch new patient", e);
                      }
                  }}
                  onCancel={() => setIsModalOpen(false)}
               />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
