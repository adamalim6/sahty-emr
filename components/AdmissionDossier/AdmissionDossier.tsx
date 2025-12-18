
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MOCK_ADMISSIONS, MOCK_PATIENTS, calculateAge } from '../../constants';
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
  ArrowLeftRight
} from 'lucide-react';

import { Dashboard } from './Dashboard';
import { Actes } from './Actes';
import { Pharmacie } from './Pharmacie';
import { Factures } from './Factures';
import { Devis } from './Devis';
import { Reglement } from './Reglement';
import { PEC } from './PEC';
import { Remboursement } from './Remboursement';

export const AdmissionDossier: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const admission = MOCK_ADMISSIONS.find(a => a.id === id);
  const patient = admission ? MOCK_PATIENTS.find(p => p.id === admission.patientId) : null;
  
  const [activeTab, setActiveTab] = useState('Dashboard');

  if (!admission || !patient) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-bold text-gray-700">Admission introuvable</h2>
        <button onClick={() => navigate('/admissions')} className="mt-4 text-emerald-600 hover:underline">Retour aux admissions</button>
      </div>
    );
  }

  const tabs = [
    { id: 'Dashboard', label: 'Dashboard', icon: LayoutDashboard, component: <Dashboard /> },
    { id: 'Actes', label: 'Actes', icon: ClipboardList, component: <Actes /> },
    { id: 'Pharmacie', label: 'Pharmacie', icon: Pill, component: <Pharmacie /> },
    { id: 'Factures', label: 'Factures', icon: FileText, component: <Factures /> },
    { id: 'Devis', label: 'Devis', icon: FileSignature, component: <Devis /> },
    { id: 'Reglement', label: 'Règlement', icon: Wallet, component: <Reglement /> },
    { id: 'PEC', label: 'PEC', icon: ShieldAlert, component: <PEC /> },
    { id: 'Remboursement', label: 'Remboursement', icon: ArrowLeftRight, component: <Remboursement /> },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] animate-in fade-in duration-300">
      {/* Back Link */}
      <button onClick={() => navigate('/admissions')} className="flex items-center text-gray-500 hover:text-gray-900 w-fit mb-4">
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

        {/* Status Badge */}
        <div className="shrink-0 relative z-10 self-center md:self-auto">
           <div className="bg-emerald-500/10 px-4 py-2 rounded-2xl border border-emerald-500/20 flex items-center space-x-2">
              <ShieldCheck size={16} className="text-emerald-400" />
              <span className="text-[11px] font-black text-emerald-400 uppercase tracking-widest">{admission.status}</span>
           </div>
        </div>
      </div>

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
