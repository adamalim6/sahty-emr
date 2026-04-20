
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MOCK_PATIENTS, calculateAge } from '../../constants';
import {
  ArrowLeft,
  Activity,
  User,
  Building2,
  Bed,
  Calendar,
  Clock,
  Hash,
  ShieldCheck,
  LayoutDashboard,
  ClipboardList,
  Pill,
  FileText,
  FileSignature,
  Wallet,
  ShieldAlert,
  ArrowLeftRight,
  X,
  CheckCircle
} from 'lucide-react';

import { Dashboard } from './Dashboard';
import { Actes } from './Actes';
import { Pharmacie } from './Pharmacie';
import { Factures } from './Factures';
import { Devis } from './Devis';
import { Reglement } from './Reglement';
import { PEC } from './PEC';
import { Remboursement } from './Remboursement';
import { api } from '../../services/api';
import { Admission } from '../../types';

export const AdmissionDossier: React.FC<{ mode?: 'emr' | 'lims' }> = ({ mode = 'emr' }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [admission, setAdmission] = useState<Admission | null>(null);
  const [patient, setPatient] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState(mode === 'lims' ? 'Actes' : 'Dashboard');
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const admissions = mode === 'lims' ? await api.limsConfig.execution.getAdmissions() : await api.getAdmissions();
        const foundAdmission = admissions.find((a: any) => a.id === id);

        if (foundAdmission) {
          setAdmission(foundAdmission);

          // Load patient data from API
          let foundPatient = null;
          if (mode === 'lims') {
             foundPatient = await api.limsConfig.execution.getPatient(foundAdmission.tenantPatientId || foundAdmission.patientId);
          } else {
             const patients = await api.getPatients();
             foundPatient = patients.find(p => p.id === (foundAdmission.tenantPatientId || foundAdmission.patientId));
          }
          setPatient(foundPatient || null);
        }
      } catch (error) {
        console.error("Failed to load admission data", error);
      }
    };

    loadData();
  }, [id]);

  // const patient = admission ? MOCK_PATIENTS.find(p => p.id === admission.patientId) : null; (REMOVED)

  const handleCloseAdmission = async () => {
    if (!admission || !id) return;

    setIsClosing(true);
    try {
      const updatedAdmission = mode === 'lims'
        ? await api.limsConfig.execution.closeAdmission(id)
        : await api.closeAdmission(id);
      setAdmission(updatedAdmission);
      setShowCloseModal(false);
    } catch (error) {
      console.error('Error closing admission:', error);
      alert('Erreur lors de la clôture de l\'admission');
    } finally {
      setIsClosing(false);
    }
  };

  if (!admission || !patient) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-bold text-gray-700">Admission introuvable</h2>
        <button onClick={() => navigate('/admissions')} className="mt-4 text-emerald-600 hover:underline">Retour aux admissions</button>
      </div>
    );
  }

  let tabs = [
    { id: 'Dashboard', label: 'Dashboard', icon: LayoutDashboard, component: <Dashboard /> },
    { id: 'Actes', label: 'Actes', icon: ClipboardList, component: <Actes admissionId={admission.id} /> },
    { id: 'Pharmacie', label: 'Pharmacie', icon: Pill, component: <Pharmacie admission={admission} /> },
    { id: 'Factures', label: 'Factures', icon: FileText, component: <Factures /> },
    { id: 'Devis', label: 'Devis', icon: FileSignature, component: <Devis /> },
    { id: 'Reglement', label: 'Règlement', icon: Wallet, component: <Reglement /> },
    { id: 'PEC', label: 'PEC', icon: ShieldAlert, component: <PEC /> },
    { id: 'Remboursement', label: 'Remboursement', icon: ArrowLeftRight, component: <Remboursement /> },
  ];

  if (mode === 'lims') {
    tabs = tabs.filter(t => !['Dashboard', 'Pharmacie'].includes(t.id));
  }

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] animate-in fade-in duration-300">
      {/* Back Link */}
      <button onClick={() => navigate(mode === 'lims' ? `/lims/patients/${admission.tenantPatientId || admission.patientId}` : '/admissions')} className="flex items-center text-gray-500 hover:text-gray-900 w-fit mb-4">
        <ArrowLeft size={18} className="mr-1" /> Retour
      </button>

      {/* Admission Banner */}
      <div className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-2xl flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-8 mb-6 border border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>

        {/* Patient Block */}
        <div className="flex items-center space-x-6 shrink-0 relative z-10">
          <div className="h-16 w-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400 border border-emerald-500/30">
            <User size={32} />
          </div>
          <div>
            <h4 className="text-xl font-black uppercase tracking-tight leading-none mb-1">{patient.lastName} {patient.firstName}</h4>
            <div className="flex items-center space-x-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5">IPP: {patient.ipp}</span>
              <span>•</span>
              <span>{calculateAge(patient.dateOfBirth)} ANS</span>
              <span>•</span>
              <span>{patient.gender}</span>
            </div>
          </div>
        </div>

        {/* Separator */}
        <div className="hidden md:block w-px h-12 bg-white/10 relative z-10"></div>

        {/* Admission Details */}
        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-6 relative z-10 w-full md:w-auto">
          <div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">NDA</span>
            <div className="flex items-center text-sm font-bold text-white"><Hash size={14} className="mr-1.5 text-indigo-400" /> {admission.nda}</div>
          </div>
          <div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Service / Unité</span>
            <div className="flex items-center text-sm font-bold text-white"><Building2 size={14} className="mr-1.5 text-indigo-400" /> {admission.service}</div>
          </div>
          <div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Chambre & Lit</span>
            <div className="flex items-center text-sm font-bold text-white"><Bed size={14} className="mr-1.5 text-indigo-400" /> {admission.roomNumber || 'N/A'} - {admission.bedLabel || 'N/A'}</div>
          </div>
          <div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Date d'admission</span>
            <div className="flex items-center text-sm font-bold text-white"><Calendar size={14} className="mr-1.5 text-indigo-400" /> {new Date(admission.admissionDate).toLocaleDateString('fr-FR')}</div>
          </div>
        </div>

        {/* Status Badge and Actions */}
        <div className="shrink-0 relative z-10 self-center md:self-auto flex flex-col items-center md:items-end gap-3">
          <div className={`px-4 py-2 rounded-2xl border flex items-center space-x-2 ${admission.status === 'En cours'
            ? 'bg-orange-500/10 border-orange-500/20'
            : admission.status === 'Sorti'
              ? 'bg-emerald-500/10 border-emerald-500/20'
              : 'bg-red-500/10 border-red-500/20'
            }`}>
            <ShieldCheck size={16} className={
              admission.status === 'En cours'
                ? 'text-orange-400'
                : admission.status === 'Sorti'
                  ? 'text-emerald-400'
                  : 'text-red-400'
            } />
            <span className={`text-[11px] font-black uppercase tracking-widest ${admission.status === 'En cours'
              ? 'text-orange-400'
              : admission.status === 'Sorti'
                ? 'text-emerald-400'
                : 'text-red-400'
              }`}>{admission.status}</span>
          </div>

          {admission.status === 'En cours' && (
            <button
              onClick={() => setShowCloseModal(true)}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white text-xs font-bold transition-all flex items-center space-x-2"
            >
              <CheckCircle size={14} />
              <span>Clôturer</span>
            </button>
          )}

          {admission.dischargeDate && (
            <div className="text-xs text-slate-400 text-center">
              <div className="font-black uppercase tracking-widest mb-1">Date de sortie</div>
              <div className="text-white">{new Date(admission.dischargeDate).toLocaleDateString('fr-FR')}</div>
            </div>
          )}
        </div>
      </div>

      {/* Close Admission Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-black text-gray-900">Clôturer l'admission</h3>
              <button
                onClick={() => setShowCloseModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="mb-6">
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
                <p className="text-sm text-orange-800">
                  ⚠️ Vous êtes sur le point de clôturer l'admission <strong>{admission.nda}</strong> pour le patient <strong>{patient.lastName} {patient.firstName}</strong>.
                </p>
              </div>
              <p className="text-gray-600 text-sm">
                Cette action marquera l'admission comme terminée et enregistrera la date de sortie. Voulez-vous continuer ?
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowCloseModal(false)}
                disabled={isClosing}
                className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleCloseAdmission}
                disabled={isClosing}
                className="flex-1 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {isClosing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>Clôture...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle size={18} />
                    <span>Confirmer la clôture</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shrink-0 mx-[-24px] px-6 lg:mx-[-40px] lg:px-10 shadow-sm">
        <div className="flex overflow-x-auto pb-px space-x-6 scrollbar-none">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center whitespace-nowrap py-4 border-b-4 font-black uppercase text-[10px] tracking-widest transition-all duration-200 group
                  ${isActive
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-slate-400 hover:text-slate-700 hover:border-slate-300'}
                `}
              >
                <Icon size={14} className={`mr-2 ${isActive ? 'text-indigo-600' : 'text-slate-300 group-hover:text-slate-500'}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto py-8">
        {tabs.find(t => t.id === activeTab)?.component}
      </div>
    </div>
  );
};
