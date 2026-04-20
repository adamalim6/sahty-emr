
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MOCK_PATIENTS, calculateAge, generateIPP } from '../../constants';
import { useWorkspace } from '../../context/WorkspaceContext';
import { api } from '../../services/api';
import toast from 'react-hot-toast';
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

import { PatientIdentityForm } from '../PatientIdentityForm';

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
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [editPanelTab, setEditPanelTab] = useState<'edit' | 'history'>('edit');
  const [changeHistory, setChangeHistory] = useState<any[]>([]);

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
        // Kick off the list (kept for dropdowns / cross-patient lookups) in parallel with
        // the detail fetch, but rely on getPatient for this patient's full state —
        // the list endpoint returns coverages: [] by design.
        const [patients, detail] = await Promise.all([
          api.getPatients().catch(() => [] as any[]),
          api.getPatient(id as string).catch(() => null),
        ]);
        setAllPatients(patients);

        if (detail) {
          setPatient(detail as any);
        } else {
          const found = (patients as any[]).find(p => p.id === id);
          if (found) {
            setPatient(found);
          } else {
            const mockFound = MOCK_PATIENTS.find(p => p.id === id);
            setPatient(mockFound);
          }
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

  const handleOpenEdit = () => { setShowEditPanel(true); setEditPanelTab('edit'); };

  const loadChangeHistory = async () => {
    if (!patient?.id) return;
    try {
      const data = await api.getPatientChangeHistory(patient.id);
      setChangeHistory(data);
    } catch (e) { console.error(e); }
  };

  const FIELD_LABELS: Record<string, string> = {
    first_name: 'Prénom', last_name: 'Nom', dob: 'Date de naissance', sex: 'Sexe',
    'identity_ids.CIN': 'CIN', 'identity_ids.PASSPORT': 'Passeport', 'identity_ids.SEJOUR': 'Carte de séjour',
  };

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
    { id: 'Electro', label: 'Electro & Echo', icon: Activity, component: <ElectroEcho patientId={patient.id} /> },
    { id: 'Transfusions', label: 'Transfusions', icon: Droplet, component: <Transfusions /> },
    { id: 'Interventions', label: 'Interventions', icon: Scissors, component: <Interventions /> },
    { id: 'Admissions', label: 'Admissions', icon: Bed, component: <Admissions patientId={patient.id} /> },
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
                  <button onClick={() => { navigator.clipboard.writeText(patient.ipp); toast.success('IPP copié'); }} title="Cliquer pour copier" className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 border border-slate-200 hover:bg-slate-200 hover:text-slate-700 transition-colors cursor-pointer">IPP: {patient.ipp}</button>
                  <span className="flex items-center"><Calendar size={14} className="mr-1 text-gray-400" />{calculateAge(patient.dateOfBirth)} ans{patient.dateOfBirth ? ` (${new Date(patient.dateOfBirth).toLocaleDateString('fr-FR')})` : ''}</span>
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
                      onClick={() => { setActiveTab(tab.id); setShowEditPanel(false); }}
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

        {/* RIGHT DRAWER: Patient Edit — overlays tab content */}
        {showEditPanel && (
          <div className="absolute top-0 right-0 bottom-0 w-[85%] z-30 bg-white flex flex-col shadow-2xl border-l border-slate-200 animate-in slide-in-from-right duration-200">
            {/* Drawer header with tabs */}
            <div className="bg-slate-50 border-b border-slate-200 shrink-0">
              <div className="px-4 py-2 flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">{patient.lastName} {patient.firstName}</span>
                <button onClick={() => setShowEditPanel(false)} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"><X size={16} /></button>
              </div>
              <div className="flex px-4 gap-1">
                <button onClick={() => setEditPanelTab('edit')}
                  className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide border-b-2 transition-colors ${editPanelTab === 'edit' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                  <Pencil size={12} className="inline mr-1.5 -mt-0.5" />Modifier
                </button>
                <button onClick={() => { setEditPanelTab('history'); loadChangeHistory(); }}
                  className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide border-b-2 transition-colors ${editPanelTab === 'history' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                  <History size={12} className="inline mr-1.5 -mt-0.5" />Historique
                </button>
              </div>
            </div>

            {/* Drawer content */}
            {editPanelTab === 'edit' ? (
              <PatientIdentityForm
                initialData={patient}
                defaultStatus={patient.identityStatus || 'PROVISIONAL'}
                hideSearch
                onSubmit={async (patientId) => {
                  try {
                    const updated = await api.getPatient(patientId);
                    setPatient(updated);
                    setShowEditPanel(false);
                  } catch (e) { console.error(e); }
                }}
                onCancel={() => setShowEditPanel(false)}
              />
            ) : (
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {changeHistory.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <History size={28} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Aucune modification enregistrée</p>
                  </div>
                ) : changeHistory.map((c: any, i: number) => (
                  <div key={i} className="bg-slate-50 rounded-lg border border-slate-200 p-3 flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-slate-700">{FIELD_LABELS[c.field_path] || c.field_path}</span>
                        <span className="text-[10px] text-slate-400">{new Date(c.changed_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                        {c.changed_by_name && <span className="text-[10px] text-slate-400">par {c.changed_by_name}</span>}
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${c.change_source === 'USER_EDIT' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>{c.change_source}</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-600">
                        {c.old_value && <span className="line-through text-red-400 mr-2">{c.old_value}</span>}
                        {c.new_value && <span className="text-emerald-600 font-medium">{c.new_value}</span>}
                        {!c.old_value && !c.new_value && <span className="text-slate-300 italic">-</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
};
