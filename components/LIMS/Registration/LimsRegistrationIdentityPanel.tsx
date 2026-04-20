import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../../services/api';
import { FileText, CheckCircle2, ChevronRight, X, Loader2, User, Search, MapPin, Phone, ShieldCheck, UserPlus, AlertOctagon, ArrowDownToLine, ChevronDown, Calendar, Globe } from 'lucide-react';
import { Patient, Admission } from '../../../types';
import { CustomDatePicker } from '../../ui/CustomDatePicker';

interface LimsRegistrationIdentityPanelProps {
    onReady: (patient: Patient, admission: Admission) => void;
    onReset: () => void;
    selectedPatient: Patient | null;
    selectedAdmission: Admission | null;
}

// Custom Vertically Stacked Form Components
const VertInput = ({ label, value, onChange, icon: Icon, required, disabled, placeholder, rightElement }: any) => (
  <div className="flex flex-col space-y-1.5 w-full relative">
    <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center">
      {label} {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    <div className="relative group">
      {Icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Icon size={14} /></div>}
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className={`w-full rounded-xl border border-slate-200 py-2.5 text-sm font-medium transition-all outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 disabled:bg-slate-50 disabled:text-slate-500 ${Icon ? 'pl-9' : 'pl-3'} ${rightElement ? 'pr-9' : 'pr-3'}`}
      />
      {rightElement}
    </div>
  </div>
);

const VertSelect = ({ label, value, onChange, options, icon: Icon, disabled }: any) => (
  <div className="flex flex-col space-y-1.5 w-full">
    <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{label}</label>
    <div className="relative group">
      {Icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10"><Icon size={14} /></div>}
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-medium transition-all outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 disabled:bg-slate-50 disabled:text-slate-500 ${Icon ? 'pl-9' : 'pl-3'} pr-10`}
      >
        <option value="" disabled>Sélectionner...</option>
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

export const LimsRegistrationIdentityPanel: React.FC<LimsRegistrationIdentityPanelProps> = ({
    onReady,
    onReset,
    selectedPatient,
    selectedAdmission
}) => {
    // Session State
    const [localPatient, setLocalPatient] = useState<Patient | null>(null);
    const [isLoadingAdmissions, setIsLoadingAdmissions] = useState(false);
    const [patientAdmissions, setPatientAdmissions] = useState<Admission[]>([]);

    // Form State
    const [isUnknown, setIsUnknown] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedExistingPatientId, setSelectedExistingPatientId] = useState<string | null>(null);
    const searchRef = useRef<HTMLDivElement>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        sex: '',
        dob: '',
        docType: 'CIN',
        docNumber: '',
        docCountry: 'MA',
        phone: '',
        city: '',
        address: '',
        // Insurance fields
        isPayant: false,
        insuranceOrgId: '',
        policyNumber: '',
        insuranceSubscriberRelationship: 'SELF',
        subscriberFirstName: '',
        subscriberLastName: ''
    });

    // Derived identity status
    const deriveStatus = (): 'UNKNOWN' | 'PROVISIONAL' | 'VERIFIED' => {
        if (isUnknown) return 'UNKNOWN';
        const hasName = !!formData.firstName?.trim() && !!formData.lastName?.trim();
        const hasDob = !!formData.dob;
        const hasSex = !!formData.sex;
        const hasDoc = !!formData.docNumber?.trim();
        if (hasName && hasDob && hasSex && hasDoc) return 'VERIFIED';
        return 'PROVISIONAL';
    };
    const status = deriveStatus();

    const [countries, setCountries] = useState<any[]>([]);
    const [docTypes, setDocTypes] = useState<any[]>([]);
    const [organismes, setOrganismes] = useState<any[]>([]);

    useEffect(() => {
        const loadDicts = async () => {
            try {
                const [cntrs, dts, orgs] = await Promise.all([
                    api.limsConfig.execution.getTenantCountries(),
                    api.limsConfig.execution.getTenantIdentityDocumentTypes(),
                    api.limsConfig.execution.getTenantOrganismes()
                ]);
                setCountries(cntrs);
                setDocTypes(dts);
                setOrganismes(orgs);
            } catch (err) { console.error('Dict load error', err); }
        };
        loadDicts();
    }, []);

    useEffect(() => {
        if (!selectedPatient) {
            setLocalPatient(null);
            setPatientAdmissions([]);
            handleClearIdentity();
        }
    }, [selectedPatient]);

    // Click outside search
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setSearchResults([]);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const executeSearch = async () => {
        if (searchQuery.length >= 2) {
            setIsSearching(true);
            try {
                const results = await api.limsConfig.execution.searchUniversalPatient(searchQuery);
                setSearchResults(results);
            } catch (e) {
                console.error(e);
            } finally {
                setIsSearching(false);
            }
        }
    };

    const handleSelectResult = async (res: any) => {
        try {
            const detail = await api.limsConfig.execution.getPatient(res.id);
            const identityDoc = detail.identifiers?.find((i: any) => i.identityTypeCode !== 'LOCAL_MRN');
            
            setFormData({
                firstName: detail.firstName || res.firstName || '',
                lastName: detail.lastName || res.lastName || '',
                sex: detail.sex || detail.gender || res.sex || '',
                dob: detail.dob || detail.dateOfBirth || res.dob || '',
                docType: identityDoc?.identityTypeCode || 'CIN',
                docNumber: identityDoc?.identityValue || '',
                docCountry: identityDoc?.issuingCountryCode || 'MA',
                phone: detail.contacts?.[0]?.phone || '',
                city: detail.addresses?.[0]?.city || '',
                address: detail.addresses?.[0]?.addressLine || '',
                isPayant: detail.coverages?.length === 0,
                insuranceOrgId: detail.coverages?.[0]?.insuranceOrgId || '',
                policyNumber: detail.coverages?.[0]?.policyNumber || '',
                insuranceSubscriberRelationship: detail.coverages?.[0]?.relationshipToSubscriberCode || 'SELF',
                subscriberFirstName: detail.coverages?.[0]?.subscriber?.firstName || '',
                subscriberLastName: detail.coverages?.[0]?.subscriber?.lastName || ''
            });
        } catch(e) {
            setFormData({
                ...formData,
                firstName: res.firstName,
                lastName: res.lastName,
                sex: res.sex || '',
                dob: res.dob || ''
            });
        }

        setSelectedExistingPatientId(res.id);
        setIsUnknown(false);
        setSearchQuery(`${res.firstName} ${res.lastName}`);
        setSearchResults([]);
    };

    const handleClearIdentity = () => {
        setSelectedExistingPatientId(null);
        setSearchQuery('');
        setFormData({
            firstName: '', lastName: '', sex: '', dob: '', 
            docType: 'CIN', docNumber: '', docCountry: 'MA', 
            phone: '', city: '', address: '',
            isPayant: false, insuranceOrgId: '', policyNumber: '', 
            insuranceSubscriberRelationship: 'SELF', subscriberFirstName: '', subscriberLastName: ''
        });
        setIsUnknown(false);
    };

    const handleSubmit = async () => {
        if (!isUnknown && (!formData.firstName || !formData.lastName)) return;

        setIsSubmitting(true);
        try {
            const payload: any = {
                firstName: formData.firstName,
                lastName: formData.lastName,
                sex: formData.sex,
                dob: formData.dob,
                identityStatus: status,
                lifecycleStatus: 'ACTIVE',
                identifiers: formData.docNumber ? [{ typeCode: formData.docType, value: formData.docNumber, issuingCountryCode: formData.docCountry, isPrimary: true }] : [],
                contacts: formData.phone ? [{ phone: formData.phone }] : [],
                addresses: (formData.city || formData.address) ? [{ city: formData.city, addressLine: formData.address }] : []
            };

            if (!formData.isPayant && formData.insuranceOrgId) {
                payload.coverages = [{
                    insuranceOrgId: formData.insuranceOrgId,
                    policyNumber: formData.policyNumber || undefined,
                    relationshipToSubscriberCode: formData.insuranceSubscriberRelationship,
                    subscriber: formData.insuranceSubscriberRelationship !== 'SELF' ? {
                        firstName: formData.subscriberFirstName,
                        lastName: formData.subscriberLastName
                    } : undefined
                }];
            }

            let patientId = selectedExistingPatientId;
            if (patientId) {
                await api.limsConfig.execution.updatePatient(patientId, payload);
            } else {
                const created = await api.limsConfig.execution.createPatient(payload);
                patientId = created.tenantPatientId;
            }

            // Post-Submit Admission Resolution
            setIsLoadingAdmissions(true);
            const fullPatient = await api.limsConfig.execution.getPatient(patientId!);
            
            const allAdmissions = await api.limsConfig.execution.getAdmissions();
            const activeForPatient = allAdmissions.filter(a => a.patientId === patientId && a.status !== 'Sorti');

            setPatientAdmissions(activeForPatient);
            
            if (activeForPatient.length === 0) {
                const newAdm = await api.limsConfig.execution.createAdmission({
                    patientId: fullPatient.id,
                    tenantPatientId: fullPatient.id,
                    type: 'LAB_WALKIN',
                    status: 'En cours',
                    admissionDate: new Date().toISOString()
                } as any);
                onReady(fullPatient, newAdm);
            } else {
                setLocalPatient(fullPatient);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSubmitting(false);
            setIsLoadingAdmissions(false);
        }
    };

    const handleCreateWalkinAdmission = async () => {
        if (!localPatient) return;
        try {
            setIsLoadingAdmissions(true);
            const newAdm = await api.limsConfig.execution.createAdmission({
                patientId: localPatient.id,
                tenantPatientId: localPatient.id,
                type: 'LAB_WALKIN',
                status: 'En cours',
                admissionDate: new Date().toISOString()
            } as any);
            onReady(localPatient, newAdm);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoadingAdmissions(false);
        }
    };

    const currentlyViewedPatient = selectedPatient || localPatient;

    if (currentlyViewedPatient) {
        return (
            <div className="flex flex-col h-full bg-slate-50 border-r border-slate-200 w-[400px] shrink-0">
                <div className="p-6 border-b border-slate-200 bg-white shadow-sm z-10 flex-1">
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                                <User size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                                    {currentlyViewedPatient.lastName} {currentlyViewedPatient.firstName}
                                </h2>
                                <p className="text-xs font-bold text-slate-500 mt-0.5">IPP: {currentlyViewedPatient.ipp}</p>
                            </div>
                        </div>
                        <button onClick={onReset} title="Changer de patient" className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-500 transition-colors">
                            <X size={18} />
                        </button>
                    </div>

                    {!selectedAdmission && patientAdmissions.length > 0 && (
                        <div className="mt-6 animate-in slide-in-from-top-4 fade-in duration-300">
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-sm">
                                <h3 className="text-sm font-black text-amber-800 mb-3 flex items-center">
                                    <FileText size={18} className="mr-2" /> Admission(s) Active(s)
                                </h3>
                                <div className="space-y-2">
                                    {patientAdmissions.map(adm => (
                                        <button 
                                            key={adm.id} 
                                            onClick={() => onReady(currentlyViewedPatient, adm)}
                                            className="w-full text-left bg-white border border-amber-200 hover:border-amber-400 p-3 rounded-xl flex items-center justify-between transition-all hover:shadow-md group"
                                        >
                                            <div>
                                                <p className="text-sm font-black text-slate-800">Associer (NDA: {adm.nda})</p>
                                                <p className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">{adm.service || 'Service Inconnu'}</p>
                                            </div>
                                            <div className="p-1.5 bg-amber-50 rounded-lg group-hover:bg-amber-100 transition-colors">
                                                <ChevronRight size={16} className="text-amber-600" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                                <div className="mt-4 pt-4 border-t border-amber-200/50 flex flex-col items-center">
                                    <span className="text-[10px] font-bold text-amber-600 uppercase mb-3 px-2 bg-amber-50 relative -top-6">OU FORCER UN</span>
                                    <button 
                                        onClick={handleCreateWalkinAdmission}
                                        disabled={isLoadingAdmissions}
                                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-colors uppercase tracking-wide flex items-center justify-center gap-2"
                                    >
                                        {isLoadingAdmissions ? <Loader2 size={16} className="animate-spin" /> : null}
                                        Nouveau Lab Walk-In
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {selectedAdmission && (
                        <div className="mt-6 flex items-center space-x-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 shadow-sm">
                            <div className="bg-white p-2 rounded-xl border border-emerald-100 text-emerald-500 flex-shrink-0">
                                <CheckCircle2 size={20} />
                            </div>
                            <div>
                                <p className="text-xs font-black text-emerald-800 uppercase tracking-tight">Prêt pour prélèvement</p>
                                <p className="text-[10px] font-bold text-emerald-600 mt-0.5">{selectedAdmission.nda} • {selectedAdmission.type}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-50 border-r border-slate-200 w-[400px] shrink-0 relative">
            
            {/* SEARCH HEADER */}
            <div className="p-4 border-b border-slate-200 bg-white z-20 shrink-0" ref={searchRef}>
                <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center gap-2 border border-transparent focus-within:border-indigo-200 focus-within:bg-indigo-50/50 transition-colors relative">
                    <Search size={18} className="text-slate-400 ml-2 shrink-0" />
                    <input 
                        className="flex-1 bg-transparent border-none outline-none text-sm font-medium placeholder:text-slate-400 py-1"
                        placeholder="Rechercher (Nom, IPP, CIN...)"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') executeSearch(); }}
                    />
                    {searchQuery && (
                        <button onClick={handleClearIdentity} className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 mr-1"><X size={14}/></button>
                    )}
                    
                    {searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-80 overflow-y-auto">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-2 bg-slate-50 border-b border-slate-100">Résultats</div>
                            {searchResults.map((res: any) => (
                                <button 
                                    key={res.id} onClick={() => handleSelectResult(res)}
                                    className="w-full flex items-center p-3 hover:bg-indigo-50 border-b border-slate-50 last:border-0 text-left"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-slate-800 truncate text-sm">{res.lastName} {res.firstName}</div>
                                        <div className="text-[10px] text-slate-500 truncate">{res.dob ? new Date(res.dob).toLocaleDateString() : ''} {res.ipp && `• IPP: ${res.ipp}`}</div>
                                    </div>
                                    <ChevronRight size={14} className="text-slate-300 ml-2 shrink-0" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* SCROLLABLE FORM */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                


                <div className="space-y-6">
                    {/* SECTION: IDENTITE */}
                    <div className="space-y-4">
                        <h4 className="flex items-center text-xs font-black uppercase tracking-widest text-slate-400 gap-2 mb-2 pb-2 border-b border-slate-200/50">
                            <User size={14} /> Identité Patient
                        </h4>
                        
                        <VertInput label="Prénom" value={formData.firstName} onChange={(v: string) => setFormData({...formData, firstName: v})} required disabled={status==='UNKNOWN'} placeholder={status==='UNKNOWN'?'INCONNU':''} rightElement={
                            searchQuery && !formData.firstName && status !== 'UNKNOWN' && (
                                <button onClick={() => setFormData({...formData, firstName: searchQuery.split(/\s+/)[0]})} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-indigo-500 hover:bg-indigo-50 rounded">
                                    <ArrowDownToLine size={14}/>
                                </button>
                            )
                        } />
                        
                        <VertInput label="Nom" value={formData.lastName} onChange={(v: string) => setFormData({...formData, lastName: v})} required disabled={status==='UNKNOWN'} placeholder={status==='UNKNOWN'?'INCONNU':''} rightElement={
                            searchQuery && !formData.lastName && status !== 'UNKNOWN' && (
                                <button onClick={() => setFormData({...formData, lastName: searchQuery.split(/\s+/).slice(1).join(' ') || searchQuery})} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-indigo-500 hover:bg-indigo-50 rounded">
                                    <ArrowDownToLine size={14}/>
                                </button>
                            )
                        } />

                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col space-y-1.5">
                                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Sexe {status !== 'UNKNOWN' && '*'}</label>
                                <div className="flex bg-slate-100 p-1 rounded-xl h-[42px] border border-slate-200">
                                    {['M', 'F'].map(g => (
                                        <button 
                                            key={g} onClick={() => setFormData({...formData, sex: g})} disabled={status==='UNKNOWN'}
                                            className={`flex-1 text-xs font-black rounded-lg transition-all ${formData.sex === g ? (g==='M'?'bg-white text-blue-600 shadow-sm':'bg-white text-pink-600 shadow-sm') : 'text-slate-400'}`}
                                        >
                                            {g}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <CustomDatePicker label="Date de Naiss." value={formData.dob} onChange={(v: string) => setFormData({...formData, dob: v})} disabled={status==='UNKNOWN'} />
                            </div>
                        </div>
                    </div>

                    {/* SECTION: DOCUMENT */}
                    {status !== 'UNKNOWN' && (
                        <div className="space-y-4 pt-2">
                            <h4 className="flex items-center text-xs font-black uppercase tracking-widest text-slate-400 gap-2 mb-2 pb-2 border-b border-slate-200/50">
                                <FileText size={14} /> Pièce d'Identité
                            </h4>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="col-span-1">
                                    <VertSelect label="Type" options={docTypes.map(d=>d.code || d)} value={formData.docType} onChange={(v: string) => setFormData({...formData, docType: v})} />
                                </div>
                                <div className="col-span-2">
                                    <VertInput label="Numéro" value={formData.docNumber} onChange={(v: string) => setFormData({...formData, docNumber: v})} placeholder="N°" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SECTION: CONTACT */}
                    <div className="space-y-4 pt-2">
                        <h4 className="flex items-center text-xs font-black uppercase tracking-widest text-slate-400 gap-2 mb-2 pb-2 border-b border-slate-200/50">
                            <MapPin size={14} /> Contacts & Adresse
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            <VertInput label="Téléphone" icon={Phone} value={formData.phone} onChange={(v: string) => setFormData({...formData, phone: v})} />
                            <VertInput label="Ville" value={formData.city} onChange={(v: string) => setFormData({...formData, city: v})} />
                        </div>
                        <VertInput label="Adresse Complète" value={formData.address} onChange={(v: string) => setFormData({...formData, address: v})} />
                    </div>

                    {/* SECTION: ASSURANCE */}
                    <div className="space-y-4 pt-2">
                        <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-200/50">
                            <h4 className="flex items-center text-xs font-black uppercase tracking-widest text-slate-400 gap-2">
                                <FileText size={14} /> Couverture / Assurance
                            </h4>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold uppercase text-slate-500">Patient Payant</span>
                                <button type="button" onClick={() => setFormData({...formData, isPayant: !formData.isPayant, insuranceOrgId: ''})} className={`w-8 h-4 rounded-full transition-colors relative ${formData.isPayant ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                                    <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${formData.isPayant ? 'translate-x-4' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        </div>

                        {!formData.isPayant && (
                            <div className="space-y-4 animate-in fade-in duration-300">
                                <VertSelect label="Organisme" options={organismes.map(o => ({ value: o.id, label: o.designation || o.name }))} value={formData.insuranceOrgId} onChange={(v: string) => setFormData({...formData, insuranceOrgId: v})} />
                                <VertInput label="Numéro Immatriculation / Police" value={formData.policyNumber} onChange={(v: string)=>setFormData({...formData, policyNumber: v})} />
                                <VertSelect label="Lien avec l'assuré" options={[
                                    {value: 'SELF', label: 'Lui-même (Assuré Principal)'},
                                    {value: 'SPOUSE', label: 'Conjoint(e)'},
                                    {value: 'CHILD', label: 'Enfant'},
                                    {value: 'OTHER', label: 'Autre'}
                                ]} value={formData.insuranceSubscriberRelationship} onChange={(v: string)=>setFormData({...formData, insuranceSubscriberRelationship: v})} />
                                
                                {formData.insuranceSubscriberRelationship !== 'SELF' && (
                                    <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
                                        <div className="text-[10px] font-bold uppercase text-slate-500 mb-2 flex items-center gap-2"><User size={12}/> Détails de l'Assuré</div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <VertInput label="Prénom" value={formData.subscriberFirstName} onChange={(v:string)=>setFormData({...formData, subscriberFirstName: v})} required />
                                            <VertInput label="Nom" value={formData.subscriberLastName} onChange={(v:string)=>setFormData({...formData, subscriberLastName: v})} required />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                </div>
            </div>

            {/* FOOTER */}
            <div className="p-4 bg-white border-t border-slate-200 z-10 shrink-0">
                <button 
                    onClick={handleSubmit}
                    disabled={isSubmitting || (!isUnknown && (!formData.firstName || !formData.lastName))}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-black transition-colors shadow-lg shadow-emerald-600/20 uppercase tracking-wide flex items-center justify-center gap-2 disabled:opacity-50 disabled:bg-slate-300 disabled:shadow-none"
                >
                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                    {selectedExistingPatientId ? 'Valider et Associer' : 'Créer et Admettre'}
                </button>
            </div>

            {/* GLOBAL LOADER */}
            {isLoadingAdmissions && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
                    <Loader2 size={32} className="animate-spin text-emerald-600 mb-2" />
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Traitement...</span>
                </div>
            )}
        </div>
    );
};
