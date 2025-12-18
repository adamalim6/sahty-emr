import React, { useState, useEffect } from 'react';
import { 
  Plus, Clock, User, ShieldAlert, Activity, History as HistoryIcon, Pill, Waves, 
  FileText, CheckCircle2, Lock, ChevronRight, ArrowRight, AlertTriangle, 
  Stethoscope, Droplet, ClipboardCheck, Zap, Save, PenTool, FlaskConical,
  Baby, Scissors, Heart, ShieldCheck, Thermometer, Info, Hammer
} from 'lucide-react';

// --- Types ---

export interface AnesthesiaConsultation {
  id: string;
  date: string;
  time: string;
  anesthetist: string;
  status: 'Brouillon' | 'Validée';
  
  // 1. Métadonnées & Contexte
  surgeon?: string;
  scheduledDate?: string;

  // 2. Antécédents & Habitudes (Saisie libre)
  newMedicalHistory?: string;
  newSurgicalHistory?: string;
  gpa?: { g: string, p: string, a: string }; // Gynéco-obstétriques
  habits: {
    tobacco: 'Non' | 'Oui' | 'Sevré';
    alcohol: 'Non' | 'Oui' | 'Sevré';
    drugs: 'Non' | 'Oui';
  };
  atcdTransfusionnel: 'Non' | 'Oui' | 'Inconnu';
  recentEpisodeHistory?: string;
  atbLast3Months: boolean;

  // 3. Examen Clinique & Voies Aériennes
  newFC?: string;
  newPA_sys?: string;
  newPA_dia?: string;
  newSpO2?: string;
  auscultation?: string;
  neuroSigns?: string;
  mallampati: 1 | 2 | 3 | 4 | null;
  dtm: '> 65 mm' | '< 65 mm' | null;
  mouthOpening: '> 35 mm' | '< 35 mm' | null;
  cervicalSpine: 'Souple' | 'Raide' | null;
  dentition: {
    appareils: string[]; // SUP, INF, Amovible, Fixe
    particularites?: string;
    fragile: boolean;
  };
  venousCapital: 'Bon' | 'Mauvais' | 'Fragile';
  allenTest: 'Normal' | 'Anormal' | 'Non fait';

  // 4. Biologie & Examens (Saisie ponctuelle pour la consultation)
  biology: Record<string, string>; // Hb, Plq, TP, INR, Na+, K+, Creat, Glyc...
  additionalExams: {
    ecg?: string;
    ett?: string;
    rp?: string;
    echoDoppler?: string;
  };

  // 5. Risques
  asaScore: '1' | '2' | '3' | '4' | 'URG';
  riskCJD: boolean; // Creutzfeldt-Jakob
  riskIntubation: 'Faible' | 'Modéré' | 'Élevé';
  riskHemorrhagic: 'Faible' | 'Modéré' | 'Élevé';
  riskThrombo: 'Faible' | 'Modéré' | 'Élevé';
  riskNVPO: 'Faible' | 'Modéré' | 'Élevé';

  // 6. Stratégie
  admissionMode: 'Ambulatoire' | 'Hospitalisation';
  prehabRequested: boolean;
  anesthesiaType: ('AG' | 'Sédation' | 'ALR')[];
  proposedProtocol?: string;
  antibioprophylaxis: 'Céfazoline' | 'Vancomycine' | 'Autre' | 'Aucune';

  // 7. Visite Pré-Anesthésique (VPA)
  vpa: {
    realized: boolean;
    date?: string;
    consentSigned: boolean;
    liberalFastingRespected: boolean;
    protocolModified: boolean;
    atbConfirmed?: 'Kefzol 2g' | 'Dalacine 900mg' | 'Autre';
    premedication: string[];
  };

  signature?: string;
  validatedAt?: string;
}

