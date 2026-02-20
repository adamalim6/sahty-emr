import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  User, Search, MapPin, Phone, ShieldCheck, 
  CreditCard, FileText, CheckCircle2, AlertOctagon, 
  X, ChevronDown, Loader2, Globe, Database, UserPlus,
  Plus, Trash2, Crown, Scale, Users, Star, Calendar, ChevronRight,
  ArrowDownToLine
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
        style={{ colorScheme: 'light' }}
        className={`w-full rounded-xl border py-2.5 text-sm font-medium transition-all outline-none appearance-none ${Icon ? 'pl-9' : 'pl-3'} pr-10 disabled:opacity-60 disabled:bg-slate-50 ${
          error
            ? 'bg-red-50 border-red-300 text-red-900 focus:border-red-500'
            : 'bg-white text-slate-900 border-slate-200 hover:border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 shadow-sm'
        }`}
      >
        <option value="" disabled>{placeholder}</option>
        {options.map((opt: any) => (
            typeof opt === 'string' 
                ? <option key={opt} value={opt} className="text-slate-900 bg-white">{opt}</option>
                : <option key={opt.value} value={opt.value} className="text-slate-900 bg-white">{opt.label}</option>
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
  const [selectedExistingPatientId, setSelectedExistingPatientId] = useState<string | null>(null); // Track edit mode
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
    existingCoverageId: '', // To link to existing
    // Insurance subscriber
    insuranceSubscriberRelationship: 'SELF' as string,
    subscriberFirstName: '',
    subscriberLastName: '',
    subscriberPhone: '',
    subscriberEmail: '',
    subscriberDocType: 'CIN',
    subscriberDocNumber: '',
    subscriberDocIssuingCountry: 'MA',
    subscriberDocCountry: 'MA',
    subscriberPatientId: '',
    subscriberPatientLabel: '',
    // Meta
    masterPatientId: '', // If linked to Global/Local Identity
    medicalRecordNumber: '', // IPP is usually auto-generated by backend or passed in
    
    // Relationships (Unified)
    relationships: [] as RelationshipEntry[],
  });

  // Coverage Search State
  const [coverageSearchMode, setCoverageSearchMode] = useState(false);
  const [foundCoverages, setFoundCoverages] = useState<any[]>([]);
  const [showSubscriberSearch, setShowSubscriberSearch] = useState(false);
  const [subscriberSearchQuery, setSubscriberSearchQuery] = useState('');
  const [subscriberSearchResults, setSubscriberSearchResults] = useState<any[]>([]);
  const [subscriberSearching, setSubscriberSearching] = useState(false);

  // Coverage Debounce Search
  useEffect(() => {
      const searchCov = async () => {
          if (formData.insuranceOrgId && formData.policyNumber.length > 2 && coverageSearchMode) {
              try {
                  const res = await api.searchCoverages(formData.insuranceOrgId, formData.policyNumber);
                  setFoundCoverages(res);
              } catch (e) {
                  console.error(e);
              }
          } else {
              setFoundCoverages([]);
          }
      };
      const t = setTimeout(searchCov, 500);
      return () => clearTimeout(t);
  }, [formData.insuranceOrgId, formData.policyNumber, coverageSearchMode]);

  const selectExistingCoverage = (cov: any) => {
      setFormData(prev => ({
          ...prev,
          existingCoverageId: cov.coverageId,
          policyNumber: cov.policyNumber,
          insuranceOrgId: cov.organismeId
      }));
      setCoverageSearchMode(false);
      setFoundCoverages([]);
  };

  interface RelationshipEntry {
    firstName: string;
    lastName: string;
    phone: string;
    relationship: string;
    isLegalGuardian: boolean;
    isEmergencyContact: boolean;
    isDecisionMaker: boolean;
  }

  // Relationships Logic
  const addRelationship = () => {
    setFormData(prev => ({
      ...prev,
      relationships: [...prev.relationships, {
        firstName: '', lastName: '', phone: '', relationship: 'OTHER',
        isLegalGuardian: false, isEmergencyContact: false, isDecisionMaker: false
      }]
    }));
  };

  const removeRelationship = (index: number) => {
    setFormData(prev => ({
      ...prev,
      relationships: prev.relationships.filter((_, i) => i !== index)
    }));
  };

  const updateRelationship = (index: number, field: keyof RelationshipEntry, value: any) => {
    setFormData(prev => ({
      ...prev,
      relationships: prev.relationships.map((r, i) => i === index ? { ...r, [field]: value } : r)
    }));
  };

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

  // --- Search Logic (Manual: Enter key or button click) ---
  const executeSearch = async () => {
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
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
  };

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

  const handleSelectPatient = async (patient: any) => {
    // Fetch full patient detail for editing
    try {
      const detail: any = await api.getPatient(patient.id);

      setFormData(prev => ({
        ...prev,
        firstName: detail.firstName || patient.firstName,
        lastName: detail.lastName || patient.lastName,
        sex: detail.sex || detail.gender || patient.sex || '',
        dob: detail.dob || detail.dateOfBirth || patient.dob || '',
        masterPatientId: '',
        medicalRecordNumber: detail.medicalRecordNumber || patient.ipp || '',
        // Populate identity documents from detail
        identityDocuments: detail.identifiers?.filter((i: any) => i.identityTypeCode !== 'LOCAL_MRN').length > 0
          ? detail.identifiers.filter((i: any) => i.identityTypeCode !== 'LOCAL_MRN').map((i: any) => ({
              type: i.identityTypeCode,
              number: i.identityValue,
              issuingCountry: i.issuingCountryCode || 'MA',
              isPrimary: i.isPrimary || false
            }))
          : [{ type: 'CIN', number: '', issuingCountry: 'MA', isPrimary: true }],
        // Populate contact info
        phone: detail.contacts?.[0]?.phone || '',
        email: detail.contacts?.[0]?.email || '',
        // Populate address
        address: detail.addresses?.[0]?.addressLine || '',
        city: detail.addresses?.[0]?.city || '',
        
        // Populate relationships
        relationships: detail.relationships?.map((r: any) => ({
            firstName: r.relatedFirstName || '',
            lastName: r.relatedLastName || '',
            phone: r.relatedPhone || '',
            relationship: r.relationshipTypeCode || 'OTHER',
            isLegalGuardian: r.isLegalGuardian,
            isEmergencyContact: r.isEmergencyContact,
            isDecisionMaker: r.isDecisionMaker
        })) || []
      }));
        

    } catch (err) {
      // Fallback to search result data if detail fetch fails
      console.error('Failed to fetch patient detail, using search data', err);
      setFormData(prev => ({
        ...prev,
        firstName: patient.firstName,
        lastName: patient.lastName,
        sex: patient.sex || '',
        dob: patient.dob || '',
        masterPatientId: '',
        medicalRecordNumber: patient.ipp || '',
        identityDocuments: [{ type: 'CIN', number: '', issuingCountry: 'MA', isPrimary: true }]
      }));
    }
    
    setSelectedExistingPatientId(patient.id); // Track for update
    setStatus('VERIFIED');
    setIsLocked(false); // Fields remain editable
    setSearchQuery(`${patient.firstName} ${patient.lastName}`);
    setSearchResults([]);
  };

  const handleClearIdentity = () => {
    setIsLocked(false);
    setSelectedExistingPatientId(null);
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
            identityStatus: status,
            lifecycleStatus: 'ACTIVE' as const,
            masterPatientId: formData.masterPatientId || undefined,
            medicalRecordNumber: formData.medicalRecordNumber || undefined,
            contacts: [], 
            addresses: [],
            insurances: [],
            identifiers: formData.identityDocuments.filter(d => d.number).map(d => ({
                typeCode: d.type,
                value: d.number,
                issuingCountryCode: d.issuingCountry,
                isPrimary: d.isPrimary
            })),
            // Relationships handled below
            relationships: formData.relationships.map(r => ({
              relatedFirstName: r.firstName,
              relatedLastName: r.lastName,
              relatedPhone: r.phone,
              relationshipTypeCode: r.relationship,
              isLegalGuardian: r.isLegalGuardian,
              isEmergencyContact: r.isEmergencyContact,
              isDecisionMaker: r.isDecisionMaker,
              isPrimary: false
          })),
        };

        // Add optional fields
        if (formData.phone || formData.email) {
            payload.contacts.push({ phone: formData.phone, email: formData.email });
        }
        if (formData.address || formData.city) {
            payload.addresses.push({ addressLine: formData.address, city: formData.city });
        }
        
        // Coverage logic (New Schema)
        if (!formData.isPayant && formData.insuranceOrgId) {
            const isSelf = formData.insuranceSubscriberRelationship === 'SELF';
            
            const coverageEntry: any = {
                insuranceOrgId: formData.insuranceOrgId,
                policyNumber: formData.policyNumber || undefined,
                relationshipToSubscriberCode: formData.insuranceSubscriberRelationship,
                existingCoverageId: formData.existingCoverageId || undefined
            };

            if (!isSelf) {
                coverageEntry.subscriber = {
                    firstName: formData.subscriberFirstName,
                    lastName: formData.subscriberLastName,
                    // If linking to existing patient
                    tenantPatientId: formData.subscriberPatientId || undefined
                };

                // If new external person, include identifiers
                if (!formData.subscriberPatientId && formData.subscriberDocNumber) {
                     coverageEntry.subscriber.identifiers = [{
                        typeCode: formData.subscriberDocType || 'CIN',
                        value: formData.subscriberDocNumber,
                        countryCode: formData.subscriberDocIssuingCountry || formData.subscriberDocCountry || 'MA',
                     }];
                }
            }
            
            payload.coverages = [coverageEntry];
        }

        // Call API — update if editing existing patient, create if new
      // Submit
      let newPatientId: string;
      if (selectedExistingPatientId) {
          const res = await api.updatePatient(selectedExistingPatientId, payload);
          newPatientId = res.tenantPatientId;
      } else {
          const res = await api.createPatient(payload);
          newPatientId = res.tenantPatientId;
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
                placeholder="Rechercher un patient (Nom, IPP, CIN...) puis Entrée"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); executeSearch(); } }}
                disabled={isLocked}
                autoFocus
            />
            {isSearching && <Loader2 className="animate-spin text-slate-400 mr-3" />}
            {searchQuery && !isLocked && (
                <button 
                    onClick={clearSearch}
                    title="Effacer"
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <X size={18} />
                </button>
            )}
            <button 
                onClick={executeSearch}
                disabled={isLocked || searchQuery.length < 2}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
                Rechercher
            </button>
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
                            className="w-full flex items-start p-3 hover:bg-slate-50 rounded-xl transition-all text-left group border-b last:border-0 border-slate-50"
                         >
                             <div className={`mt-1 p-2 rounded-full mr-3 shrink-0 ${res.sex === 'F' ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600'}`}>
                                 <User size={16} />
                             </div>
                             <div className="flex-1 min-w-0">
                                 <div className="flex items-center justify-between mb-1">
                                    <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate pr-2">
                                        {res.firstName} {res.lastName}
                                    </div>
                                    {res.ipp && <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border uppercase shrink-0">IPP: {res.ipp}</span>}
                                 </div>
                                 
                                 <div className="grid grid-cols-2 gap-y-1 gap-x-4 text-xs text-slate-500">
                                     {/* DOB & SEX */}
                                     {res.dob && (
                                         <div className="col-span-2 flex items-center gap-2">
                                            <Calendar size={12} className="text-slate-400" />
                                            <span>Né(e) le {new Date(res.dob).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${res.sex === 'F' ? 'bg-pink-50 text-pink-600' : 'bg-blue-50 text-blue-600'}`}>
                                                {res.sex === 'F' ? 'Femme' : 'Homme'}
                                            </span>
                                         </div>
                                     )}
                                     
                                     {/* IDENTITY DOCS */}
                                     {(res.identifiers || []).filter((id: any) => id && id.typeCode).map((id: any, idx: number) => (
                                         <div key={idx} className="col-span-2 flex items-center gap-1.5 mt-0.5">
                                             <ShieldCheck size={12} className={idx === 0 ? "text-emerald-500" : "text-slate-400"} />
                                             <span className="font-medium uppercase text-slate-700">{id.typeCode}:</span>
                                             <span className="font-mono text-slate-600">{id.value}</span>
                                             {id.issuingCountry && <span className="text-[10px] text-slate-400">({id.issuingCountry})</span>}
                                         </div>
                                     ))}
                                 </div>
                             </div>
                             <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-500 mt-2" />
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
                      <div className="relative">
                        <InputField 
                          label="Prénom" 
                          value={formData.firstName} 
                          onChange={(v: string) => setFormData({...formData, firstName: v})}
                          disabled={isLocked || status === 'UNKNOWN'}
                          error={errors.firstName}
                          placeholder={status === 'UNKNOWN' ? 'INCONNU' : ''}
                        />
                        {searchQuery && !formData.firstName && !isLocked && status !== 'UNKNOWN' && (
                          <button type="button" title="Copier depuis la recherche" onClick={() => {
                            const parts = searchQuery.trim().split(/\s+/);
                            setFormData(prev => ({...prev, firstName: parts[0] || searchQuery}));
                          }} className="absolute top-0 right-0 p-1 text-indigo-500 hover:bg-indigo-50 rounded transition-colors">
                            <ArrowDownToLine size={12} />
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <InputField 
                          label="Nom" 
                          value={formData.lastName}
                          onChange={(v: string) => setFormData({...formData, lastName: v})}
                          disabled={isLocked || status === 'UNKNOWN'}
                          error={errors.lastName}
                          placeholder={status === 'UNKNOWN' ? 'INCONNU' : ''}
                        />
                        {searchQuery && !formData.lastName && !isLocked && status !== 'UNKNOWN' && (
                          <button type="button" title="Copier depuis la recherche" onClick={() => {
                            const parts = searchQuery.trim().split(/\s+/);
                            setFormData(prev => ({...prev, lastName: parts.length > 1 ? parts.slice(1).join(' ') : searchQuery}));
                          }} className="absolute top-0 right-0 p-1 text-indigo-500 hover:bg-indigo-50 rounded transition-colors">
                            <ArrowDownToLine size={12} />
                          </button>
                        )}
                      </div>
                      
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
                                        <div className="relative flex-1">
                                            <InputField 
                                                label="Numéro" 
                                                value={doc.number} 
                                                onChange={(v: string) => updateDocument(idx, 'number', v)}
                                                disabled={isLocked}
                                                error={doc.isPrimary && errors.documentNumber}
                                            />
                                            {searchQuery && !doc.number && !isLocked && idx === 0 && (
                                              <button type="button" title="Copier depuis la recherche" onClick={() => {
                                                updateDocument(idx, 'number', searchQuery.trim());
                                              }} className="absolute top-0 right-0 p-1 text-indigo-500 hover:bg-indigo-50 rounded transition-colors">
                                                <ArrowDownToLine size={12} />
                                              </button>
                                            )}
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

              {/* CONTACTS & RELATIONSHIPS SECTION */}
              <CardSection title="Liens et contacts du patient" icon={Users} rightElement={
                <button onClick={addRelationship} className="text-emerald-600 hover:text-emerald-700 p-1 hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold">
                  <Plus size={14} /> Ajouter
                </button>
              }>
                {formData.relationships.length === 0 ? (
                  <div className="text-center py-6">
                    <Users size={28} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-sm text-slate-400">Aucun contact enregistré</p>
                    <button onClick={addRelationship} className="mt-3 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-colors">
                      <Plus size={14} className="inline mr-1" /> Ajouter un contact
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {formData.relationships.map((rel, idx) => (
                      <div key={idx} className="p-4 rounded-xl border bg-slate-50 border-slate-200">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Contact {idx + 1}</span>
                            <button onClick={() => removeRelationship(idx)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-white transition-colors">
                            <Trash2 size={14} />
                            </button>
                        </div>
                        
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <InputField label="Prénom" value={rel.firstName} onChange={(v: string) => updateRelationship(idx, 'firstName', v)} />
                                <InputField label="Nom" value={rel.lastName} onChange={(v: string) => updateRelationship(idx, 'lastName', v)} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <InputField label="Téléphone" icon={Phone} value={rel.phone} onChange={(v: string) => updateRelationship(idx, 'phone', v)} />
                                <SelectField 
                                    label="Relation" 
                                    options={[
                                        { value: 'FATHER', label: 'Père' },
                                        { value: 'MOTHER', label: 'Mère' },
                                        { value: 'SPOUSE', label: 'Conjoint(e)' },
                                        { value: 'CHILD', label: 'Enfant' },
                                        { value: 'SIBLING', label: 'Frère / Sœur' },
                                        { value: 'GUARDIAN', label: 'Tuteur / Tutrice' },
                                        { value: 'FRIEND', label: 'Ami(e)' },
                                        { value: 'COLLEAGUE', label: 'Collègue' },
                                        { value: 'NEIGHBOR', label: 'Voisin(e)' },
                                        { value: 'OTHER', label: 'Autre' },
                                    ]} 
                                    value={rel.relationship} 
                                    onChange={(v: string) => updateRelationship(idx, 'relationship', v)}
                                />
                            </div>
                            
                            <div className="flex flex-wrap gap-2 mt-2">
                                <label className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${rel.isLegalGuardian ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                                    <input type="checkbox" checked={rel.isLegalGuardian} onChange={(e) => updateRelationship(idx, 'isLegalGuardian', e.target.checked)} className="accent-indigo-600 w-3.5 h-3.5" />
                                    Tuteur Légal
                                </label>
                                <label className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${rel.isEmergencyContact ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                                    <input type="checkbox" checked={rel.isEmergencyContact} onChange={(e) => updateRelationship(idx, 'isEmergencyContact', e.target.checked)} className="accent-rose-600 w-3.5 h-3.5" />
                                    Contact d'Urgence
                                </label>
                                <label className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${rel.isDecisionMaker ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                                    <input type="checkbox" checked={rel.isDecisionMaker} onChange={(e) => updateRelationship(idx, 'isDecisionMaker', e.target.checked)} className="accent-amber-600 w-3.5 h-3.5" />
                                    Personne de confiance (Proxy)
                                </label>
                            </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardSection>

              <CardSection title="Couverture / Assurance" icon={CreditCard} rightElement={
                  <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase text-slate-500">Patient Payant</span>
                      <button 
                        onClick={() => setFormData(prev => ({ ...prev, isPayant: !prev.isPayant, insuranceOrgId: '', policyNumber: '', existingCoverageId: '' }))}
                        className={`w-10 h-5 rounded-full transition-colors relative ${formData.isPayant ? 'bg-emerald-500' : 'bg-slate-200'}`}
                      >
                          <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${formData.isPayant ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                  </div>
              }>
                  <div className={`transition-all ${formData.isPayant ? 'opacity-50 pointer-events-none grayscale' : 'opacity-100'}`}>
                      {/* Search First Workflow */}
                      <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <SelectField 
                                label="Organisme" 
                                options={organismes.map(o => ({ value: o.id, label: o.designation || o.label || o.name || 'Inconnu' }))} 
                                value={formData.insuranceOrgId} 
                                onChange={(v: string) => {
                                    setFormData(prev => ({ ...prev, insuranceOrgId: v, existingCoverageId: '' }));
                                    setCoverageSearchMode(true);
                                }}
                                disabled={isLocked}
                            />
                             <div className="relative">
                                <InputField 
                                    label="Numéro de Police / Immatriculation" 
                                    value={formData.policyNumber} 
                                    onChange={(v: string) => {
                                         setFormData(prev => ({ ...prev, policyNumber: v, existingCoverageId: '' }));
                                         setCoverageSearchMode(true);
                                    }}
                                    disabled={isLocked} 
                                />
                                {coverageSearchMode && formData.insuranceOrgId && formData.policyNumber.length > 2 && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-slate-200 shadow-xl z-20 p-2">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase mb-2 px-2">Recherche existante...</div>
                                        {foundCoverages.length > 0 ? (
                                            foundCoverages.map(cov => (
                                                <button
                                                    key={cov.coverageId}
                                                    onClick={() => selectExistingCoverage(cov)}
                                                    className="w-full text-left p-2 hover:bg-emerald-50 rounded-lg text-sm flex items-center justify-between group"
                                                >
                                                    <div>
                                                        <div className="font-bold text-slate-800">{cov.policyNumber}</div>
                                                        <div className="text-xs text-slate-500">{cov.organismeName}</div>
                                                    </div>
                                                    <div className="text-emerald-600 opacity-0 group-hover:opacity-100 text-xs font-bold">Sélectionner</div>
                                                </button>
                                            ))
                                        ) : (
                                            <div className="p-2 text-xs text-slate-500 italic">Aucune couverture trouvée pour cette référence. Elle sera créée.</div>
                                        )}
                                    </div>
                                )}
                             </div>
                          </div>

                          {/* Relationship to Subscriber */}
                          <div className="pt-2 border-t border-slate-100">
                             <div className="grid grid-cols-2 gap-4">
                                <SelectField 
                                    label="Lien avec l'Assuré" 
                                    options={[
                                        { value: 'SELF', label: 'Lui-même (Assuré Principal)' },
                                        { value: 'SPOUSE', label: 'Conjoint(e)' },
                                        { value: 'CHILD', label: 'Enfant' },
                                        { value: 'OTHER', label: 'Autre' }
                                    ]} 
                                    value={formData.insuranceSubscriberRelationship} 
                                    onChange={(v: string) => setFormData(prev => ({ ...prev, insuranceSubscriberRelationship: v }))}
                                    disabled={isLocked || !!formData.existingCoverageId}
                                />
                             </div>
                             
                             {/* Subscriber Details - Only if NOT SELF */}
                             {formData.insuranceSubscriberRelationship !== 'SELF' && (
                                 <div className="mt-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                     <div className="text-xs font-bold text-slate-700 uppercase mb-3 flex items-center gap-2">
                                         <User size={14} /> Détails de l'Assuré
                                     </div>
                                     
                                     {/* Universal Search Bar */}
                                     <div className="mb-4">
                                         <div className="text-[10px] font-extrabold uppercase text-slate-400 mb-1.5">Recherche Patient Existant</div>
                                         <div className="relative">
                                             <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                             <input 
                                                 type="text"
                                                 value={subscriberSearchQuery}
                                                 onChange={async (e) => {
                                                     const q = e.target.value;
                                                     setSubscriberSearchQuery(q);
                                                     if (q.length >= 2) {
                                                         setSubscriberSearching(true);
                                                         try {
                                                             const results = await api.searchUniversal(q);
                                                             setSubscriberSearchResults(results);
                                                         } catch (err) { console.error(err); }
                                                         setSubscriberSearching(false);
                                                     } else {
                                                         setSubscriberSearchResults([]);
                                                     }
                                                 }}
                                                 placeholder="Rechercher par nom, CIN, IPP..."
                                                 className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                                             />
                                             {subscriberSearching && <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">...</div>}
                                         </div>

                                         {/* Search Results Dropdown */}
                                         {subscriberSearchResults.length > 0 && (
                                             <div className="mt-1 border border-slate-200 rounded-lg bg-white shadow-lg max-h-40 overflow-y-auto">
                                                 {subscriberSearchResults.map((r: any) => (
                                                     <button key={r.id} type="button" onClick={() => {
                                                         setFormData(prev => ({
                                                             ...prev,
                                                             subscriberPatientId: r.id,
                                                             subscriberPatientLabel: `${r.firstName} ${r.lastName}${r.mrn ? ` (${r.mrn})` : ''}`,
                                                             subscriberFirstName: r.firstName || '',
                                                             subscriberLastName: r.lastName || '',
                                                         }));
                                                         setSubscriberSearchResults([]);
                                                         setSubscriberSearchQuery('');
                                                     }} className="w-full text-left px-3 py-2 hover:bg-indigo-50 text-sm flex items-center gap-2 border-b border-slate-50 last:border-0 transition-colors">
                                                         <User size={14} className="text-slate-400 shrink-0" />
                                                         <span className="font-bold text-slate-800">{r.lastName} {r.firstName}</span>
                                                         {r.mrn && <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-mono">{r.mrn}</span>}
                                                     </button>
                                                 ))}
                                             </div>
                                         )}
                                         {subscriberSearchQuery.length >= 2 && subscriberSearchResults.length === 0 && !subscriberSearching && (
                                             <div className="mt-1 text-[10px] text-slate-400 italic">Aucun patient trouvé — remplissez les champs ci-dessous.</div>
                                         )}
                                     </div>

                                     {/* Linked Patient Badge */}
                                     {formData.subscriberPatientId && (
                                         <div className="mb-3 flex items-center gap-2 p-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm">
                                             <CheckCircle2 size={16} />
                                             <span className="font-bold">{formData.subscriberPatientLabel || 'Patient Sélectionné'}</span>
                                             <button type="button" onClick={() => setFormData(prev => ({ ...prev, subscriberPatientId: '', subscriberPatientLabel: '' }))} className="ml-auto p-1 hover:bg-white rounded">
                                                 <X size={14} />
                                             </button>
                                         </div>
                                     )}

                                     {/* Manual Fields (always visible when no linked patient) */}
                                     {!formData.subscriberPatientId && (
                                         <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2">
                                             {/* Prénom Assuré + Copy Button */}
                                             <div className="relative">
                                                 <InputField label="Prénom Assuré" value={formData.subscriberFirstName} onChange={(v: string) => setFormData(prev => ({...prev, subscriberFirstName: v}))} required />
                                                 {subscriberSearchQuery && !formData.subscriberFirstName && (
                                                     <button type="button" title="Copier depuis la recherche" onClick={() => {
                                                         const parts = subscriberSearchQuery.trim().split(/\s+/);
                                                         setFormData(prev => ({...prev, subscriberFirstName: parts[0] || subscriberSearchQuery}));
                                                     }} className="absolute top-0 right-0 p-1 text-indigo-500 hover:bg-indigo-50 rounded transition-colors" >
                                                         <ArrowDownToLine size={12} />
                                                     </button>
                                                 )}
                                             </div>
                                             {/* Nom Assuré + Copy Button */}
                                             <div className="relative">
                                                 <InputField label="Nom Assuré" value={formData.subscriberLastName} onChange={(v: string) => setFormData(prev => ({...prev, subscriberLastName: v}))} required />
                                                 {subscriberSearchQuery && !formData.subscriberLastName && (
                                                     <button type="button" title="Copier depuis la recherche" onClick={() => {
                                                         const parts = subscriberSearchQuery.trim().split(/\s+/);
                                                         setFormData(prev => ({...prev, subscriberLastName: parts.length > 1 ? parts.slice(1).join(' ') : subscriberSearchQuery}));
                                                     }} className="absolute top-0 right-0 p-1 text-indigo-500 hover:bg-indigo-50 rounded transition-colors" >
                                                         <ArrowDownToLine size={12} />
                                                     </button>
                                                 )}
                                             </div>
                                             
                                             <div className="col-span-2 pt-2">
                                                 <div className="text-[10px] font-extrabold uppercase text-slate-400 mb-2">Identifiant (CIN/Passeport)</div>
                                                 <div className="flex gap-2">
                                                     <div className="w-1/4">
                                                         <SelectField options={['CIN', 'PASSPORT', 'SEJOUR']} value={formData.subscriberDocType} onChange={(v: string) => setFormData(prev => ({...prev, subscriberDocType: v}))} />
                                                     </div>
                                                     <div className="relative flex-1">
                                                         <InputField label="" placeholder="Numéro" value={formData.subscriberDocNumber} onChange={(v: string) => setFormData(prev => ({...prev, subscriberDocNumber: v}))} />
                                                         {subscriberSearchQuery && !formData.subscriberDocNumber && (
                                                             <button type="button" title="Copier depuis la recherche" onClick={() => {
                                                                 setFormData(prev => ({...prev, subscriberDocNumber: subscriberSearchQuery.trim()}));
                                                             }} className="absolute top-0 right-0 p-1 text-indigo-500 hover:bg-indigo-50 rounded transition-colors" >
                                                                 <ArrowDownToLine size={12} />
                                                             </button>
                                                         )}
                                                     </div>
                                                     <div className="w-1/4">
                                                         <SelectField 
                                                             label="" 
                                                             options={countries.map((c: any) => ({ value: c.iso_code, label: `${c.iso_code} - ${c.name}` }))} 
                                                             value={formData.subscriberDocIssuingCountry || 'MA'} 
                                                             onChange={(v: string) => setFormData(prev => ({...prev, subscriberDocIssuingCountry: v}))}
                                                         />
                                                     </div>
                                                 </div>
                                             </div>
                                         </div>
                                     )}
                                 </div>
                             )}
                          </div>
                      </div>
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
              <span>{selectedExistingPatientId ? 'Modifier & Continuer' : 'Créer & Continuer'}</span>
          </button>
      </div>

    </div>
  );
};
