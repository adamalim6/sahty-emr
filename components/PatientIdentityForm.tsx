import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  User, Search, MapPin, Phone, ShieldCheck, 
  CreditCard, FileText, CheckCircle2, AlertOctagon, 
  X, ChevronDown, Loader2, Globe, Database, UserPlus,
  Plus, Trash2, Crown, Scale, Users, Star, Calendar
} from 'lucide-react';
import { api } from '../services/api';
import { CustomDatePicker } from './ui/CustomDatePicker';

// --- Shared Types ---
type PatientStatus = 'UNKNOWN' | 'PROVISIONAL' | 'VERIFIED';

interface PatientIdentityFormProps {
  onSubmit: (patientId: string) => void;
  onCancel: () => void;
  initialData?: any; // For editing mode if needed
}

// --- UI Components ---

const InputField = ({ label, value, onChange, required = false, disabled = false, icon: Icon, error = false, placeholder }: any) => (
  <div className="flex flex-col space-y-1.5 w-full text-left transition-all">
    <label className={`text-[10px] font-extrabold uppercase tracking-wider flex items-center ${error ? 'text-red-500' : 'text-slate-500'}`}>
      {label} {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    <div className="relative group">
      {Icon && (
        <div className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${error ? 'text-red-400' : 'text-slate-400 group-focus-within:text-emerald-500'}`}>
          <Icon size={14} />
        </div>
      )}
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className={`w-full rounded-xl border py-2.5 text-sm font-medium transition-all outline-none ${Icon ? 'pl-9' : 'pl-3'} pr-3 disabled:opacity-60 disabled:bg-slate-50 ${
          error
            ? 'bg-red-50 border-red-300 text-red-900 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
            : 'bg-white text-slate-900 border-slate-200 hover:border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 shadow-sm'
        }`}
      />
    </div>
  </div>
);

const SelectField = ({ label, value, onChange, options, required = false, disabled = false, icon: Icon, error = false, placeholder = "Sélectionner..." }: any) => (
  <div className="flex flex-col space-y-1.5 w-full text-left">
    <label className={`text-[10px] font-extrabold uppercase tracking-wider flex items-center ${error ? 'text-red-500' : 'text-slate-500'}`}>
      {label} {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    <div className="relative group">
      {Icon && <div className={`absolute left-3 top-1/2 -translate-y-1/2 z-10 pointer-events-none ${error ? 'text-red-400' : 'text-slate-400'}`}><Icon size={14} /></div>}
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full rounded-xl border py-2.5 text-sm font-medium transition-all outline-none appearance-none ${Icon ? 'pl-9' : 'pl-3'} pr-10 disabled:opacity-60 disabled:bg-slate-50 ${
          error
            ? 'bg-red-50 border-red-300 text-red-900 focus:border-red-500'
            : 'bg-white text-slate-900 border-slate-200 hover:border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 shadow-sm'
        }`}
      >
        <option value="" disabled>{placeholder}</option>
        {options.map((opt: any) => (
            typeof opt === 'string' 
                ? <option key={opt} value={opt}>{opt}</option>
                : <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><ChevronDown size={14} /></div>
    </div>
  </div>
);

const CardSection = ({ title, icon: Icon, children, rightElement }: any) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm text-left mb-6">
    <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-t-2xl">
      <div className="flex items-center space-x-3">
        <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
          <Icon size={16} />
        </div>
        <h4 className="font-bold text-slate-800 text-xs uppercase tracking-tight">{title}</h4>
      </div>
      {rightElement}
    </div>
    <div className="p-5">{children}</div>
  </div>
);

// --- MAIN COMPONENT ---

export const PatientIdentityForm: React.FC<PatientIdentityFormProps> = ({ onSubmit, onCancel, initialData }) => {
  // State
  const [status, setStatus] = useState<PatientStatus>('PROVISIONAL');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocked, setIsLocked] = useState(false); // Locks core identity fields
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reference Data
  const [organismes, setOrganismes] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [docTypes, setDocTypes] = useState<any[]>([]);

  // Form Data
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    sex: '',
    dob: '',
    // Contact
    phone: '',
    email: '',
    address: '',
    city: '',
    // Documents
    identityDocuments: [{ type: 'CIN', number: '', issuingCountry: 'MA', isPrimary: true }],
    // Insurance
    isPayant: false,
    insuranceOrgId: '',
    policyNumber: '',
    // Emergency Contact
    emergencyName: '',
    emergencyPhone: '',
    emergencyRelation: 'Famille',
    // Insurance subscriber
    insuranceSubscriberRelationship: 'SELF' as string,
    subscriberFirstName: '',
    subscriberLastName: '',
    subscriberPhone: '',
    subscriberEmail: '',
    subscriberDocType: 'CIN',
    subscriberDocNumber: '',
    subscriberDocCountry: 'MA',
    subscriberPatientId: '',
    subscriberPatientLabel: '',
    // Meta
    masterPatientId: '', // If linked to Global/Local Identity
    medicalRecordNumber: '', // IPP is usually auto-generated by backend or passed in
  });

  // Legal Guardians state
  interface GuardianEntry {
    guardianType: 'EXTERNAL_PERSON' | 'EXISTING_PATIENT';
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    relatedPatientId: string;
    relatedPatientLabel: string; // display-only
    relationshipType: string;
    legalBasis: string;
    validFrom: string;
    validTo: string;
    isPrimary: boolean;
  }
  const emptyGuardian = (): GuardianEntry => ({
    guardianType: 'EXTERNAL_PERSON',
    firstName: '', lastName: '', phone: '', email: '',
    relatedPatientId: '', relatedPatientLabel: '',
    relationshipType: 'Père',
    legalBasis: '', validFrom: new Date().toISOString().split('T')[0], validTo: '',
    isPrimary: false,
  });
  const [legalGuardians, setLegalGuardians] = useState<GuardianEntry[]>([]);
  const [guardianSearchQuery, setGuardianSearchQuery] = useState<Record<number, string>>({});
  const [guardianSearchResults, setGuardianSearchResults] = useState<Record<number, any[]>>({});

  // Compute age from DOB
  const patientAge = useMemo(() => {
    if (!formData.dob) return null;
    const dob = new Date(formData.dob);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
  }, [formData.dob]);

  const isMinor = patientAge !== null && patientAge < 18;
  const showLegalGuardian = status === 'VERIFIED' && isMinor;

  const [errors, setErrors] = useState<Record<string, boolean>>({});

  // Refs for click outside search
  const searchRef = useRef<HTMLDivElement>(null);

  // --- Init ---
  useEffect(() => {
      const loadRefData = async () => {
          try {
              const [orgs, cntrs, dts] = await Promise.all([
                  api.getTenantOrganismes(),
                  api.getTenantCountries(),
                  api.getTenantIdentityDocumentTypes()
              ]);
              setOrganismes(orgs);
              setCountries(cntrs);
              setDocTypes(dts);
          } catch (e) {
              console.error("Failed to load reference data", e);
          }
      };
      loadRefData();
  }, []);

  // --- Search Logic ---
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.length >= 2 && !isLocked) {
        setIsSearching(true);
        try {
          const results = await api.searchUniversal(searchQuery);
          setSearchResults(results);
        } catch (error) {
          console.error("Search failed:", error);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, isLocked]);

  // Click outside to close search results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchResults([]);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- Handlers ---

  const handleSelectPatient = (patient: any) => {
    setFormData(prev => ({
      ...prev,
      firstName: patient.firstName,
      lastName: patient.lastName,
      sex: patient.sex,
      dob: patient.dob || '',
      masterPatientId: patient.source === 'GLOBAL_IDENTITY' ? patient.id : '', 
      medicalRecordNumber: patient.ipp || '',
      // Try to populate docs if available (structure depends on API response)
      identityDocuments: patient.documents?.length > 0 
        ? patient.documents.map((d: any) => ({ type: d.documentType, number: d.documentNumber, issuingCountry: d.issuingCountry || 'MA', isPrimary: d.isPrimary })) 
        : [{ type: 'CIN', number: '', issuingCountry: 'MA', isPrimary: true }]
    }));
    
    setStatus('VERIFIED');
    setIsLocked(true); 
    setSearchQuery(`${patient.firstName} ${patient.lastName}`);
    setSearchResults([]);
  };

  const handleClearIdentity = () => {
    setIsLocked(false);
    setSearchQuery('');
    setFormData(prev => ({
      ...prev,
      firstName: '',
      lastName: '',
      sex: '',
      dob: '',
      masterPatientId: '',
      medicalRecordNumber: '',
      identityDocuments: [{ type: 'CIN', number: '', issuingCountry: 'MA', isPrimary: true }]
    }));
    setStatus('PROVISIONAL');
  };

  const addDocument = () => {
      setFormData(prev => ({
          ...prev,
          identityDocuments: [...prev.identityDocuments, { type: 'CIN', number: '', issuingCountry: 'MA', isPrimary: false }]
      }));
  };

  const removeDocument = (index: number) => {
      setFormData(prev => ({
          ...prev,
          identityDocuments: prev.identityDocuments.filter((_, i) => i !== index)
      }));
  };

  const updateDocument = (index: number, field: string, value: any) => {
      setFormData(prev => {
          const newDocs = [...prev.identityDocuments];
          newDocs[index] = { ...newDocs[index], [field]: value };
          return { ...prev, identityDocuments: newDocs };
      });
  };

  // --- Legal Guardian Handlers ---
  const addGuardian = () => setLegalGuardians(prev => [...prev, emptyGuardian()]);
  
  const removeGuardian = (idx: number) => setLegalGuardians(prev => prev.filter((_, i) => i !== idx));
  
  const updateGuardian = (idx: number, field: string, value: any) => {
    setLegalGuardians(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };
  
  const setGuardianPrimary = (idx: number) => {
    setLegalGuardians(prev => prev.map((g, i) => ({ ...g, isPrimary: i === idx })));
  };

  const searchGuardianPatient = async (idx: number, query: string) => {
    setGuardianSearchQuery(prev => ({ ...prev, [idx]: query }));
    if (query.length < 2) {
      setGuardianSearchResults(prev => ({ ...prev, [idx]: [] }));
      return;
    }
    try {
      const results = await api.searchUniversal(query);
      setGuardianSearchResults(prev => ({ ...prev, [idx]: results.filter((r: any) => r.source === 'LOCAL_TENANT') }));
    } catch (e) { console.error(e); }
  };

  const selectGuardianPatient = (idx: number, patient: any) => {
    updateGuardian(idx, 'relatedPatientId', patient.tenantPatientId || patient.id);
    updateGuardian(idx, 'relatedPatientLabel', `${patient.firstName} ${patient.lastName}`);
    setGuardianSearchQuery(prev => ({ ...prev, [idx]: '' }));
    setGuardianSearchResults(prev => ({ ...prev, [idx]: [] }));
  };

  const setPrimaryDocument = (index: number) => {
      setFormData(prev => {
          const newDocs = prev.identityDocuments.map((d, i) => ({ ...d, isPrimary: i === index }));
          return { ...prev, identityDocuments: newDocs };
      });
  };

  const validate = () => {
    const newErrors: Record<string, boolean> = {};
    
    // Status-based Validation Rules
    if (status === 'UNKNOWN') {
      if (!formData.sex) newErrors.sex = true;
    } 
    else if (status === 'PROVISIONAL') {
      if (!formData.firstName) newErrors.firstName = true;
      if (!formData.lastName) newErrors.lastName = true;
      if (!formData.dob && !formData.sex) {
          newErrors.dob = true;
          newErrors.sex = true;
      }
    } 
    else if (status === 'VERIFIED') {
      if (!formData.firstName) newErrors.firstName = true;
      if (!formData.lastName) newErrors.lastName = true;
      if (!formData.dob) newErrors.dob = true;
      if (!formData.sex) newErrors.sex = true;
      
      // Validate primary document
      const primaryDoc = formData.identityDocuments.find(d => d.isPrimary);
      if (!primaryDoc || !primaryDoc.number) {
          newErrors.documentNumber = true; 
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);

    try {
        // Construct Payload
        const payload: any = {
            firstName: formData.firstName,
            lastName: formData.lastName,
            sex: formData.sex,
            dob: formData.dob,
            status: status,
            masterPatientId: formData.masterPatientId || undefined,
            medicalRecordNumber: formData.medicalRecordNumber || undefined,
            contacts: [], 
            addresses: [],
            insurances: [],
            identityDocuments: formData.identityDocuments.filter(d => d.number).map(d => ({
                documentType: d.type,
                documentNumber: d.number,
                issuingCountry: d.issuingCountry,
                isPrimary: d.isPrimary
            })),
            legalGuardians: showLegalGuardian ? legalGuardians.filter(g => {
                if (g.guardianType === 'EXTERNAL_PERSON') return g.firstName && g.lastName;
                return g.relatedPatientId;
            }).map(g => ({
                guardianType: g.guardianType,
                firstName: g.firstName || undefined,
                lastName: g.lastName || undefined,
                phone: g.phone || undefined,
                email: g.email || undefined,
                relatedPatientId: g.relatedPatientId || undefined,
                relationshipType: g.relationshipType,
                legalBasis: g.legalBasis || undefined,
                validFrom: g.validFrom || undefined,
                validTo: g.validTo || undefined,
                isPrimary: g.isPrimary,
            })) : [],
        };

        // Add optional fields
        if (formData.phone || formData.email) {
            payload.contacts.push({ phone: formData.phone, email: formData.email });
        }
        if (formData.address || formData.city) {
            payload.addresses.push({ addressLine: formData.address, city: formData.city });
        }
        
        // Insurance logic
        if (!formData.isPayant && formData.insuranceOrgId) {
            const isSelf = formData.insuranceSubscriberRelationship === 'SELF';
            const insuranceEntry: any = {
                insuranceOrgId: formData.insuranceOrgId,
                policyNumber: formData.policyNumber || undefined,
                subscriberType: isSelf ? 'PATIENT' : 'PERSON',
                subscriberRelationshipType: formData.insuranceSubscriberRelationship,
                subscriberName: isSelf
                    ? `${formData.firstName} ${formData.lastName}`
                    : `${formData.subscriberFirstName} ${formData.subscriberLastName}`,
            };
            if (!isSelf) {
                insuranceEntry.subscriberFirstName = formData.subscriberFirstName;
                insuranceEntry.subscriberLastName = formData.subscriberLastName;
                insuranceEntry.subscriberPhone = formData.subscriberPhone || undefined;
                insuranceEntry.subscriberEmail = formData.subscriberEmail || undefined;
                if (formData.subscriberDocNumber) {
                    insuranceEntry.subscriberDocument = {
                        documentTypeCode: formData.subscriberDocType || 'CIN',
                        documentNumber: formData.subscriberDocNumber,
                        issuingCountryCode: formData.subscriberDocCountry || 'MA',
                    };
                }
            }
            payload.insurances.push(insuranceEntry);
        }

        // Call API
        const res = await api.createPatient(payload);
        const newPatientId = res.tenantPatientId;

        // Add Emergency Contact
        if (formData.emergencyName) {
            try {
                await api.addEmergencyContact(newPatientId, {
                    name: formData.emergencyName,
                    phone: formData.emergencyPhone,
                    relationship: formData.emergencyRelation
                });
            } catch (e) {
                console.error("Failed to add emergency contact", e);
            }
        }

        onSubmit(newPatientId);

    } catch (err) {
        console.error("Creation failed", err);
    } finally {
        setIsSubmitting(false);
    }
  };

  // --- Render ---

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pb-20">
      
      {/* HEADER & SEARCH */}
      <div className="relative z-20" ref={searchRef}>
         <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                <Search size={20} />
            </div>
            <input 
                className="flex-1 bg-transparent border-none outline-none text-lg font-medium placeholder:text-slate-400"
                placeholder="Rechercher un patient (Nom, IPP, CIN...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={isLocked}
                autoFocus
            />
            {isSearching && <Loader2 className="animate-spin text-slate-400 mr-3" />}
            {isLocked && (
                <button 
                    onClick={handleClearIdentity}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                >
                    <X size={20} />
                </button>
            )}
         </div>

         {/* SEARCH RESULTS */}
         {searchResults.length > 0 && (
             <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden max-h-80 overflow-y-auto">
                 <div className="p-2">
                     <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-1">Résultats</div>
                     {searchResults.map((res: any) => (
                         <button 
                            key={`${res.source}-${res.id}`}
                            onClick={() => handleSelectPatient(res)}
                            className="w-full flex items-center p-3 hover:bg-slate-50 rounded-xl transition-all text-left group"
                         >
                             <div className={`p-3 rounded-full mr-4 ${res.source === 'LOCAL_TENANT' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                                 {res.source === 'LOCAL_TENANT' ? <Database size={18} /> : <Globe size={18} />}
                             </div>
                             <div>
                                 <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                     {res.firstName} {res.lastName}
                                 </div>
                                 <div className="text-xs text-slate-500 flex items-center gap-2">
                                     {res.dob && <span>Né(e) le {res.dob}</span>}
                                     {res.sex && <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-bold">{res.sex}</span>}
                                     <span className="text-[10px] uppercase tracking-wide opacity-75">{res.source === 'LOCAL_TENANT' ? 'Dossier Local' : 'Identité Globale'}</span>
                                 </div>
                             </div>
                         </button>
                     ))}
                 </div>
             </div>
         )}
      </div>

      {/* STATUS TOGGLE */}
      <div className="flex justify-center">
          <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
              {[
                  { id: 'UNKNOWN', label: 'Inconnu / X', icon: AlertOctagon },
                  { id: 'PROVISIONAL', label: 'Provisoire', icon: UserPlus },
                  { id: 'VERIFIED', label: 'Identité Vérifiée', icon: ShieldCheck }
              ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => !isLocked && setStatus(s.id as PatientStatus)}
                    disabled={isLocked}
                    className={`
                        px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide flex items-center gap-2 transition-all
                        ${status === s.id 
                            ? 'bg-white text-indigo-600 shadow-sm scale-100' 
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 scale-95 opacity-80'
                        }
                        ${isLocked ? 'cursor-not-allowed opacity-50' : ''}
                    `}
                  >
                      <s.icon size={14} />
                      {s.label}
                  </button>
              ))}
          </div>
      </div>

      {/* FORM SECTIONS */}
      <div className="grid grid-cols-12 gap-6">
          
          {/* LEFT COLUMN */}
          <div className="col-span-12 md:col-span-7 space-y-6">
              <CardSection title="Identité Patient" icon={User} rightElement={isLocked && <div className="px-2 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold rounded uppercase">Verrouillé</div>}>
                  <div className="grid grid-cols-2 gap-4">
                      <InputField 
                        label="Prénom" 
                        value={formData.firstName} 
                        onChange={(v: string) => setFormData({...formData, firstName: v})}
                        disabled={isLocked || status === 'UNKNOWN'}
                        error={errors.firstName}
                        placeholder={status === 'UNKNOWN' ? 'INCONNU' : ''}
                      />
                      <InputField 
                        label="Nom" 
                        value={formData.lastName}
                        onChange={(v: string) => setFormData({...formData, lastName: v})}
                        disabled={isLocked || status === 'UNKNOWN'}
                        error={errors.lastName}
                        placeholder={status === 'UNKNOWN' ? 'INCONNU' : ''}
                      />
                      
                      {/* Gender Toggle */}
                      <div className="col-span-2 sm:col-span-1 flex flex-col space-y-1.5">
                        <label className={`text-[10px] font-extrabold uppercase tracking-wider ${errors.sex ? 'text-red-500' : 'text-slate-500'}`}>Sexe {status !== 'UNKNOWN' && '*'}</label>
                        <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200 h-[42px]">
                            {['M', 'F'].map((g) => (
                                <button
                                    key={g}
                                    onClick={() => !isLocked && setFormData({...formData, sex: g})}
                                    disabled={isLocked}
                                    className={`flex-1 text-xs font-black rounded-lg transition-all ${
                                        formData.sex === g 
                                            ? g === 'M' ? 'bg-white text-blue-600 shadow-sm' : 'bg-white text-pink-600 shadow-sm'
                                            : 'text-slate-400'
                                    }`}
                                >
                                    {g === 'M' ? 'HOMME' : 'FEMME'}
                                </button>
                            ))}
                        </div>
                      </div>

                      <div className="col-span-2 sm:col-span-1">
                          <CustomDatePicker
                             label="Date de Naissance"
                             value={formData.dob}
                             onChange={(v: string) => setFormData({...formData, dob: v})}
                             disabled={isLocked || status === 'UNKNOWN'}
                             error={errors.dob}
                          />
                      </div>
                  </div>
              </CardSection>

              <CardSection title="Contacts & Adresse" icon={MapPin}>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="Téléphone" icon={Phone} value={formData.phone} onChange={(v: string) => setFormData({...formData, phone: v})} />
                        {/* <InputField label="Email" icon={Globe} value={formData.email} onChange={(v: string) => setFormData({...formData, email: v})} /> */}
                        <InputField label="Ville" value={formData.city} onChange={(v: string) => setFormData({...formData, city: v})} />
                    </div>
                    <InputField label="Adresse Complète" value={formData.address} onChange={(v: string) => setFormData({...formData, address: v})} />
                </div>
              </CardSection>
          </div>

          {/* RIGHT COLUMN */}
          <div className="col-span-12 md:col-span-5 space-y-6">
              
              {/* DOCUMENT */}
              {status !== 'UNKNOWN' && (
                  <CardSection title="Pièce(s) d'Identité" icon={FileText} rightElement={
                      <button onClick={addDocument} className="text-emerald-600 hover:text-emerald-700 p-1 hover:bg-emerald-50 rounded-lg transition-colors">
                          <Plus size={16} />
                      </button>
                  }>
                      <div className="space-y-4">
                          {formData.identityDocuments.map((doc, idx) => (
                              <div key={idx} className={`p-3 rounded-xl border relative transition-all ${doc.isPrimary ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                                  {/* Actions */}
                                  <div className="absolute top-2 right-2 flex gap-1">
                                      <button 
                                        onClick={() => setPrimaryDocument(idx)}
                                        title={doc.isPrimary ? 'Document Principal' : 'Définir comme principal'}
                                        className={`p-1.5 rounded-lg transition-colors ${doc.isPrimary ? 'text-emerald-600 bg-white shadow-sm' : 'text-slate-400 hover:text-emerald-600 hover:bg-white'}`}
                                      >
                                          <Crown size={14} fill={doc.isPrimary ? "currentColor" : "none"} />
                                      </button>
                                      {formData.identityDocuments.length > 1 && (
                                        <button 
                                            onClick={() => removeDocument(idx)}
                                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-white transition-colors"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                      )}
                                  </div>

                                  <div className="space-y-3">
                                      <div className="flex gap-3 pr-16">
                                        <div className="w-1/3">
                                            <SelectField 
                                                label="Type" 
                                                options={['CIN', 'PASSPORT', 'SEJOUR']} 
                                                value={doc.type} 
                                                onChange={(v: string) => updateDocument(idx, 'type', v)}
                                                disabled={isLocked}
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <InputField 
                                                label="Numéro" 
                                                value={doc.number} 
                                                onChange={(v: string) => updateDocument(idx, 'number', v)}
                                                disabled={isLocked}
                                                error={doc.isPrimary && errors.documentNumber}
                                            />
                                        </div>
                                      </div>
                                      
                                      <div className="w-full">
                                          <SelectField 
                                              label="Pays d'émission" 
                                              options={countries.map(c => ({ value: c.iso_code, label: `${c.iso_code} - ${c.name}` }))} 
                                              value={doc.issuingCountry} 
                                              onChange={(v: string) => updateDocument(idx, 'issuingCountry', v)}
                                              icon={Globe}
                                              disabled={isLocked}
                                          />
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </CardSection>
              )}

              <CardSection title="Contact d'Urgence" icon={ShieldCheck}>
                 <div className="space-y-4">
                     <InputField 
                        label="Nom Complet" 
                        value={formData.emergencyName} 
                        onChange={(v: string) => setFormData({...formData, emergencyName: v})}
                     />
                     <div className="grid grid-cols-2 gap-4">
                        <InputField 
                            label="Téléphone" 
                            value={formData.emergencyPhone} 
                            onChange={(v: string) => setFormData({...formData, emergencyPhone: v})}
                        />
                         <SelectField 
                            label="Relation" 
                            options={['Famille', 'Ami', 'Travail', 'Autre']} 
                            value={formData.emergencyRelation} 
                            onChange={(v: string) => setFormData({...formData, emergencyRelation: v})}
                         />
                     </div>
                 </div>
              </CardSection>

              {/* LEGAL GUARDIAN SECTION — Visible only for VERIFIED + minor */}
              {showLegalGuardian && (
                <CardSection title="Tuteur Légal (Mineur)" icon={Scale} rightElement={
                  <button onClick={addGuardian} className="text-emerald-600 hover:text-emerald-700 p-1 hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold">
                    <Plus size={14} /> Ajouter
                  </button>
                }>
                  {legalGuardians.length === 0 ? (
                    <div className="text-center py-6">
                      <Scale size={28} className="mx-auto text-slate-300 mb-2" />
                      <p className="text-sm text-slate-400">Patient mineur — ajoutez au moins un tuteur légal</p>
                      <button onClick={addGuardian} className="mt-3 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-colors">
                        <Plus size={14} className="inline mr-1" /> Ajouter un tuteur
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {legalGuardians.map((g, idx) => (
                        <div key={idx} className={`p-4 rounded-xl border transition-all ${
                          g.isPrimary ? 'bg-amber-50/50 border-amber-200' : 'bg-slate-50 border-slate-200'
                        }`}>
                          {/* Header with actions */}
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Tuteur {idx + 1}</span>
                            <div className="flex gap-1">
                              <button
                                onClick={() => setGuardianPrimary(idx)}
                                title={g.isPrimary ? 'Tuteur principal' : 'Définir comme principal'}
                                className={`p-1.5 rounded-lg transition-colors ${g.isPrimary ? 'text-amber-600 bg-white shadow-sm' : 'text-slate-400 hover:text-amber-600 hover:bg-white'}`}
                              >
                                <Star size={14} fill={g.isPrimary ? 'currentColor' : 'none'} />
                              </button>
                              <button onClick={() => removeGuardian(idx)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-white transition-colors">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          {/* Guardian type toggle */}
                          <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200 mb-3 h-[38px]">
                            {[
                              { id: 'EXTERNAL_PERSON', label: 'Personne externe', icon: UserPlus },
                              { id: 'EXISTING_PATIENT', label: 'Patient existant', icon: Users },
                            ].map(t => (
                              <button
                                key={t.id}
                                onClick={() => updateGuardian(idx, 'guardianType', t.id)}
                                className={`flex-1 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                                  g.guardianType === t.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'
                                }`}
                              >
                                <t.icon size={12} /> {t.label}
                              </button>
                            ))}
                          </div>

                          {/* Conditional fields based on type */}
                          {g.guardianType === 'EXTERNAL_PERSON' ? (
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <InputField label="Prénom" value={g.firstName} onChange={(v: string) => updateGuardian(idx, 'firstName', v)} required />
                                <InputField label="Nom" value={g.lastName} onChange={(v: string) => updateGuardian(idx, 'lastName', v)} required />
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <InputField label="Téléphone" icon={Phone} value={g.phone} onChange={(v: string) => updateGuardian(idx, 'phone', v)} />
                                <InputField label="Email" icon={Globe} value={g.email} onChange={(v: string) => updateGuardian(idx, 'email', v)} />
                              </div>
                            </div>
                          ) : (
                            <div className="relative mb-3">
                              <InputField 
                                label="Rechercher un patient" 
                                icon={Search}
                                value={g.relatedPatientLabel || guardianSearchQuery[idx] || ''}
                                onChange={(v: string) => {
                                  if (g.relatedPatientId) {
                                    updateGuardian(idx, 'relatedPatientId', '');
                                    updateGuardian(idx, 'relatedPatientLabel', '');
                                  }
                                  searchGuardianPatient(idx, v);
                                }}
                              />
                              {g.relatedPatientId && (
                                <button
                                  onClick={() => { updateGuardian(idx, 'relatedPatientId', ''); updateGuardian(idx, 'relatedPatientLabel', ''); }}
                                  className="absolute top-7 right-2 p-1 text-slate-400 hover:text-red-500"
                                >
                                  <X size={14} />
                                </button>
                              )}
                              {(guardianSearchResults[idx] || []).length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl max-h-40 overflow-y-auto z-10">
                                  {guardianSearchResults[idx].map((r: any) => (
                                    <button
                                      key={r.id}
                                      onClick={() => selectGuardianPatient(idx, r)}
                                      className="w-full text-left p-2.5 hover:bg-slate-50 text-sm transition-colors"
                                    >
                                      <span className="font-bold">{r.firstName} {r.lastName}</span>
                                      {r.dob && <span className="text-xs text-slate-400 ml-2">({r.dob})</span>}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Common fields */}
                          <div className="grid grid-cols-2 gap-3 mt-3">
                            <SelectField
                              label="Relation"
                              required
                              options={[
                                { value: 'Père', label: 'Père' },
                                { value: 'Mère', label: 'Mère' },
                                { value: 'Tuteur légal', label: 'Tuteur légal' },
                                { value: 'Responsable légal', label: 'Responsable légal' },
                                { value: 'Grand-parent', label: 'Grand-parent' },
                                { value: 'Autre', label: 'Autre' },
                              ]}
                              value={g.relationshipType}
                              onChange={(v: string) => updateGuardian(idx, 'relationshipType', v)}
                            />
                            <InputField
                              label="Base légale"
                              value={g.legalBasis}
                              onChange={(v: string) => updateGuardian(idx, 'legalBasis', v)}
                              placeholder="Ex: Acte notarié..."
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3 mt-3">
                            <CustomDatePicker
                              label="Valide du"
                              value={g.validFrom}
                              onChange={(v: string) => updateGuardian(idx, 'validFrom', v)}
                            />
                            <CustomDatePicker
                              label="Valide jusqu'au"
                              value={g.validTo}
                              onChange={(v: string) => updateGuardian(idx, 'validTo', v)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardSection>
              )}

              <CardSection title="Couverture / Assurance" icon={CreditCard} rightElement={
                  <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase text-slate-500">Patient Payant</span>
                      <button 
                        onClick={() => setFormData(prev => ({ ...prev, isPayant: !prev.isPayant, insuranceOrgId: '', policyNumber: '' }))}
                        className={`w-10 h-5 rounded-full transition-colors relative ${formData.isPayant ? 'bg-emerald-500' : 'bg-slate-200'}`}
                      >
                          <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${formData.isPayant ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                  </div>
              }>
                 <div className={`space-y-4 transition-all ${formData.isPayant ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
                     {/* Subscriber Selector */}
                     <SelectField 
                        label="Assuré / Subscriber" 
                        options={[
                            { value: 'SELF', label: 'Patient lui-même' },
                            { value: 'FATHER', label: 'Père' },
                            { value: 'MOTHER', label: 'Mère' },
                            { value: 'SPOUSE', label: 'Conjoint(e)' },
                            { value: 'CHILD', label: 'Enfant' },
                            { value: 'OTHER', label: 'Autre' },
                        ]}
                        value={formData.insuranceSubscriberRelationship}
                        onChange={(v: string) => setFormData(prev => ({
                            ...prev,
                            insuranceSubscriberRelationship: v,
                            subscriberFirstName: '',
                            subscriberLastName: '',
                            subscriberPhone: '',
                            subscriberEmail: '',
                            subscriberDocType: 'CIN',
                            subscriberDocNumber: '',
                            subscriberDocCountry: 'MA',
                            subscriberPatientId: '',
                            subscriberPatientLabel: '',
                        }))}
                     />

                     {/* Self = show locked info */}
                     {formData.insuranceSubscriberRelationship === 'SELF' && (
                       <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                         <CheckCircle2 size={16} className="text-emerald-600" />
                         <span className="text-xs font-bold text-emerald-700">Identique au patient — documents liés automatiquement</span>
                       </div>
                     )}

                     {/* Non-self = subscriber identity inputs */}
                     {formData.insuranceSubscriberRelationship !== 'SELF' && (
                       <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                         <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Identité de l'assuré</span>
                         <div className="grid grid-cols-2 gap-3">
                           <InputField label="Prénom" value={formData.subscriberFirstName} onChange={(v: string) => setFormData({...formData, subscriberFirstName: v})} required />
                           <InputField label="Nom" value={formData.subscriberLastName} onChange={(v: string) => setFormData({...formData, subscriberLastName: v})} required />
                         </div>
                         <div className="grid grid-cols-2 gap-3">
                           <InputField label="Téléphone" icon={Phone} value={formData.subscriberPhone} onChange={(v: string) => setFormData({...formData, subscriberPhone: v})} />
                           <InputField label="Email" icon={Globe} value={formData.subscriberEmail} onChange={(v: string) => setFormData({...formData, subscriberEmail: v})} />
                         </div>
                         {/* Subscriber document */}
                         <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mt-3">Document d'identité de l'assuré</span>
                         <div className="grid grid-cols-3 gap-3">
                           <SelectField
                             label="Type"
                             options={docTypes.map(d => ({ value: d.code, label: d.label }))}
                             value={formData.subscriberDocType}
                             onChange={(v: string) => setFormData({...formData, subscriberDocType: v})}
                           />
                           <InputField label="N° Document" value={formData.subscriberDocNumber} onChange={(v: string) => setFormData({...formData, subscriberDocNumber: v})} />
                           <SelectField
                             label="Pays"
                             options={countries.map(c => ({ value: c.iso_code, label: c.name }))}
                             value={formData.subscriberDocCountry}
                             onChange={(v: string) => setFormData({...formData, subscriberDocCountry: v})}
                           />
                         </div>
                       </div>
                     )}

                     {/* Insurance org & policy — always visible */}
                     <SelectField 
                        label="Organisme" 
                        options={organismes.map(o => ({ value: o.id, label: o.designation }))}
                        value={formData.insuranceOrgId}
                        onChange={(v: string) => setFormData({...formData, insuranceOrgId: v})}
                        placeholder="Sélectionner un organisme"
                     />
                     <InputField 
                        label="N° Immatriculation / Police" 
                        value={formData.policyNumber} 
                        onChange={(v: string) => setFormData({...formData, policyNumber: v})}
                     />
                 </div>
              </CardSection>

          </div>
      </div>

      {/* FOOTER ACTIONS */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 z-50 flex justify-end gap-3 md:pl-72">
          <button 
            onClick={onCancel}
            className="px-6 py-3 rounded-xl border border-slate-200 text-slate-500 font-bold hover:bg-slate-50 transition-colors"
          >
              Annuler
          </button>
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`px-8 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all flex items-center gap-2 ${isSubmitting ? 'opacity-80 cursor-wait' : ''}`}
          >
              {isSubmitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={18} />}
              <span>{isLocked ? 'Confirmer & Continuer' : 'Créer & Continuer'}</span>
          </button>
      </div>

    </div>
  );
};
