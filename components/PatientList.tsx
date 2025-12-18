
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
  Lock,
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

import { api } from '../services/api';

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
  const [modalMode, setModalMode] = useState<'simple' | 'complet'>('simple');
  const [duplicateConflict, setDuplicateConflict] = useState<Patient | null>(null);
  const navigate = useNavigate();

  const [formData, setFormData] = useState<Partial<Patient>>({
    firstName: '', lastName: '', gender: Gender.Male, dateOfBirth: '', phone: '', cin: '', isPayant: false,
    ipp: generateIPP(), emergencyContacts: [{ name: '', relationship: 'Père', phone: '' }],
    country: 'Maroc', nationality: 'Marocaine', address: '',
    insurance: { mainOrg: '', relationship: 'Lui-même', registrationNumber: '' },
    // Fix: Added missing 'habilitation' property required by the guardian interface
    guardian: { firstName: '', lastName: '', phone: '', relationship: 'Père', idType: 'CIN', idNumber: '', address: '', habilitation: '' }
  });

  const filteredPatients = patients.filter(p =>
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.ipp.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.cin?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSave = (finalStatus: 'provisional' | 'complete') => {
    if (!formData.firstName || !formData.lastName || !formData.dateOfBirth) {
      alert("Veuillez remplir les champs obligatoires (Nom, Prénom, Date de naissance)"); return;
    }

    if (formData.cin) {
      const duplicate = patients.find(p => p.id !== formData.id && p.cin?.toLowerCase() === formData.cin?.toLowerCase());
      if (duplicate) {
        setDuplicateConflict(duplicate);
        return;
      }
    }

    const updatedPatient: Patient = { ...formData as Patient, isProvisional: finalStatus === 'provisional' };
    setPatients(prev => {
      const exists = prev.find(p => p.id === updatedPatient.id);
      return exists ? prev.map(p => p.id === updatedPatient.id ? updatedPatient : p) : [updatedPatient, ...prev];
    });
    setIsModalOpen(false);
  };

  const handleInsuranceChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, insurance: { ...(prev.insurance || { mainOrg: '', relationship: 'Lui-même' }), [field]: value } }));
  };

  const handleGuardianChange = (field: string, value: string) => {
    // Fix: Updated the default object to include all mandatory fields of the guardian interface to satisfy TypeScript
    setFormData(prev => ({ ...prev, guardian: { ...(prev.guardian || { firstName: '', lastName: '', phone: '', relationship: 'Père', idType: 'CIN', idNumber: '', address: '', habilitation: '' }), [field]: value } }));
  };

  const formatPhoneNumber = (val: string) => val.replace(/[^0-9+]/g, '');

  const isMinor = formData.dateOfBirth ? calculateAge(formData.dateOfBirth) < 18 : false;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div><h2 className="text-2xl font-bold text-slate-900 tracking-tight">Liste des Patients</h2><p className="text-slate-500">Gestion et admission des patients.</p></div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative w-full md:w-80">
            <Search className="absolute inset-y-0 left-3 h-full flex items-center text-slate-400" size={20} />
            <input type="text" className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 focus:ring-4 focus:ring-emerald-500/10" placeholder="Rechercher IPP, nom, CIN..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <button onClick={() => { setFormData({ ...formData, id: Date.now().toString(), ipp: generateIPP(), isProvisional: true }); setIsModalOpen(true); setModalMode('simple'); }} className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg active:scale-95 transition-all"><Plus size={20} /><span>Ajouter un patient</span></button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPatients.map(patient => (
          <div key={patient.id} onClick={() => navigate(`/patient/${patient.id}`)} className="bg-white rounded-2xl shadow-sm border p-6 transition-all cursor-pointer group hover:shadow-xl hover:-translate-y-1">
            <div className="flex items-start space-x-4">
              <div className={`h-14 w-14 rounded-2xl flex items-center justify-center border-2 ${patient.gender === Gender.Female ? 'bg-pink-50 text-pink-500 border-pink-100' : 'bg-blue-50 text-blue-500 border-blue-100'}`}><User size={28} /></div>
              <div className="flex-1 min-w-0"><h3 className="text-lg font-bold text-slate-900 truncate uppercase">{patient.lastName} {patient.firstName}</h3><div className="flex flex-col space-y-1 mt-1.5"><span className="text-[10px] font-black bg-slate-100 border px-2 py-0.5 rounded text-slate-500 uppercase w-fit">{patient.ipp}</span>{patient.cin && <div className="flex items-center space-x-1.5 text-slate-400"><IdCard size={12} /><span className="text-[10px] font-bold uppercase">{patient.cin}</span></div>}</div></div>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between"><span className={`text-[10px] font-black uppercase tracking-widest ${patient.isProvisional ? 'text-amber-600' : 'text-emerald-600'} flex items-center`}>{patient.isProvisional ? <Lock size={12} className="mr-1.5" /> : <CheckCircle2 size={12} className="mr-1.5" />} {patient.isProvisional ? 'Accès Bloqué' : 'Dossier Prêt'}</span><ChevronRight className="text-slate-300 group-hover:text-emerald-500 transition-all group-hover:translate-x-1" size={18} /></div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col transition-all duration-500 ${modalMode === 'simple' ? 'w-full max-w-xl' : 'w-full max-w-6xl h-[92vh]'}`}>
            <div className={`px-8 py-6 flex justify-between items-center text-white relative ${modalMode === 'simple' ? 'bg-slate-900' : 'bg-emerald-700'}`}>
              <div className="flex items-center space-x-5"><div className="p-3.5 bg-white/10 rounded-2xl border border-white/10 shadow-inner">{modalMode === 'simple' ? <Smartphone size={28} /> : <ShieldCheck size={28} />}</div><div><h3 className="text-2xl font-black uppercase tracking-tight leading-tight">{modalMode === 'simple' ? 'Patient Provisoire' : 'Dossier Patient Complet'}</h3><span className="text-[11px] font-black uppercase tracking-widest text-white/50">IPP: {formData.ipp}</span></div></div>
              <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-white/10 rounded-2xl transition-all"><X size={26} /></button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50/50 p-8 space-y-8">
              {modalMode === 'simple' ? (
                <div className="grid grid-cols-2 gap-6 animate-in slide-in-from-bottom-4">
                  <InputField label="Nom" required value={formData.lastName} onChange={(e: any) => setFormData({ ...formData, lastName: e.target.value.toUpperCase() })} />
                  <InputField label="Prénom" required value={formData.firstName} onChange={(e: any) => setFormData({ ...formData, firstName: e.target.value })} />
                  <InputField label="Date de naissance" required type="date" value={formData.dateOfBirth} onChange={(e: any) => setFormData({ ...formData, dateOfBirth: e.target.value })} icon={Calendar} />
                  <GenderToggle value={formData.gender as Gender} onChange={(g) => setFormData({ ...formData, gender: g })} />
                  <div className="col-span-2"><InputField label="Téléphone" value={formData.phone} onChange={(e: any) => setFormData({ ...formData, phone: formatPhoneNumber(e.target.value) })} icon={Phone} /></div>
                  <div className="col-span-2"><InputField label="N° Pièce Identité (Facultatif)" value={formData.cin} onChange={(e: any) => setFormData({ ...formData, cin: e.target.value })} icon={IdCard} /></div>
                </div>
              ) : (
                <div className="space-y-8 animate-in slide-in-from-bottom-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* 1. Identité */}
                    <CardSection title="1. Informations Patient" icon={User}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <InputField label="IPP" disabled value={formData.ipp} icon={Fingerprint} />
                        <GenderToggle value={formData.gender as Gender} onChange={(g) => setFormData({ ...formData, gender: g })} />
                        <InputField label="Nom" required value={formData.lastName} onChange={(e: any) => setFormData({ ...formData, lastName: e.target.value.toUpperCase() })} />
                        <InputField label="Prénom" required value={formData.firstName} onChange={(e: any) => setFormData({ ...formData, firstName: e.target.value })} />
                        <InputField label="Naissance" required type="date" value={formData.dateOfBirth} onChange={(e: any) => setFormData({ ...formData, dateOfBirth: e.target.value })} icon={Calendar} />
                        <InputField label="Téléphone" value={formData.phone} onChange={(e: any) => setFormData({ ...formData, phone: formatPhoneNumber(e.target.value) })} icon={Phone} />
                        <div className="sm:col-span-2"><InputField label="Email" value={formData.email} onChange={(e: any) => setFormData({ ...formData, email: e.target.value })} icon={Mail} /></div>
                        <div className="grid grid-cols-2 gap-5 sm:col-span-2">
                          <SelectField label="Nature Identité" options={IDENTITY_TYPES} value="CIN" required />
                          <InputField label="N° Pièce Identité" required value={formData.cin} onChange={(e: any) => setFormData({ ...formData, cin: e.target.value })} />
                        </div>
                        <InputField label="Profession" value={formData.profession} onChange={(e: any) => setFormData({ ...formData, profession: e.target.value })} icon={Briefcase} />
                        <div className="flex flex-col space-y-1.5"><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Groupe Sanguin</label><select value={formData.bloodGroup} onChange={(e: any) => setFormData({ ...formData, bloodGroup: e.target.value })} className="bg-white border border-slate-200 rounded-xl py-2.5 px-4 text-sm font-bold text-red-600"><option value="">Inconnu</option><option>A+</option><option>A-</option><option>B+</option><option>B-</option><option>AB+</option><option>AB-</option><option>O+</option><option>O-</option></select></div>
                      </div>
                    </CardSection>

                    {/* 2. Contacts & Tuteur */}
                    <div className="space-y-8">
                      <CardSection title="2. Contacts d'urgence" icon={Users} colorClass="text-indigo-600" bgClass="bg-indigo-50" action={<button onClick={() => setFormData({ ...formData, emergencyContacts: [...(formData.emergencyContacts || []), { name: '', relationship: 'Ami(e)', phone: '' }] })} className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-xs font-bold">+ Ajouter</button>}>
                        <div className="space-y-4">
                          {formData.emergencyContacts?.map((c, i) => (
                            <div key={i} className="p-4 bg-slate-50 border border-slate-200 rounded-xl relative">
                              {/* SÉCURITÉ : Empêcher la suppression du dernier contact d'urgence */}
                              {formData.emergencyContacts!.length > 1 && (
                                <button onClick={() => setFormData({ ...formData, emergencyContacts: formData.emergencyContacts?.filter((_, idx) => idx !== i) })} className="absolute top-2 right-2 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                              )}
                              <InputField label="Nom complet" value={c.name} onChange={(e: any) => { const nc = [...formData.emergencyContacts!]; nc[i].name = e.target.value; setFormData({ ...formData, emergencyContacts: nc }); }} />
                              <div className="grid grid-cols-2 gap-4 mt-4">
                                <SelectField label="Relation" options={EMERGENCY_RELATIONSHIPS} value={c.relationship} onChange={(e: any) => { const nc = [...formData.emergencyContacts!]; nc[i].relationship = e.target.value; setFormData({ ...formData, emergencyContacts: nc }); }} />
                                <InputField label="Tél" value={c.phone} onChange={(e: any) => { const nc = [...formData.emergencyContacts!]; nc[i].phone = formatPhoneNumber(e.target.value); setFormData({ ...formData, emergencyContacts: nc }); }} icon={Phone} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardSection>

                      {isMinor && (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 animate-in zoom-in-95">
                          <div className="flex items-center space-x-3 mb-5"><div className="p-2 bg-amber-500 text-white rounded-lg"><Baby size={20} /></div><h4 className="font-bold text-amber-900 text-sm uppercase">3. Tuteur Légal (Mineur)</h4></div>
                          <div className="grid grid-cols-2 gap-4 text-left">
                            <InputField label="Nom" required value={formData.guardian?.lastName} onChange={(e: any) => handleGuardianChange('lastName', e.target.value.toUpperCase())} />
                            <InputField label="Prénom" required value={formData.guardian?.firstName} onChange={(e: any) => handleGuardianChange('firstName', e.target.value)} />
                            <SelectField label="Lien" options={GUARDIAN_RELATIONSHIPS} value={formData.guardian?.relationship} onChange={(e: any) => handleGuardianChange('relationship', e.target.value)} required />
                            <InputField label="Tél" value={formData.guardian?.phone} onChange={(e: any) => handleGuardianChange('phone', formatPhoneNumber(e.target.value))} icon={Phone} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 4. Localisation */}
                  <CardSection title="4. Localisation & Nationalité" icon={MapPin} colorClass="text-blue-600" bgClass="bg-blue-50">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
                      <SelectField label="Pays" required options={WORLD_COUNTRIES} value={formData.country} onChange={(e: any) => setFormData({ ...formData, country: e.target.value })} icon={Globe} />
                      <InputField label="Ville" required value={formData.city} onChange={(e: any) => setFormData({ ...formData, city: e.target.value })} icon={MapPin} />
                      <InputField label="CP" value={formData.zipCode} onChange={(e: any) => setFormData({ ...formData, zipCode: e.target.value })} />
                      <SelectField label="Nationalité" required options={NATIONALITIES} value={formData.nationality} onChange={(e: any) => setFormData({ ...formData, nationality: e.target.value })} icon={Flag} />
                      <div className="sm:col-span-4"><InputField label="Adresse" required value={formData.address} onChange={(e: any) => setFormData({ ...formData, address: e.target.value })} icon={MapPin} /></div>
                    </div>
                  </CardSection>

                  {/* 5. Assurance */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
                      <div className="flex items-center space-x-3"><div className="p-2 bg-violet-50 text-violet-600 rounded-lg"><CreditCard size={18} /></div><h4 className="font-bold text-slate-800 text-sm uppercase">5. Assurance</h4></div>
                      <label onClick={() => setFormData({ ...formData, isPayant: !formData.isPayant })} className={`flex items-center space-x-4 cursor-pointer px-4 py-2 rounded-xl border transition-all ${formData.isPayant ? 'bg-emerald-50 border-emerald-500 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${formData.isPayant ? 'text-emerald-700' : 'text-slate-500'}`}>Patient Payant (Direct)</span>
                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center ${formData.isPayant ? 'bg-white border-emerald-500 text-emerald-600' : 'bg-white border-slate-300 text-transparent'}`}><Check size={16} strokeWidth={4} /></div>
                      </label>
                    </div>
                    <div className={`p-6 transition-opacity ${formData.isPayant ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                      {!formData.isPayant ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                          <SelectField label="Organisme" options={ORGANISM_OPTIONS} value={formData.insurance?.mainOrg} onChange={(e: any) => handleInsuranceChange('mainOrg', e.target.value)} required icon={Building2} />
                          <div className="grid grid-cols-2 gap-4">
                            <SelectField label="Lien Assuré" options={RELATIONSHIP_OPTIONS} value={formData.insurance?.relationship} onChange={(e: any) => handleInsuranceChange('relationship', e.target.value)} required />
                            <InputField label="N° Immatriculation" value={formData.insurance?.registrationNumber} onChange={(e: any) => handleInsuranceChange('registrationNumber', formatPhoneNumber(e.target.value))} placeholder="N° Matricule..." icon={Hash} />
                          </div>
                        </div>
                      ) : <div className="text-center py-6 text-slate-400 italic">Paiement direct activé.</div>}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-8 py-5 bg-white border-t flex justify-end space-x-4">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-slate-400 font-bold uppercase text-xs tracking-widest">Annuler</button>
              {modalMode === 'simple' && <button onClick={() => setModalMode('complet')} className="px-6 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-black uppercase text-xs">Basculer Complet</button>}
              <button onClick={() => handleSave(modalMode === 'simple' ? 'provisional' : 'complete')} className="px-10 py-3 bg-emerald-600 text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-emerald-700 active:scale-95 shadow-lg">Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {duplicateConflict && (
        <DuplicateConflictModal
          patient={duplicateConflict}
          onCancel={() => setDuplicateConflict(null)}
          onRedirect={() => { navigate(`/patient/${duplicateConflict.id}`); setDuplicateConflict(null); setIsModalOpen(false); }}
        />
      )}
    </div>
  );
};
