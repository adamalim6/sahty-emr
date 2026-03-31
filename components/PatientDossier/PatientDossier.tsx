
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MOCK_PATIENTS, calculateAge, generateIPP } from '../../constants';
import { useWorkspace } from '../../context/WorkspaceContext';
import { api } from '../../services/api';
import { Gender, Patient } from '../../types';
import {
  ArrowLeft,
  User,
  Route,
  History,
  Archive,
  Stethoscope,
  Pill,
  Microscope,
  FileText,
  ClipboardCheck,
  Compass,
  TrendingUp,
  FilePenLine,
  HeartPulse,
  Activity,
  Droplet,
  Scissors,
  Syringe,
  MessageSquare,
  Bed,
  LogOut,
  ShieldAlert,
  Cigarette,
  FlaskConical,
  ScanLine,
  Pencil,
  X,
  CheckCircle2,
  Fingerprint,
  ShieldCheck,
  Calendar,
  Phone,
  Mail,
  Briefcase,
  IdCard,
  Building2,
  Globe,
  Flag,
  MapPin,
  CreditCard,
  Check,
  Plus,
  Trash2,
  Baby,
  Users,
  ChevronDown,
  Hash
} from 'lucide-react';

// Import Tabs
import { Antecedants } from './Antecedants';
import { ExamenClinique } from './ExamenClinique';
import { TraitementEnCours } from './TraitementEnCours';
import { Diagnostic } from './Diagnostic';
import { Prescriptions } from './Prescriptions';
import { FicheSurveillanceTab } from './FicheSurveillance';
import { ElectroEcho } from './ElectroEcho';
import { Transfusions } from './Transfusions';
import { Interventions } from './Interventions';
import { Observations, ObservationRecord } from './Observations';
import { Admissions } from './Admissions';
import { PrescriptionSortie } from './PrescriptionSortie';
import { Allergies } from './Allergies';
import { Addictologie } from './Addictologie';
import { Biologie } from './Biologie';
import { Imagerie } from './Imagerie';
import { Escarres } from './Escarres';
import { RightChartPanel, RightPanelTab } from './RightChartPanel';
// Removed UserTemplatesTab import

// --- Reusable UI Components (Redefined for the dossier) ---