// --- Illustrations Mallampati ---
const MALLAMPATI_ILLUSTRATIONS = {
  1: (color: string) => (
    <svg viewBox="0 0 100 100" className={`w-full h-full ${color}`}>
      <path d="M20,80 Q50,100 80,80 Q80,40 50,20 Q20,40 20,80" fill="none" stroke="currentColor" strokeWidth="2"/>
      <path d="M35,60 Q50,75 65,60" fill="none" stroke="currentColor" strokeWidth="2"/>
      <path d="M40,40 Q50,45 60,40" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="50" cy="35" r="4" fill="currentColor"/>
    </svg>
  ),
  2: (color: string) => (
    <svg viewBox="0 0 100 100" className={`w-full h-full ${color}`}>
      <path d="M20,80 Q50,100 80,80 Q80,40 50,20 Q20,40 20,80" fill="none" stroke="currentColor" strokeWidth="2"/>
      <path d="M35,65 Q50,78 65,65" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="50" cy="40" r="3" fill="currentColor"/>
    </svg>
  ),
  3: (color: string) => (
    <svg viewBox="0 0 100 100" className={`w-full h-full ${color}`}>
      <path d="M20,80 Q50,100 80,80 Q80,40 50,20 Q20,40 20,80" fill="none" stroke="currentColor" strokeWidth="2"/>
      <path d="M35,70 Q50,80 65,70" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5"/>
    </svg>
  ),
  4: (color: string) => (
    <svg viewBox="0 0 100 100" className={`w-full h-full ${color}`}>
      <path d="M20,80 Q50,100 80,80 Q80,40 50,20 Q20,40 20,80" fill="none" stroke="currentColor" strokeWidth="2"/>
      <rect x="30" y="60" width="40" height="20" rx="2" fill="currentColor" opacity="0.3"/>
    </svg>
  )
};

// --- Sub-components ---

const ImportBox: React.FC<React.PropsWithChildren<{ title: string; icon: any }>> = ({ title, icon: Icon, children }) => (
  <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 relative overflow-hidden group">
    <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
      <Icon size={48} className="text-blue-600" />
    </div>
    <div className="flex items-center space-x-2 mb-3">
      <div className="p-1.5 bg-blue-100 rounded text-blue-600"><Icon size={14} /></div>
      <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest">{title} (Dossier)</span>
    </div>
    <div className="space-y-2 relative z-10">
      {children}
    </div>
  </div>
);