const InputField = ({ label, value, onChange, placeholder, type = "text", required = false, disabled = false, icon: Icon }: any) => (
  <div className="flex flex-col space-y-1.5 w-full text-left">
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
  <div className="flex flex-col space-y-1.5 w-full text-left">
    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center">
      {label} {required && <span className="text-red-500 ml-1">*</span>}
    </label>
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
  <div className="flex flex-col space-y-1.5 w-full text-left">
    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Sexe <span className="text-red-500 ml-1">*</span></label>
    <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200">
      <button type="button" disabled={disabled} onClick={() => onChange(Gender.Male)} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${value === Gender.Male ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Homme</button>
      <button type="button" disabled={disabled} onClick={() => onChange(Gender.Female)} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${value === Gender.Female ? 'bg-white text-pink-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Femme</button>
    </div>
  </div>
);

const CardSection = ({ title, icon: Icon, children, colorClass = "text-emerald-600", bgClass = "bg-emerald-50", action }: any) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-left">
    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
      <div className="flex items-center space-x-3">
        <div className={`p-2 rounded-lg ${bgClass} ${colorClass}`}><Icon size={18} /></div>
        <h4 className="font-bold text-slate-800 text-sm uppercase tracking-tight">{title}</h4>
      </div>
      {action && <div>{action}</div>}
    </div>
    <div className="p-6">{children}</div>
  </div>
);

interface PatientDossierProps {
  patientId: string;
  workspaceId: string;
  isActiveWorkspace: boolean;
}

export const PatientDossier: React.FC<PatientDossierProps> = ({ patientId, workspaceId, isActiveWorkspace }) => {
  const navigate = useNavigate();
  const id = patientId;

  const [patient, setPatient] = useState<Patient | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [allPatients, setAllPatients] = useState<Patient[]>([]);

  const [activeTab, setActiveTab] = useState<string>('Antecedants');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Patient>>({});

  const { updateWorkspaceLabel, sidebarState, setSidebarState, openUtilityTab } = useWorkspace();

  const DEFAULT_PANEL_WIDTH = 420;
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [activeRightPanelTab, setActiveRightPanelTab] = useState<RightPanelTab | null>(null);
  const [rightPanelWidth, setRightPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const [panelDraftState, setPanelDraftState] = useState<any>({});

  // Hosted Observation Editor State
  const [obsEditorMode, setObsEditorMode] = useState<'CREATE' | 'EDIT' | 'VIEW' | 'ADDENDUM'>('CREATE');
  const [activeObsNote, setActiveObsNote] = useState<Partial<ObservationRecord> | null>(null);
  const [obsParentNote, setObsParentNote] = useState<ObservationRecord | null>(null);
  const [isSavingObs, setIsSavingObs] = useState(false);
  const [refreshObsTrigger, setRefreshObsTrigger] = useState(0);

  const openObservationEditor = (config: {
    mode: 'CREATE' | 'EDIT' | 'VIEW' | 'ADDENDUM';
    note?: Partial<ObservationRecord>;
    parentNote?: ObservationRecord;
  }) => {
    setActiveRightPanelTab('obs');
    setIsRightPanelOpen(true);
    setSidebarState('collapsed');

    // Phase 4.1: If there is an active draft (CREATE/EDIT/ADDENDUM)
    const hasActiveDraft = activeObsNote && obsEditorMode !== 'VIEW';

    if (config.mode === 'CREATE') {
      if (hasActiveDraft) {
        // If an observation draft already exists -> reopen the editor with the existing draft
        return;
      }
      
      setObsEditorMode('CREATE');
      setActiveObsNote({
        note_type: 'GENERAL',
        privacy_level: 'NORMAL',
        status: 'DRAFT',
        body_html: '<p></p>',
        declared_time: new Date().toISOString(),
      });
      setObsParentNote(null);
    } else if (config.mode === 'ADDENDUM' && config.parentNote) {
      if (hasActiveDraft) {
         if (!window.confirm("Vous avez un brouillon en cours. Remplacer par un addendum ? Ce brouillon sera perdu.")) return;
      }
      setObsEditorMode(config.mode);
      setObsParentNote(config.parentNote);
      setActiveObsNote({
        note_type: config.parentNote.note_type,
        privacy_level: config.parentNote.privacy_level,
        body_html: '<p></p>',
        declared_time: new Date().toISOString(),
      });
    } else if (config.note) {
      if (config.mode !== 'VIEW' && hasActiveDraft) {
         if (!window.confirm("Vous avez un brouillon en cours. Ouvrir ce brouillon à la place ? Le brouillon actuel sera défaussé.")) return;
      }
      if (config.mode === 'VIEW' && hasActiveDraft) {
         if (!window.confirm("Vous avez une observation en cours de rédaction. Quitter pour visualiser cette note ? Le texte tapé non sauvegardé sera perdu.")) return;
      }
      setObsEditorMode(config.mode);
      setActiveObsNote({ ...config.note });
      setObsParentNote(null);
    }
  };

  const handleDiscardObsDraft = () => {
    setActiveObsNote(null);
    setObsParentNote(null);
    setIsRightPanelOpen(false);
  };

  useEffect(() => {
    if (sidebarState === 'expanded' && isRightPanelOpen) {
      setIsRightPanelOpen(false);
    }
  }, [sidebarState, isRightPanelOpen]);

  useEffect(() => {
    if (patient) {
      updateWorkspaceLabel(workspaceId, `${patient.lastName.toUpperCase()} ${patient.firstName}`);
    }
  }, [patient, workspaceId, updateWorkspaceLabel]);

  useEffect(() => {
    const fetchPatientData = async () => {
      setIsLoading(true);
      try {
        const patients = await api.getPatients();
        setAllPatients(patients);
        const found = patients.find(p => p.id === id);

        if (found) {
          setPatient(found);
        } else {
          const mockFound = MOCK_PATIENTS.find(p => p.id === id);
          setPatient(mockFound);
        }
      } catch (error) {
        console.error("Failed to fetch patient:", error);
        const mockFound = MOCK_PATIENTS.find(p => p.id === id);
        setPatient(mockFound);
      } finally {
        setIsLoading(false);
      }
    };

    if (id) fetchPatientData();
  }, [id]);

  // Helper pour filtrer les numéros de téléphone
  const formatPhoneNumber = (val: string) => val.replace(/[^0-9+]/g, '');

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen text-slate-500">Chargement...</div>;
  }

  if (!patient) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-bold text-gray-700">Patient introuvable</h2>
        <button onClick={() => navigate('/')} className="mt-4 text-emerald-600 hover:underline">Retour à la liste</button>
      </div>
    );
  }

  const isFemale = patient.gender === Gender.Female;

  const handleOpenEdit = () => {
    setFormData({
      ...patient,
      insurance: patient.insurance || { mainOrg: '', relationship: 'Lui-même', registrationNumber: '' },
      emergencyContacts: (patient.emergencyContacts && patient.emergencyContacts.length > 0) ? patient.emergencyContacts : [{ name: '', relationship: 'Père', phone: '' }],
      guardian: patient.guardian || { firstName: '', lastName: '', phone: '', relationship: 'Père', idType: 'CIN', idNumber: '', address: '', habilitation: '' }
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = () => {
    if (!formData.firstName || !formData.lastName || !formData.dateOfBirth) {
      alert("Veuillez remplir les champs obligatoires (Nom, Prénom, Date de naissance)");
      return;
    }

    // --- CHECK FOR DUPLICATE CIN/ID (Excluding current patient) ---
    if (formData.cin) {
      const duplicate = allPatients.find(p =>
        p.id !== patient.id &&
        p.cin?.toLowerCase() === formData.cin?.toLowerCase()
      );

      if (duplicate) {
        alert(`ERREUR : Ce numéro de pièce d'identité (${formData.cin}) est déjà attribué au patient ${duplicate.lastName} ${duplicate.firstName} (IPP: ${duplicate.ipp}). Modification bloquée.`);
        return;
      }
    }

    setPatient({ ...patient, ...formData as Patient });
    setIsEditModalOpen(false);
  };

  const handleInsuranceChange = (field: string, value: string) => {
    const finalValue = field === 'registrationNumber' ? formatPhoneNumber(value) : value;
    setFormData(prev => ({
      ...prev,
      insurance: { ...(prev.insurance || { mainOrg: '', relationship: 'Lui-même' }), [field]: finalValue }
    }));
  };

  const handleGuardianChange = (field: string, value: string) => {
    const finalValue = field === 'phone' ? formatPhoneNumber(value) : value;
    setFormData(prev => ({
      ...prev,
      guardian: { ...(prev.guardian || { firstName: '', lastName: '', phone: '', relationship: 'Père', idType: 'CIN', idNumber: '', address: '', habilitation: '' }), [field]: finalValue }
    }));
  };

  const handleEmergencyChange = (index: number, field: string, value: string) => {
    const contacts = [...(formData.emergencyContacts || [])];
    const finalValue = field === 'phone' ? formatPhoneNumber(value) : value;
    contacts[index] = { ...contacts[index], [field]: finalValue };
    setFormData({ ...formData, emergencyContacts: contacts });
  };

  const isMinor = formData.dateOfBirth ? calculateAge(formData.dateOfBirth) < 18 : false;

  const tabs = [
    { id: 'Antecedants', label: 'Antécédants', icon: Archive, component: <Antecedants /> },
    { id: 'Examen', label: 'Examen Clinique', icon: Stethoscope, component: <ExamenClinique patient={patient} /> },
    { id: 'Traitement', label: 'Traitement en cours', icon: Pill, component: <TraitementEnCours /> },
    { id: 'Allergies', label: 'Allergies', icon: ShieldAlert, component: <Allergies patientId={patient.id} /> },
    { id: 'Addictologie', label: 'Addictologie', icon: Cigarette, component: <Addictologie /> },
    { id: 'Biologie', label: 'Biologie', icon: FlaskConical, component: <Biologie tenantPatientId={patient.id} /> },
    { id: 'Imagerie', label: 'Imagerie', icon: ScanLine, component: <Imagerie /> },
    { id: 'Diagnostic', label: 'Diagnostic', icon: Microscope, component: <Diagnostic patientId={patient.id} /> },
    { id: 'Prescriptions', label: 'Prescriptions', icon: FileText, component: <Prescriptions patientId={patient.id} /> },
    { id: 'Surveillance', label: 'Fiche de Surveillance', icon: ClipboardCheck, component: <FicheSurveillanceTab patientId={patient.id} /> },
    { id: 'Escarres', label: 'Escarres', icon: Activity, component: <Escarres patientId={patient.id} sex={patient.gender} /> },
    { id: 'PrescriptionSortie', label: 'Prescription Externe', icon: LogOut, component: <PrescriptionSortie /> },
    { id: 'Observations', label: 'Observations', icon: FilePenLine, component: <Observations patientId={patient.id} /> },
    { id: 'Electro', label: 'Electro & Echo', icon: Activity, component: <ElectroEcho /> },
    { id: 'Transfusions', label: 'Transfusions', icon: Droplet, component: <Transfusions /> },
    { id: 'Interventions', label: 'Interventions', icon: Scissors, component: <Interventions /> },
    { id: 'Admissions', label: 'Admissions', icon: Bed, component: <Admissions /> },
  ];

  return (
    <div className="absolute inset-x-0 bottom-0 top-0 flex flex-col bg-gray-50 overflow-hidden">
      {/* Fixed Top Section: Header + Tabs */}
      <div className="flex flex-col shrink-0 w-full z-20 bg-white shadow-sm ring-1 ring-gray-200">
        
        {/* Compact Patient Banner */}
        <div className="px-6 lg:px-10 h-14 w-full flex items-center space-x-4 border-b border-gray-100">
            
            {/* Avatar Cliquable */}
            <button
              onClick={handleOpenEdit}
              title="Modifier les informations patient"
              className={`group relative h-10 w-10 rounded-lg flex items-center justify-center shrink-0 overflow-hidden border-2 transition-all active:scale-95 ${isFemale ? 'bg-pink-50 text-pink-600 border-pink-100 hover:border-pink-500' : 'bg-blue-50 text-blue-600 border-blue-100 hover:border-blue-500'}`}
            >
              <User size={20} className="group-hover:opacity-20 transition-opacity" />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/5">
                <Pencil size={14} className={isFemale ? 'text-pink-600' : 'text-blue-600'} />
              </div>
            </button>

            <div className="flex-1 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <h1 className="text-sm font-black text-gray-900 tracking-tight truncate max-w-[200px]">{patient.lastName.toUpperCase()} {patient.firstName}</h1>
                  <button onClick={handleOpenEdit} className="p-1 text-gray-300 hover:text-indigo-600 transition-colors"><Pencil size={12} /></button>
                </div>
                
                <div className="h-4 w-px bg-gray-300"></div>

                <div className="flex items-center space-x-4 text-[12px] text-gray-600 font-medium whitespace-nowrap overflow-hidden">
                  <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 border border-slate-200">IPP: {patient.ipp}</span>
                  <span className="flex items-center"><Calendar size={14} className="mr-1 text-gray-400" />{calculateAge(patient.dateOfBirth)} ans</span>
                  <span className="flex items-center"><Activity size={14} className="mr-1 text-gray-400" />{patient.gender}</span>
                  {patient.cin && <span className="flex items-center"><IdCard size={14} className="mr-1 text-gray-400" />{patient.cin}</span>}
                </div>
              </div>
            </div>
        </div>

        {/* Navigation Tabs */}
        <div className="w-full flex items-center border-b border-gray-200 bg-white">
          <div className="flex-1 overflow-x-auto whitespace-nowrap scrollbar-none">
              <div className="flex w-max pl-6 lg:pl-10 pr-4 space-x-8">
                {tabs.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`
                        flex items-center whitespace-nowrap py-3.5 border-b-2 font-black uppercase text-[11px] tracking-widest transition-all duration-200 group
                        ${isActive
                          ? 'border-emerald-500 text-emerald-700'
                          : 'border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-300'}
                      `}
                    >
                      <Icon size={16} className={`mr-2 ${isActive ? 'text-emerald-500' : 'text-gray-300 group-hover:text-gray-500'}`} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Separator */}
            <div className="w-px bg-slate-200 h-6 mx-2 shrink-0"></div>

            {/* Right Panel Selectors */}
            <div className="shrink-0 flex items-center pr-6 lg:pr-10 pl-2 gap-1">
               <button
                  onClick={() => {
                    if (isRightPanelOpen && activeRightPanelTab === 'obs') {
                      setIsRightPanelOpen(false);
                    } else {
                      setIsRightPanelOpen(true);
                      setActiveRightPanelTab('obs');
                      setSidebarState('collapsed');

                      const hasActiveDraft = activeObsNote && obsEditorMode !== 'VIEW';
                      if (!hasActiveDraft) {
                        setObsEditorMode('CREATE');
                        setActiveObsNote({
                          note_type: 'GENERAL',
                          privacy_level: 'NORMAL',
                          status: 'DRAFT',
                          body_html: '<p></p>',
                          declared_time: new Date().toISOString(),
                        });
                        setObsParentNote(null);
                      }
                    }
                  }}
                  className={`px-3 py-1 text-[11px] font-black uppercase tracking-widest rounded-md transition-colors ${isRightPanelOpen && activeRightPanelTab === 'obs' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-100 border border-slate-200 hover:border-slate-300'}`}
                >
                  OBS
                </button>
               <button
                  onClick={() => {
                    if (isRightPanelOpen && activeRightPanelTab === 'presc') {
                      setIsRightPanelOpen(false);
                    } else {
                      setIsRightPanelOpen(true);
                      setActiveRightPanelTab('presc');
                      setSidebarState('collapsed');
                    }
                  }}
                  className={`px-3 py-1 text-[11px] font-black uppercase tracking-widest rounded-md transition-colors ${isRightPanelOpen && activeRightPanelTab === 'presc' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-100 border border-slate-200 hover:border-slate-300'}`}
                >
                  PRESC
                </button>
               <button
                  onClick={() => {
                    if (isRightPanelOpen && activeRightPanelTab === 'diag') {
                      setIsRightPanelOpen(false);
                    } else {
                      setIsRightPanelOpen(true);
                      setActiveRightPanelTab('diag');
                      setSidebarState('collapsed');
                    }
                  }}
                  className={`px-3 py-1 text-[11px] font-black uppercase tracking-widest rounded-md transition-colors ${isRightPanelOpen && activeRightPanelTab === 'diag' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-100 border border-slate-200 hover:border-slate-300'}`}
                >
                  DIAG
                </button>
            </div>
          </div>
      </div>

      {/* Scrollable Tab Content & Right Panel - Keep-Alive Rendering */}
      <div className="flex-1 flex flex-row min-h-0 min-w-0 w-full overflow-hidden relative bg-gray-50">
        
        {/* Main Chart Content */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 relative overflow-hidden transition-all duration-300">
          {tabs.map(tab => {
            const isHeavyFlex = tab.id === 'Surveillance' || tab.id === 'Observations';
            const isCurrentTab = activeTab === tab.id;
            
            // Pass the editor helpers to the Observations component specifically
            const childProps: any = {
              isActiveWorkspace,
              isActiveTab: isCurrentTab
            };
            if (tab.id === 'Observations') {
              childProps.openObservationEditor = openObservationEditor;
              childProps.refreshTrigger = refreshObsTrigger;
            }

            return (
              <div
                key={tab.id}
                className={`absolute inset-0 flex flex-col ${isHeavyFlex ? 'overflow-hidden' : 'overflow-y-auto'}`}
                style={{ display: isCurrentTab ? 'flex' : 'none' }}
              >
                <div className={`w-full px-6 lg:px-10 pb-6 lg:pb-10 pt-6 ${isHeavyFlex ? 'flex-1 flex flex-col min-h-0' : 'py-6'}`}>
                  <div className={`w-full ${isHeavyFlex ? 'flex-1 flex flex-col min-h-0 relative' : ''}`}>
                    {React.cloneElement(tab.component as React.ReactElement<any>, childProps)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Sticky Right Chart Panel */}
        <RightChartPanel 
          isOpen={isRightPanelOpen}
          width={rightPanelWidth}
          activeTab={activeRightPanelTab}
          onClose={() => setIsRightPanelOpen(false)}
          setWidth={setRightPanelWidth}
          patientId={patient?.id || ''}
          obsEditorMode={obsEditorMode}
          activeObsNote={activeObsNote}
          obsParentNote={obsParentNote}
          isSavingObs={isSavingObs}
          setActiveObsNote={setActiveObsNote}
          setIsSavingObs={setIsSavingObs}
          onObsDiscard={handleDiscardObsDraft}
          onObsSaveSuccess={() => {
             setIsSavingObs(false);
             setIsRightPanelOpen(false);
             setRefreshObsTrigger(prev => prev + 1);
             setActiveObsNote(null);
          }}
          onOpenSmartPhrases={(payload?: any) => {
             setIsRightPanelOpen(false);
             openUtilityTab('ws-utility-templates', 'Mes Modèles', '/templates', payload);
          }}
        />
      </div>

      {/* --- EDIT PATIENT MODAL --- */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col w-full max-w-6xl h-[92vh] animate-in zoom-in-95 duration-300">

            <div className="px-8 py-6 flex justify-between items-center text-white relative overflow-hidden bg-gradient-to-r from-indigo-700 to-indigo-800">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
              <div className="flex items-center space-x-5 relative z-10">
                <div className="p-3.5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 shadow-inner">
                  <ShieldCheck size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-black tracking-tight leading-tight uppercase">Modification Dossier Patient</h3>
                  <div className="flex items-center mt-1 space-x-3">
                    <div className="flex items-center space-x-1.5 bg-white/20 px-2.5 py-1 rounded-lg border border-white/10 backdrop-blur-sm">
                      <Fingerprint size={12} className="text-white/60" />
                      <span className="text-[11px] font-black uppercase tracking-widest text-white">IPP: {formData.ipp}</span>
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="p-3 hover:bg-white/10 rounded-2xl transition-all border border-transparent hover:border-white/10 active:scale-95"><X size={26} /></button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50/50 p-8 space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <CardSection title="1. Informations Patient" icon={User}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <InputField label="IPP (Auto-généré)" disabled value={formData.ipp} icon={Fingerprint} />
                    <GenderToggle value={formData.gender as Gender} onChange={(g) => setFormData({ ...formData, gender: g })} />
                    <InputField label="Nom" required value={formData.lastName} onChange={(e: any) => setFormData({ ...formData, lastName: e.target.value.toUpperCase() })} />
                    <InputField label="Prénom" required value={formData.firstName} onChange={(e: any) => setFormData({ ...formData, firstName: e.target.value })} />
                    <InputField label="Date de Naissance" required type="date" value={formData.dateOfBirth} onChange={(e: any) => setFormData({ ...formData, dateOfBirth: e.target.value })} icon={Calendar} />
                    <InputField label="Numéro de Téléphone" value={formData.phone} onChange={(e: any) => setFormData({ ...formData, phone: formatPhoneNumber(e.target.value) })} icon={Phone} />
                    <div className="sm:col-span-2"><InputField label="Adresse E-mail" value={formData.email} onChange={(e: any) => setFormData({ ...formData, email: e.target.value })} icon={Mail} /></div>
                    <div className="grid grid-cols-2 gap-5 sm:col-span-2">
                      <SelectField label="Nature Identité" options={["CIN", "Passeport", "Carte de séjour"]} value="CIN" required />
                      <InputField label="N° Pièce Identité" required value={formData.cin} onChange={(e: any) => setFormData({ ...formData, cin: e.target.value })} placeholder="Ex: AB123456" />
                    </div>
                    <InputField label="Profession" value={formData.profession} onChange={(e: any) => setFormData({ ...formData, profession: e.target.value })} icon={Briefcase} />
                    <div className="flex flex-col space-y-1.5 text-left">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Groupe Sanguin</label>
                      <select value={formData.bloodGroup} onChange={(e: any) => setFormData({ ...formData, bloodGroup: e.target.value })} className="bg-white border border-slate-200 rounded-xl py-2.5 px-4 text-sm font-bold text-red-600 outline-none focus:ring-4 focus:ring-emerald-500/10">
                        <option value="">Inconnu</option>
                        <option>A+</option><option>A-</option><option>B+</option><option>B-</option>
                        <option>AB+</option><option>AB-</option><option>O+</option><option>O-</option>
                      </select>
                    </div>
                  </div>
                </CardSection>

                <div className="space-y-8">
                  <CardSection title="2. Contacts d'urgence" icon={Users} colorClass="text-indigo-600" bgClass="bg-indigo-50" action={<button onClick={() => setFormData({ ...formData, emergencyContacts: [...(formData.emergencyContacts || []), { name: '', relationship: 'Ami(e)', phone: '' }] })} className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-xs font-bold">+ Ajouter</button>}>
                    <div className="space-y-6">
                      {formData.emergencyContacts?.map((contact, index) => (
                        <div key={index} className="p-4 bg-slate-50 border border-slate-200 rounded-xl relative">
                          <div className="flex justify-between items-center mb-4">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white px-2 py-0.5 rounded">Contact #{index + 1}</span>
                            {/* SÉCURITÉ : Empêcher la suppression du dernier contact d'urgence */}
                            {formData.emergencyContacts!.length > 1 && (
                              <button onClick={() => setFormData({ ...formData, emergencyContacts: formData.emergencyContacts?.filter((_, idx) => idx !== index) })} className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 gap-4">
                            <InputField label="Nom complet" value={contact.name} onChange={(e: any) => handleEmergencyChange(index, 'name', e.target.value)} />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <SelectField label="Relation" options={['Père', 'Mère', 'Frère', 'Soeur', 'Ami(e)', 'Conjoint']} value={contact.relationship} onChange={(e: any) => handleEmergencyChange(index, 'relationship', e.target.value)} />
                              <InputField label="Tél" value={contact.phone} onChange={(e: any) => handleEmergencyChange(index, 'phone', e.target.value)} icon={Phone} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardSection>

                  {isMinor && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
                      <div className="flex items-center space-x-3 mb-5">
                        <div className="p-2 bg-amber-500 text-white rounded-lg"><Baby size={20} /></div>
                        <h4 className="font-bold text-amber-900 text-sm uppercase tracking-tight text-left">3. Tuteur Légal (Patient Mineur)</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <InputField label="Nom" required value={formData.guardian?.lastName} onChange={(e: any) => handleGuardianChange('lastName', e.target.value.toUpperCase())} />
                        <InputField label="Prénom" required value={formData.guardian?.firstName} onChange={(e: any) => handleGuardianChange('firstName', e.target.value)} />
                        <SelectField label="Lien de parenté" required options={['Père', 'Mère', 'Oncle', 'Frère', 'Soeur', 'Tuteur légal']} value={formData.guardian?.relationship} onChange={(e: any) => handleGuardianChange('relationship', e.target.value)} />
                        <InputField label="Téléphone" icon={Phone} value={formData.guardian?.phone} onChange={(e: any) => handleGuardianChange('phone', formatPhoneNumber(e.target.value))} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <CardSection title="4. Localisation & Nationalité" icon={MapPin} colorClass="text-blue-600" bgClass="bg-blue-50">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
                  <SelectField label="Pays" required options={['Maroc', 'France', 'Espagne', 'Sénégal', 'USA']} value={formData.country} onChange={(e: any) => setFormData({ ...formData, country: e.target.value })} icon={Globe} />
                  <InputField label="Ville" required value={formData.city} onChange={(e: any) => setFormData({ ...formData, city: e.target.value })} icon={MapPin} />
                  <InputField label="Code Postal" value={formData.zipCode} onChange={(e: any) => setFormData({ ...formData, zipCode: e.target.value })} />
                  <SelectField label="Nationalité" required options={['Marocaine', 'Française', 'Espagnole', 'Sénégalaise']} value={formData.nationality} onChange={(e: any) => setFormData({ ...formData, nationality: e.target.value })} icon={Flag} />
                  <div className="sm:col-span-4"><InputField label="Adresse Actuelle" required value={formData.address} onChange={(e: any) => setFormData({ ...formData, address: e.target.value })} icon={MapPin} /></div>
                </div>
              </CardSection>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-left">
                <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
                  <div className="flex items-center space-x-3"><div className="p-2 bg-violet-50 text-violet-600 rounded-lg"><CreditCard size={18} /></div><h4 className="font-bold text-slate-800 text-sm uppercase tracking-tight">5. Informations Assurance</h4></div>
                  <label onClick={() => setFormData({ ...formData, isPayant: !formData.isPayant })} className={`flex items-center justify-between sm:justify-start space-x-4 cursor-pointer px-4 py-2 rounded-xl border transition-all ${formData.isPayant ? 'bg-emerald-50 border-emerald-500 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${formData.isPayant ? 'text-emerald-700' : 'text-slate-500'}`}>Patient Payant (Direct)</span>
                    <div className={`w-6 h-6 rounded-lg border-2 transition-all flex items-center justify-center ${formData.isPayant ? 'bg-white border-emerald-500 text-emerald-600' : 'bg-white border-slate-300 text-transparent'}`}><Check size={16} strokeWidth={4} /></div>
                  </label>
                </div>
                <div className={`p-6 transition-opacity duration-300 ${formData.isPayant ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                  {!formData.isPayant ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                      <SelectField label="Organisme Principal" options={['CNSS', 'CNOPS', 'AXA', 'WAFA', 'CIMR']} value={formData.insurance?.mainOrg} onChange={(e: any) => handleInsuranceChange('mainOrg', e.target.value)} required icon={Building2} />
                      <div className="grid grid-cols-2 gap-4">
                        <SelectField label="Lien Assuré" options={['Lui-même', 'Conjoint', 'Enfant', 'Père', 'Mère']} value={formData.insurance?.relationship} onChange={(e: any) => handleInsuranceChange('relationship', e.target.value)} required />
                        <InputField label="N° Immatriculation" value={formData.insurance?.registrationNumber} onChange={(e: any) => handleInsuranceChange('registrationNumber', e.target.value)} placeholder="N° Matricule..." icon={Hash} />
                      </div>
                    </div>
                  ) : <div className="flex flex-col items-center justify-center py-6 text-slate-400"><ShieldCheck size={32} className="mb-2 opacity-20" /><p className="text-sm italic">Mode paiement direct activé.</p></div>}
                </div>
              </div>
            </div>

            <div className="px-8 py-5 bg-white border-t border-slate-100 flex justify-end items-center space-x-4">
              <button onClick={() => setIsEditModalOpen(false)} className="px-6 py-2.5 text-slate-400 font-bold hover:text-slate-600 uppercase text-xs tracking-widest">Annuler</button>
              <button onClick={handleSaveEdit} className="px-10 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-xs tracking-[0.2em] hover:bg-indigo-700 shadow-xl shadow-indigo-600/30 flex items-center active:scale-95 transition-all"><CheckCircle2 size={18} className="mr-3" /> Enregistrer les modifications</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