const FormSection: React.FC<React.PropsWithChildren<{ title: string; icon: any; colorClass: string; id?: string }>> = ({ title, icon: Icon, colorClass, children, id }) => (
  <div id={id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-6 scroll-mt-20">
    <div className={`px-5 py-3 border-b border-gray-100 flex items-center space-x-2 bg-gray-50/50`}>
      <Icon size={18} className={colorClass} />
      <h4 className="font-bold text-gray-800 text-sm uppercase tracking-tight">{title}</h4>
    </div>
    <div className="p-5">
      {children}
    </div>
  </div>
);

export const AnesthesiaConsultationModule: React.FC = () => {
  const [consultations, setConsultations] = useState<AnesthesiaConsultation[]>([]);
  const [activeView, setActiveView] = useState<'list' | 'form'>('list');
  const [formData, setFormData] = useState<Partial<AnesthesiaConsultation>>({});

  const handleCreate = () => {
    setFormData({
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      anesthetist: 'Dr. Benomar',
      status: 'Brouillon',
      habits: { tobacco: 'Non', alcohol: 'Non', drugs: 'Non' },
      atcdTransfusionnel: 'Non',
      atbLast3Months: false,
      mallampati: null,
      dentition: { appareils: [], fragile: false },
      biology: {},
      additionalExams: {},
      asaScore: '1',
      riskCJD: false,
      riskIntubation: 'Faible',
      riskHemorrhagic: 'Faible',
      riskThrombo: 'Faible',
      riskNVPO: 'Faible',
      vpa: { realized: false, consentSigned: false, liberalFastingRespected: false, protocolModified: false, premedication: [] },
      anesthesiaType: []
    });
    setActiveView('form');
  };

  const handleSave = (lock = false) => {
    const finalData = { 
      ...formData, 
      status: lock ? 'Validée' : 'Brouillon',
      validatedAt: lock ? new Date().toISOString() : undefined
    } as AnesthesiaConsultation;

    setConsultations(prev => {
      const exists = prev.find(c => c.id === finalData.id);
      if (exists) return prev.map(c => c.id === finalData.id ? finalData : c);
      return [finalData, ...prev];
    });

    setActiveView('list');
  };

  if (activeView === 'form') {
    const isReadOnly = formData.status === 'Validée';

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* Navigation Rapide & Actions */}
        <div className="flex justify-between items-center sticky top-0 z-20 bg-gray-50/90 backdrop-blur-md py-3 -mt-3 border-b border-gray-200">
          <button onClick={() => setActiveView('list')} className="flex items-center text-gray-500 hover:text-gray-900 font-bold transition-colors">
            <ChevronRight size={20} className="rotate-180 mr-1" /> Retour
          </button>
          
          <div className="hidden lg:flex items-center space-x-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
             <a href="#clinique" className="hover:text-indigo-600">Clinique</a>
             <a href="#voies" className="hover:text-indigo-600">V.A.</a>
             <a href="#biologie" className="hover:text-indigo-600">Bio</a>
             <a href="#risques" className="hover:text-indigo-600">Risques</a>
             <a href="#strategie" className="hover:text-indigo-600">Stratégie</a>
             <a href="#vpa" className="hover:text-indigo-600">VPA</a>
          </div>

          <div className="flex items-center space-x-3">
             <span className={`px-3 py-1 rounded-full text-xs font-bold ${isReadOnly ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
               {isReadOnly ? 'Consultation Verrouillée' : 'Saisie en cours'}
             </span>
             {!isReadOnly && (
               <>
                 <button onClick={() => handleSave(false)} className="px-4 py-2 text-sm font-bold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all active:scale-95 shadow-sm">Brouillon</button>
                 <button onClick={() => handleSave(true)} className="px-4 py-2 text-sm font-bold text-white bg-slate-900 rounded-lg shadow-lg flex items-center hover:bg-black transition-all active:scale-95">
                   <Lock size={16} className="mr-2" /> Valider & Sceller
                 </button>
               </>
             )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-20">
          {/* COLONNE GAUCHE - SAISIE PRINCIPALE */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* 1. ANTECEDENTS & HABITUDES */}
            <FormSection title="Antécédents & Habitudes" icon={HistoryIcon} colorClass="text-slate-600">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                     <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Antécédents Médicaux</label>
                        <textarea className="w-full border-gray-300 rounded-lg text-sm" rows={2} disabled={isReadOnly} placeholder="Pathologies chroniques..."></textarea>
                     </div>
                     <div className="grid grid-cols-2 gap-3">
                        <div>
                           <label className="block text-xs font-bold text-gray-400 uppercase mb-1">GPA (Gynéco)</label>
                           <div className="flex gap-1">
                              <input type="text" placeholder="G" className="w-full border-gray-300 rounded-lg text-center text-sm" disabled={isReadOnly} />
                              <input type="text" placeholder="P" className="w-full border-gray-300 rounded-lg text-center text-sm" disabled={isReadOnly} />
                              <input type="text" placeholder="A" className="w-full border-gray-300 rounded-lg text-center text-sm" disabled={isReadOnly} />
                           </div>
                        </div>
                        <div>
                           <label className="block text-xs font-bold text-gray-400 uppercase mb-1">ATCD Transfusionnel</label>
                           <select className="w-full border-gray-300 rounded-lg text-sm" disabled={isReadOnly}>
                              <option>Non</option>
                              <option>Oui</option>
                              <option>Inconnu</option>
                           </select>
                        </div>
                     </div>
                  </div>
                  <div className="space-y-4">
                     <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Habitudes de vie</label>
                     <div className="grid grid-cols-3 gap-2">
                        {['Tabac', 'Alcool', 'Stupéfiant'].map(item => (
                           <div key={item} className="p-2 border border-gray-100 rounded-lg bg-gray-50/50">
                              <span className="text-[10px] font-bold text-gray-500 block mb-1">{item}</span>
                              <select className="w-full border-none bg-transparent p-0 text-xs font-bold text-indigo-700" disabled={isReadOnly}>
                                 <option>Non</option>
                                 <option>Oui</option>
                                 <option>Sevré</option>
                              </select>
                           </div>
                        ))}
                     </div>
                     <label className="flex items-center cursor-pointer mt-2">
                        <input type="checkbox" className="rounded text-indigo-600" disabled={isReadOnly} />
                        <span className="ml-2 text-xs font-medium text-gray-700">Antibiotiques les 3 derniers mois ?</span>
                     </label>
                  </div>
               </div>
            </FormSection>

            {/* 2. EXAMEN CLINIQUE */}
            <FormSection id="clinique" title="Examen Clinique" icon={Stethoscope} colorClass="text-indigo-600">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ImportBox title="Dernier Examen" icon={Activity}>
                  <div className="flex justify-between text-xs border-b border-blue-100/50 pb-1 mb-1"><span className="text-gray-500 italic">Poids/Taille:</span> <span className="font-bold">78 kg / 175 cm (IMC 25.5)</span></div>
                  <div className="flex justify-between text-xs border-b border-blue-100/50 pb-1 mb-1"><span className="text-gray-500 italic">TA habituelle:</span> <span className="font-bold">130/80 mmHg</span></div>
                  <div className="text-[10px] text-gray-400 mt-2">Auscultation : B1-B2 réguliers, murmure vésiculaire présent.</div>
                </ImportBox>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col"><label className="text-[10px] font-bold text-gray-400 uppercase">FC (bpm)</label><input type="text" className="border-gray-300 rounded-lg text-sm font-bold" disabled={isReadOnly} /></div>
                    <div className="flex flex-col"><label className="text-[10px] font-bold text-gray-400 uppercase">PA (mmHg)</label><input type="text" placeholder="120/70" className="border-gray-300 rounded-lg text-sm font-bold" disabled={isReadOnly} /></div>
                    <div className="flex flex-col"><label className="text-[10px] font-bold text-gray-400 uppercase">SpO2 (%)</label><input type="text" className="border-gray-300 rounded-lg text-sm font-bold" disabled={isReadOnly} /></div>
                  </div>
                  <textarea placeholder="Particularités cliniques, Auscultation, Neuro..." className="w-full border-gray-300 rounded-lg text-sm" rows={2} disabled={isReadOnly}></textarea>
                </div>
              </div>
            </FormSection>

            {/* 3. VOIES AÉRIENNES & DENTITION */}
            <FormSection id="voies" title="Évaluation des Voies Aériennes" icon={Waves} colorClass="text-blue-600">
               <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div>
                        <label className="block text-sm font-bold text-gray-700 mb-4">Mallampati</label>
                        <div className="grid grid-cols-4 gap-3">
                           {[1, 2, 3, 4].map((num) => (
                              <button key={num} disabled={isReadOnly} onClick={() => setFormData({...formData, mallampati: num as any})} className={`relative p-2 rounded-xl border-2 transition-all ${formData.mallampati === num ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-100' : 'border-gray-100 hover:border-indigo-200'}`}>
                                 <div className="aspect-square mb-1">{MALLAMPATI_ILLUSTRATIONS[num as 1|2|3|4](formData.mallampati === num ? 'text-indigo-600' : 'text-gray-300')}</div>
                                 <span className={`text-[10px] font-black uppercase block text-center ${formData.mallampati === num ? 'text-indigo-700' : 'text-gray-400'}`}>Cl. {num}</span>
                              </button>
                           ))}
                        </div>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                           <label className="block text-xs font-bold text-gray-400 uppercase mb-2">DTM (Thyro-ment.)</label>
                           {/* Fix: cast value as specific literal union type */}
                           <ToggleGroup options={[{label:'>65', value:'> 65 mm'}, {label:'<65', value:'< 65 mm'}]} value={formData.dtm || ''} onChange={(v) => setFormData({...formData, dtm: v as ("> 65 mm" | "< 65 mm")})} />
                        </div>
                        <div>
                           <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Ouverture Buccale</label>
                           {/* Fix: cast value as specific literal union type */}
                           <ToggleGroup options={[{label:'>35', value:'> 35 mm'}, {label:'<35', value:'< 35 mm'}]} value={formData.mouthOpening || ''} onChange={(v) => setFormData({...formData, mouthOpening: v as ("> 35 mm" | "< 35 mm")})} />
                        </div>
                        <div className="col-span-2">
                           <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Rachis Cervical</label>
                           {/* Fix: cast value as specific literal union type */}
                           <ToggleGroup options={[{label:'Souple', value:'Souple'}, {label:'Raide', value:'Raide'}]} value={formData.cervicalSpine || ''} onChange={(v) => setFormData({...formData, cervicalSpine: v as ("Souple" | "Raide")})} />
                        </div>
                     </div>
                  </div>

                  <div className="border-t border-gray-100 pt-6">
                     <label className="block text-sm font-bold text-gray-700 mb-4 flex items-center"><Hammer size={16} className="mr-2 text-amber-500" /> Dentition & Accès</label>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-3">
                           <span className="text-[10px] font-bold text-gray-400 uppercase block tracking-wider">Appareillage</span>
                           <div className="flex flex-wrap gap-2">
                              {['SUP', 'INF', 'Amovible', 'Fixe', 'Bagues'].map(tag => (
                                 <label key={tag} className="flex items-center px-2 py-1 bg-gray-50 border border-gray-200 rounded cursor-pointer hover:bg-indigo-50 transition-colors">
                                    <input type="checkbox" className="rounded text-indigo-600 h-3 w-3" disabled={isReadOnly} />
                                    <span className="ml-1.5 text-[11px] font-bold text-gray-700">{tag}</span>
                                 </label>
                              ))}
                           </div>
                        </div>
                        <div className="space-y-3">
                           <span className="text-[10px] font-bold text-gray-400 uppercase block tracking-wider">Capital Veineux</span>
                           {/* Fix: cast value as specific literal union type */}
                           <ToggleGroup options={[{label:'Bon', value:'Bon'}, {label:'Mauvais', value:'Mauvais'}, {label:'Fragile', value:'Fragile'}]} value={formData.venousCapital || 'Bon'} onChange={(v) => setFormData({...formData, venousCapital: v as ("Bon" | "Mauvais" | "Fragile")})} compact />
                        </div>
                        <div className="space-y-3">
                           <span className="text-[10px] font-bold text-gray-400 uppercase block tracking-wider">Test Allen / Site ALR</span>
                           <select className="w-full border-gray-300 rounded-lg text-xs" disabled={isReadOnly}>
                              <option>Normal</option>
                              <option>Anormal</option>
                              <option>Non fait</option>
                           </select>
                        </div>
                     </div>
                  </div>
               </div>
            </FormSection>

            {/* 4. BIOLOGIE & EXAMENS */}
            <FormSection id="biologie" title="Bilan Biologique & Imagerie" icon={FlaskConical} colorClass="text-purple-600">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {[
                     {id:'hb', label:'Hb', unit:'g/dL'}, {id:'plq', label:'Plq', unit:'/mm3'}, {id:'tp', label:'TP', unit:'%'},
                     {id:'inr', label:'INR', unit:''}, {id:'creat', label:'Créat', unit:'mg/L'}, {id:'k', label:'K+', unit:'mEq/L'},
                     {id:'glyc', label:'Glycémie', unit:'mmol/L'}, {id:'crp', label:'CRP', unit:'mg/L'}, {id:'hb1c', label:'HbA1c', unit:'%'}
                  ].map(field => (
                     <div key={field.id} className="relative group">
                        <label className="text-[10px] font-black text-gray-400 uppercase absolute left-3 top-2 pointer-events-none">{field.label}</label>
                        <input type="text" className="w-full pt-6 pb-2 px-3 border-gray-200 rounded-lg text-xs font-bold text-indigo-900 focus:ring-purple-500 focus:border-purple-500 bg-gray-50/30 group-hover:bg-white transition-all" placeholder={field.unit} disabled={isReadOnly} />
                     </div>
                  ))}
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-100 pt-4">
                  <div className="space-y-3">
                     <span className="text-[10px] font-bold text-gray-400 uppercase block tracking-wider">Examens Complémentaires</span>
                     <div className="space-y-2">
                        {['ECG', 'ETT', 'RP (Radio Thorax)', 'Echo-Doppler'].map(ex => (
                           <div key={ex} className="flex items-center space-x-3 bg-slate-50 p-2 rounded-lg border border-slate-100">
                              <label className="text-xs font-bold text-slate-600 w-24">{ex}</label>
                              <input type="text" placeholder="Interprétation..." className="flex-1 bg-white border-gray-200 rounded text-xs py-1" disabled={isReadOnly} />
                              <button className="p-1 text-indigo-500 hover:bg-indigo-50 rounded" title="Attacher document"><Info size={14}/></button>
                           </div>
                        ))}
                     </div>
                  </div>
                  <div className="bg-indigo-900 rounded-xl p-4 text-white">
                     <h5 className="text-[10px] font-black uppercase text-indigo-300 mb-3 tracking-widest">Groupe Sanguin</h5>
                     <div className="grid grid-cols-3 gap-2">
                        <div className="bg-indigo-800/50 p-2 rounded text-center border border-indigo-700/50">
                           <span className="block text-[8px] text-indigo-400 font-bold uppercase">Groupe</span>
                           <span className="text-xl font-black">A</span>
                        </div>
                        <div className="bg-indigo-800/50 p-2 rounded text-center border border-indigo-700/50">
                           <span className="block text-[8px] text-indigo-400 font-bold uppercase">Rhésus</span>
                           <span className="text-xl font-black">+</span>
                        </div>
                        <div className="bg-indigo-800/50 p-2 rounded text-center border border-indigo-700/50">
                           <span className="block text-[8px] text-indigo-400 font-bold uppercase">RAI</span>
                           <span className="text-xl font-black text-emerald-400">NEG</span>
                        </div>
                     </div>
                  </div>
               </div>
            </FormSection>

            {/* 5. VISITE PRÉ-ANESTHÉSIQUE (VPA) */}
            <FormSection id="vpa" title="Visite Pré-AnesthÉsique (VPA)" icon={ShieldCheck} colorClass="text-emerald-600">
               <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                           <span className="text-sm font-bold text-gray-700">Visite réalisée ?</span>
                           <label className="relative inline-flex items-center cursor-pointer">
                              <input type="checkbox" className="sr-only peer" checked={formData.vpa?.realized} onChange={(e) => setFormData({...formData, vpa: {...formData.vpa!, realized: e.target.checked}})} />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-emerald-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                           </label>
                        </div>
                        {formData.vpa?.realized && (
                           <div className="grid grid-cols-2 gap-3 animate-in fade-in zoom-in-95">
                              <label className="flex items-start cursor-pointer p-2 border border-emerald-100 rounded-lg hover:bg-emerald-50 bg-white">
                                 <input type="checkbox" className="mt-1 rounded text-emerald-600" />
                                 <span className="ml-2 text-[10px] font-bold leading-tight">Consentement signé</span>
                              </label>
                              <label className="flex items-start cursor-pointer p-2 border border-emerald-100 rounded-lg hover:bg-emerald-50 bg-white">
                                 <input type="checkbox" className="mt-1 rounded text-emerald-600" />
                                 <span className="ml-2 text-[10px] font-bold leading-tight">Jeûne libéral respecté</span>
                              </label>
                           </div>
                        )}
                     </div>
                     <div className="space-y-4">
                        <span className="text-[10px] font-bold text-gray-400 uppercase block tracking-wider">Prémédication</span>
                        <div className="flex flex-wrap gap-2">
                           {['Boisson sucrée 2h', 'Paracétamol 1g', 'Kétoprofène 50mg'].map(item => (
                              <label key={item} className="flex items-center p-2 bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-emerald-300">
                                 <input type="checkbox" className="rounded text-emerald-600" disabled={isReadOnly} />
                                 <span className="ml-2 text-xs font-medium text-gray-600">{item}</span>
                              </label>
                           ))}
                        </div>
                     </div>
                  </div>
               </div>
            </FormSection>
          </div>

          {/* COLONNE DROITE - RÉSUMÉ & RISQUES */}
          <div className="lg:col-span-4 space-y-6">
            <div className="sticky top-20">
               {/* 6. RISQUES & SCORE ASA */}
               <div id="risques" className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
                  <div className="bg-red-50 px-4 py-3 border-b border-red-100 flex items-center space-x-2">
                     <AlertTriangle size={18} className="text-red-600" />
                     <h4 className="font-bold text-red-900 text-xs uppercase">Scores & Risques</h4>
                  </div>
                  <div className="p-5 space-y-6">
                     <div>
                        <label className="block text-xs font-black text-gray-400 uppercase mb-3 text-center tracking-widest">Classe ASA</label>
                        <div className="flex gap-2">
                           {['1', '2', '3', '4', 'URG'].map(score => (
                              <button key={score} disabled={isReadOnly} onClick={() => setFormData({...formData, asaScore: score as any})} className={`flex-1 py-3 rounded-lg font-black text-lg border-2 transition-all ${formData.asaScore === score ? 'bg-red-600 border-red-600 text-white shadow-md' : 'bg-white border-gray-100 text-gray-300 hover:border-red-200'}`}>{score}</button>
                           ))}
                        </div>
                     </div>
                     <div className="space-y-4 pt-4 border-t border-gray-100">
                        {[
                           {label:'Creutzfeldt-Jakob', val: formData.riskCJD, id:'cjd'},
                           {label:'Intubation difficile', val: formData.riskIntubation, id:'int'},
                           {label:'Hémorragique', val: formData.riskHemorrhagic, id:'hem'},
                           {label:'Thrombo-embolique', val: formData.riskThrombo, id:'thr'},
                           {label:'NVPO', val: formData.riskNVPO, id:'nvpo'}
                        ].map(r => (
                           <div key={r.id} className="flex items-center justify-between group">
                              <span className="text-xs font-bold text-gray-600 group-hover:text-red-700 transition-colors">{r.label}</span>
                              {r.id === 'cjd' ? (
                                 <ToggleGroup options={[{label:'Non', value:'false'}, {label:'Oui', value:'true'}]} value={r.val.toString()} onChange={(v) => setFormData({...formData, riskCJD: v === 'true'})} compact />
                              ) : (
                                 <select className="text-[10px] font-black uppercase text-red-600 border-none bg-red-50/50 rounded focus:ring-0 p-1" disabled={isReadOnly}>
                                    <option>Faible</option>
                                    <option>Modéré</option>
                                    <option>Élevé</option>
                                 </select>
                              )}
                           </div>
                        ))}
                     </div>
                  </div>
               </div>

               {/* 7. STRATÉGIE & SYNTHÈSE */}
               <div id="strategie" className="bg-indigo-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                  <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl"></div>
                  <h4 className="text-xs font-black uppercase text-indigo-300 mb-6 tracking-widest flex items-center">
                     <Zap size={16} className="mr-2" /> Synthèse & Stratégie
                  </h4>
                  <div className="space-y-6 relative z-10">
                     <div className="space-y-2">
                        <span className="text-[10px] font-bold text-indigo-400 uppercase">Type d'Anesthésie</span>
                        <div className="flex flex-wrap gap-2">
                           {['AG', 'Sédation', 'ALR'].map(type => (
                              <button key={type} className="px-3 py-1.5 rounded-lg border border-indigo-700 bg-indigo-800/50 hover:bg-indigo-700 transition-all text-xs font-bold">
                                 {type}
                              </button>
                           ))}
                        </div>
                     </div>
                     <div className="space-y-2">
                        <span className="text-[10px] font-bold text-indigo-400 uppercase">Antibioprophylaxie</span>
                        <select className="w-full bg-indigo-800 border-indigo-700 rounded-lg text-xs font-bold focus:ring-indigo-400" disabled={isReadOnly}>
                           <option>Céfazoline (Kefzol 2g)</option>
                           <option>Vancomycine</option>
                           <option>Dalacine 900mg</option>
                           <option>Autre / Aucune</option>
                        </select>
                     </div>
                     <div className="space-y-2">
                        <span className="text-[10px] font-bold text-indigo-400 uppercase">Mode d'admission</span>
                        <div className="flex bg-indigo-950 p-1 rounded-lg">
                           <button className="flex-1 py-1.5 rounded text-[10px] font-black uppercase bg-indigo-600">Ambulatoire</button>
                           <button className="flex-1 py-1.5 rounded text-[10px] font-black uppercase hover:bg-indigo-800/50">Hospit.</button>
                        </div>
                     </div>
                     <div className="pt-4 border-t border-indigo-800">
                        <textarea className="w-full bg-indigo-950 border-indigo-800 rounded-lg text-xs placeholder:text-indigo-700 focus:ring-indigo-400" rows={3} placeholder="Protocole proposé, consignes finales..."></textarea>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <ClipboardCheck className="mr-2 text-indigo-600" />
            Consultations Anesthésiques
          </h3>
          <p className="text-sm text-gray-500">Historique des évaluations pré-opératoires.</p>
        </div>
        <button 
          onClick={handleCreate}
          className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm font-medium"
        >
          <Plus size={18} />
          <span>Nouvelle consultation</span>
        </button>
      </div>

      {consultations.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
          <Stethoscope className="mx-auto h-12 w-12 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Aucune consultation enregistrée pour cette intervention.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {consultations.map(consult => (
            <div 
              key={consult.id} 
              onClick={() => { setFormData(consult); setActiveView('form'); }}
              className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer group flex flex-col md:flex-row justify-between items-center gap-4"
            >
              <div className="flex items-center space-x-4">
                 <div className={`p-3 rounded-lg ${consult.status === 'Validée' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                   {consult.status === 'Validée' ? <CheckCircle2 size={24} /> : <PenTool size={24} />}
                 </div>
                 <div>
                    <h4 className="font-bold text-gray-900 text-lg flex items-center">
                      Consultation par {consult.anesthetist}
                      {consult.status === 'Validée' && <Lock size={14} className="ml-2 text-gray-400" />}
                    </h4>
                    <div className="flex items-center text-sm text-gray-500 space-x-3 mt-0.5">
                       <span className="flex items-center"><Clock size={14} className="mr-1"/> {new Date(consult.date).toLocaleDateString()} à {consult.time}</span>
                       <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${consult.status === 'Validée' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                         {consult.status}
                       </span>
                    </div>
                 </div>
              </div>
              <div className="flex items-center space-x-6 text-right">
                  <div className="hidden md:block">
                     <span className="text-[10px] font-black text-gray-400 uppercase block tracking-widest">Score ASA</span>
                     <span className="text-xl font-black text-red-600">{consult.asaScore}</span>
                  </div>
                  <div className="h-8 w-px bg-gray-100"></div>
                  <ChevronRight className="text-gray-300 group-hover:text-indigo-600 transition-colors" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- Helpers ---

const ToggleGroup = ({ 
  options, 
  value, 
  onChange, 
  compact = false 
}: { 
  options: { label: string, value: string }[], 
  value: string, 
  onChange: (val: string) => void,
  compact?: boolean
}) => (
  <div className={`flex bg-gray-100 p-0.5 rounded-lg border border-gray-200 w-full`}>
    {options.map((opt) => (
      <button
        key={opt.value}
        type="button"
        onClick={() => onChange(opt.value)}
        className={`
          flex-1 text-center font-bold rounded-md transition-all duration-200
          ${compact ? 'py-1 text-[10px]' : 'py-1.5 text-xs'}
          ${value === opt.value 
            ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-black/5' 
            : 'text-gray-400 hover:text-gray-600'}
        `}
      >
        {opt.label}
      </button>
    ))}
  </div>
);