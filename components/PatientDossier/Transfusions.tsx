import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Plus, 
  Droplet, 
  CheckCircle2, 
  X, 
  Save, 
  Activity,
  AlertTriangle,
  Clock,
  UserCheck
} from 'lucide-react';
import { api } from '../../services/api';
import { AdministrationModal, AdministrationSavePayload } from './AdministrationModal';

// --- Types ---
export interface TransfusionBloodBag {
    id: string;
    tenant_patient_id: string;
    received_at: string;
    blood_product_code: string;
    bag_number: string;
    abo_group: string;
    rhesus: string;
    volume_ml: number | null;
    expiry_at: string | null;
    status: string;
    notes: string | null;
    received_by_user_first_name: string | null;
    received_by_user_last_name: string | null;
}

const getProductColor = (type: string) => {
  switch (type) {
    case 'CGR': return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', fill: 'bg-red-600' };
    case 'PFC': return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', fill: 'bg-blue-600' };
    case 'PLAQUETTES': return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', fill: 'bg-amber-500' };
    case 'CRYO': return { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', fill: 'bg-purple-600' };
    default: return { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', fill: 'bg-gray-600' };
  }
};

export const Transfusions: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  
  const [activeTab, setActiveTab] = useState<'bags' | 'admin'>('bags');
  
  const [bags, setBags] = useState<TransfusionBloodBag[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isBagModalOpen, setIsBagModalOpen] = useState(false);
  const [adminModal, setAdminModal] = useState({
      isOpen: false,
      prescriptionId: '',
      eventId: '',
      prescriptionName: '',
      slotTime: '',
      duration: 0,
      requiresEndEvent: false,
      activePerfusionEvent: null as any,
      historyEvents: [] as any[],
      isTransfusion: false
  });
  const [bagFormData, setBagFormData] = useState({
    blood_product_code: 'CGR',
    bag_number: '',
    abo_group: 'O',
    rhesus: '+',
    volume_ml: '',
    expiry_at: '',
    notes: ''
  });

  const fetchData = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const timelineData = await api.getTransfusionTimeline(id);
      setBags(timelineData.bags || []);
      setPrescriptions(timelineData.prescriptions || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleBagInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setBagFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveBag = async () => {
    if (!id || !bagFormData.bag_number || !bagFormData.blood_product_code) return;
    
    try {
      await api.createTransfusionBag(id, {
        ...bagFormData,
        volume_ml: bagFormData.volume_ml ? parseFloat(bagFormData.volume_ml) : undefined
      });
      setIsBagModalOpen(false);
      setBagFormData({
        blood_product_code: 'CGR',
        bag_number: '',
        abo_group: 'O',
        rhesus: '+',
        volume_ml: '',
        expiry_at: '',
        notes: ''
      });
      fetchData(); // Refresh list
    } catch (e) {
      console.error("Failed to save bag", e);
      alert("Erreur lors de l'enregistrement de la poche.");
    }
  };

  const handleDiscardBag = async (bagId: string) => {
    if (!window.confirm("Voulez-vous vraiment mettre cette poche au rebut ? Cette action est irréversible.")) return;
    try {
      await api.discardTransfusionBag(bagId);
      fetchData();
    } catch (e) {
      console.error("Failed to discard bag", e);
      alert("Erreur: Impossible de mettre cette poche au rebut (elle est peut-être déjà en cours d'utilisation).");
    }
  };

  const closeAdminModal = () => setAdminModal(prev => ({ ...prev, isOpen: false }));

  const handleSaveAdministration = async (payload: AdministrationSavePayload | AdministrationSavePayload[]) => {
    if (!id || !adminModal.prescriptionId) return;
    try {
      const payloads = Array.isArray(payload) ? payload : [payload];
      for (const p of payloads) {
        await api.recordExecution(adminModal.prescriptionId, {
           prescriptionId: adminModal.prescriptionId,
           assigned_prescription_event_id: adminModal.eventId,
           patientId: id,
           action_type: p.action_type,
           occurred_at: p.occurred_at,
           actual_start_at: p.actual_start_at,
           actual_end_at: p.actual_end_at,
           planned_date: new Date(adminModal.slotTime).toISOString(),
           justification: p.justification,
           transfusion: p.transfusion,
           administered_bags: p.administered_bags,
           linked_event_id: p.linked_event_id,
           volume_administered_ml: p.volume_administered_ml
        });
      }
      setAdminModal(prev => ({ ...prev, isOpen: false }));
      fetchData();
    } catch (err: any) {
      alert("Error saving execution: " + err.message);
    }
  };

  const handleCancelAdminEvent = async (adminEventId: string) => {
    try {
      await api.cancelAdministrationEvent(adminModal.prescriptionId, adminModal.eventId, adminEventId);
      fetchData();
      setAdminModal(prev => ({ ...prev, isOpen: false }));
    } catch (err: any) {
      alert("Error canceling execution: " + err.message);
    }
  };

  // --- RENDERING ---

  const renderBagsTab = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200">
        <div>
          <h4 className="text-md font-bold text-gray-800">Poches Sanguines Réservées</h4>
          <p className="text-sm text-gray-500">Poches reçues de la banque de sang et attribuées à ce patient.</p>
        </div>
        <button 
          onClick={() => setIsBagModalOpen(true)}
          className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors font-medium text-sm"
        >
          <Plus size={16} />
          <span>Ajouter une poche</span>
        </button>
      </div>

      {bags.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
          <Droplet className="h-8 w-8 text-red-300 mx-auto mb-3" />
          <h3 className="text-sm font-medium text-gray-900">Aucune poche enregistrée</h3>
          <p className="mt-1 text-xs text-gray-500">Ajoutez une poche reçue de la banque de sang.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bags.map(bag => {
            const colors = getProductColor(bag.blood_product_code);
            return (
              <div key={bag.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
                <div className={`absolute top-0 left-0 w-1.5 h-full ${colors.fill}`}></div>
                <div className="p-4 pl-5">
                  <div className="flex justify-between items-start mb-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${colors.bg} ${colors.text} ${colors.border}`}>
                      {bag.blood_product_code}
                    </span>
                    <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded border shadow-sm
                      ${bag.status === 'RECEIVED' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                        bag.status === 'IN_USE' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                        bag.status === 'USED' ? 'bg-gray-100 text-gray-700 border-gray-300' :
                        bag.status === 'DISCARDED' ? 'bg-red-50 text-red-700 border-red-200' :
                        'bg-gray-50 text-gray-700 border-gray-200'}`}>
                      {bag.status === 'RECEIVED' ? 'Réceptionnée' :
                       bag.status === 'IN_USE' ? 'En cours de transfusion' :
                       bag.status === 'USED' ? 'Utilisée' :
                       bag.status === 'DISCARDED' ? 'Mise au rebut' : bag.status}
                    </span>
                  </div>
                  <h4 className="font-mono text-lg font-bold text-gray-900 mb-1">{bag.bag_number}</h4>
                  <div className="flex items-center space-x-2 text-sm text-gray-600 mb-3">
                    <span className="font-bold border border-gray-200 bg-gray-50 px-2 py-0.5 rounded">Gr: {bag.abo_group}{bag.rhesus}</span>
                    {bag.volume_ml && <span>{bag.volume_ml} ml</span>}
                  </div>
                  <div className="text-xs text-gray-400 flex items-center mb-3">
                    <Clock size={12} className="mr-1" /> Reçue le {new Date(bag.received_at).toLocaleString('fr-FR')}
                  </div>
                  {bag.status === 'RECEIVED' && (
                    <div className="pt-3 border-t border-gray-100 flex justify-end">
                      <button 
                        onClick={() => handleDiscardBag(bag.id)}
                        className="text-xs text-red-600 hover:text-red-800 font-medium hover:underline"
                      >
                        Mettre au rebut
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderAdminTab = () => (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h4 className="text-lg font-bold text-gray-800">Prescriptions & Traçabilité</h4>
          <p className="text-sm text-gray-500 mt-1">Historique des prescriptions de transfusion et leurs administrations.</p>
        </div>
        <div className="mt-4 md:mt-0 bg-emerald-50 text-emerald-700 px-3 py-2 rounded-lg text-xs font-medium border border-emerald-100 flex items-center shadow-sm">
          <Activity size={16} className="mr-2" />
          Saisie des Actes via la Fiche de Surveillance
        </div>
      </div>

      {prescriptions.length === 0 ? (
        <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-300">
           <Activity className="h-8 w-8 text-gray-300 mx-auto mb-3" />
           <p className="text-sm text-gray-500 font-medium">Aucune prescription de transfusion trouvée.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {prescriptions.map(p => {
            const productType = p.details?.blood_product_type || 'Transfusion Sanguine';
            const colors = getProductColor(productType);
            
            return (
              <div key={p.prescription_id} className="border border-gray-200 bg-white rounded-xl overflow-hidden shadow-sm">
                {/* Prescription Header */}
                <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-start">
                  <div>
                    <div className="flex items-center space-x-2 mb-1.5">
                      <span className={`px-2.5 py-0.5 rounded text-xs font-bold border shadow-sm ${colors.bg} ${colors.text} ${colors.border}`}>
                        {productType}
                      </span>
                      <span className="text-[15px] font-bold text-gray-900">
                        {p.details?.qty} {p.unit_name || 'unité(s)'} - Voie {p.details?.route || 'IV'}
                      </span>
                      {p.status === 'PAUSED' && <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-bold rounded shadow-sm border border-amber-200">EN PAUSE</span>}
                      {p.status === 'STOPPED' && <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs font-bold rounded shadow-sm border border-red-200">ARRÊTÉE</span>}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center font-medium">
                      Prescrit le {new Date(p.created_at).toLocaleString('fr-FR')} 
                      <span className="mx-2 text-gray-300">•</span> 
                      Par: <span className="font-semibold text-gray-800 ml-1">{p.created_by_first_name || 'Dr.'} {p.created_by_last_name || 'Médecin'}</span>
                    </div>
                  </div>
                </div>

                {/* Prescription Events */}
                <div className="p-5 bg-white space-y-6">
                  {p.events && p.events.length > 0 ? (
                    p.events.map((ev: any) => (
                      <div key={ev.id} className="pl-4 border-l-2 border-slate-200 relative">
                        {/* Event Bubble Marker */}
                        <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-slate-300"></div>
                        
                        <div className="flex items-center text-sm font-bold text-slate-700 mb-3 cursor-pointer hover:text-emerald-700 transition-colors" onClick={() => {
                          setAdminModal({
                              isOpen: true,
                              prescriptionId: p.prescription_id,
                              eventId: ev.id,
                              prescriptionName: productType,
                              slotTime: ev.scheduled_at,
                              duration: p.details?.adminDuration ? (parseInt(p.details.adminDuration.split(':')[0] || '0') * 60 + parseInt(p.details.adminDuration.split(':')[1] || '0')) : 0,
                              requiresEndEvent: true,
                              activePerfusionEvent: ev.administrations?.find((a: any) => a.action_type === 'started' && ev.administrations?.every((e: any) => e.action_type !== 'ended')),
                              historyEvents: ev.administrations || [],
                              isTransfusion: true
                          });
                        }}>
                          <Clock size={14} className="mr-1.5 text-slate-400" />
                          <span>Prévu le {new Date(ev.scheduled_at).toLocaleString('fr-FR')}</span>
                          {(() => {
                            const activeAdmins = (ev.administrations || []).filter((a: any) => a.status === 'ACTIVE');
                            const hasStart = activeAdmins.some((a: any) => a.action_type === 'started');
                            const hasEnd = activeAdmins.some((a: any) => a.action_type === 'ended');
                            const hasRefused = activeAdmins.some((a: any) => a.action_type === 'refused');
                            
                            let derivedStatus = 'EN ATTENTE';
                            let badgeClass = 'bg-slate-50 text-slate-600 border-slate-200';
                            
                            if (hasRefused) {
                                derivedStatus = 'NON ADMINISTRÉ';
                                badgeClass = 'bg-red-50 text-red-700 border-red-200';
                            } else if (hasStart && hasEnd) {
                                derivedStatus = 'TERMINÉE';
                                badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                            } else if (hasStart) {
                                derivedStatus = 'EN COURS';
                                badgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
                            }
                            
                            return (
                                <span className={`ml-3 px-1.5 py-0.5 text-[10px] uppercase font-bold rounded border ${badgeClass}`}>
                                    {derivedStatus}
                                </span>
                            );
                          })()}
                        </div>

                        {/* Administrations Logs */}
                        {ev.administrations && ev.administrations.length > 0 ? (
                          <div className="space-y-3 mt-2">
                            {ev.administrations.map((admin: any) => (
                              <div key={admin.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm flex flex-col gap-2.5 shadow-sm transition-colors hover:bg-slate-100">
                                <div className="flex justify-between items-start">
                                  <div className="flex items-center space-x-2.5">
                                    <div className={`flex items-center justify-center p-1.5 rounded-md text-white shadow-sm
                                      ${admin.action_type === 'started' ? 'bg-blue-500' : 
                                        admin.action_type === 'ended' ? 'bg-emerald-500' : 
                                        admin.action_type === 'refused' ? 'bg-red-500' : 'bg-gray-400'}`}>
                                      {admin.action_type === 'started' ? <Activity size={14} /> : 
                                        admin.action_type === 'ended' ? <CheckCircle2 size={14} /> : 
                                        admin.action_type === 'refused' ? <X size={14} /> : <Save size={14} />}
                                    </div>
                                    <div>
                                      <span className="font-bold text-gray-800 block leading-tight">
                                        {admin.action_type === 'started' ? 'Début de Transfusion' : 
                                         admin.action_type === 'ended' ? 'Fin de Transfusion' : 
                                         admin.action_type === 'refused' ? 'Refus Patient' : 
                                         admin.action_type === 'administered' ? 'Administré' : admin.action_type}
                                      </span>
                                      <div className="flex items-center space-x-2 mt-0.5">
                                        <span className="text-gray-800 text-sm font-bold">
                                          {admin.action_type === 'started' && admin.actual_start_at 
                                            ? new Date(admin.actual_start_at).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'}) 
                                            : admin.action_type === 'ended' && admin.actual_end_at 
                                              ? new Date(admin.actual_end_at).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})
                                              : new Date(admin.occurred_at).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}
                                        </span>
                                        <span className="text-gray-400 text-[10px] italic font-medium">
                                          (enregistré à {new Date(admin.occurred_at).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})})
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-xs text-gray-600 flex items-center bg-white px-2 py-1 rounded border border-gray-200 font-medium">
                                    <UserCheck size={12} className="mr-1.5 text-emerald-600" />
                                    {admin.performed_by_first_name || 'Inconnu'} {admin.performed_by_last_name || ''}
                                  </div>
                                </div>

                                {/* Bags Info (If ANY) */}
                                {admin.bags && admin.bags.length > 0 && (
                                  <div className="flex flex-wrap gap-2 mt-1">
                                    {admin.bags.map((b: any) => (
                                      <div key={b.blood_bag_id} className="flex items-center bg-white border border-red-100 rounded-md px-2.5 py-1 text-[13px] text-gray-700 shadow-sm">
                                        <Droplet size={12} className="mr-1.5 text-red-500" />
                                        <span className="font-mono font-bold text-gray-900 mr-1.5">{b.bag_number}</span>
                                        <span className="font-medium text-gray-500 mr-2">({b.abo_group}{b.rhesus})</span>
                                        {b.volume_administered_ml > 0 && (
                                          <span className="ml-auto pl-2 border-l border-red-100 text-red-700 font-bold">
                                            {b.volume_administered_ml} ml 
                                            <span className="text-red-400 font-medium ml-1">admin.</span>
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Safety Checks (CULT) */}
                                {admin.checks && (
                                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-2 text-xs bg-white p-2 rounded border border-slate-100">
                                    <span className={`flex items-center font-medium ${admin.checks.identity_check_done ? 'text-emerald-700' : 'text-red-600'}`}>
                                      {admin.checks.identity_check_done ? <CheckCircle2 size={14} className="mr-1 text-emerald-500"/> : <AlertTriangle size={14} className="mr-1 text-red-500"/>}
                                      Identité confirmée
                                    </span>
                                    <span className={`flex items-center font-medium ${admin.checks.compatibility_check_done ? 'text-emerald-700' : 'text-red-600'}`}>
                                      {admin.checks.compatibility_check_done ? <CheckCircle2 size={14} className="mr-1 text-emerald-500"/> : <AlertTriangle size={14} className="mr-1 text-red-500"/>}
                                      CULT conforme
                                    </span>
                                    <span className={`flex items-center font-medium ${admin.checks.bedside_double_check_done ? 'text-emerald-700' : 'text-red-600'}`}>
                                      {admin.checks.bedside_double_check_done ? <CheckCircle2 size={14} className="mr-1 text-emerald-500"/> : <AlertTriangle size={14} className="mr-1 text-red-500"/>}
                                      Double CTRL au lit
                                    </span>
                                    {admin.checks.notes && (
                                      <span className="w-full text-slate-500 italic mt-1 bg-slate-50 p-1.5 rounded text-[11px] border border-slate-100">
                                        Note: {admin.checks.notes}
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* Reaction Data (Only show on 'ended' to avoid duplication in groups, or if no ended exists) */}
                                {admin.reaction && admin.reaction.reaction_type && (admin.action_type === 'ended' || !ev.administrations?.some((a: any) => a.action_type === 'ended')) && (
                                  <div className="mt-1 flex flex-col gap-1 text-xs bg-red-50 p-2.5 rounded border border-red-200">
                                    <span className="flex items-center font-bold text-red-800">
                                      <AlertTriangle size={14} className="mr-1.5 text-red-600"/>
                                      Réaction Transfusionnelle: {admin.reaction.reaction_type}
                                    </span>
                                    {admin.reaction.description && (
                                      <span className="text-red-700 text-[11px] leading-tight mt-0.5 ml-5">
                                        <span className="font-semibold">Détails:</span> {admin.reaction.description}
                                      </span>
                                    )}
                                    {admin.reaction.actions_taken && (
                                      <span className="text-red-700 text-[11px] leading-tight ml-5">
                                        <span className="font-semibold">Actions:</span> {admin.reaction.actions_taken}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400 font-medium italic mt-2">Aucune action enregistrée pour cet événement.</div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500 italic">Aucun événement planifié trouvé.</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-[500px] relative animate-in fade-in duration-300">
      {/* Title */}
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-800 flex items-center">
          <Droplet className="mr-2 text-red-500" size={20} />
          Module de Transfusion Sanguine
        </h3>
        <p className="text-sm text-gray-500">Gestion des poches et préparation à l'administration.</p>
      </div>

      {/* TABS */}
      <div className="flex space-x-2 border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('bags')}
          className={`py-3 px-4 font-bold text-sm border-b-2 transition-colors ${
            activeTab === 'bags' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Poches Reçues ({bags.length})
        </button>
        <button
          onClick={() => setActiveTab('admin')}
          className={`py-3 px-4 font-bold text-sm border-b-2 transition-colors ${
            activeTab === 'admin' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Prescriptions & Traçabilité
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-20 text-emerald-600">
          <Activity className="animate-pulse" size={32} />
        </div>
      ) : (
        activeTab === 'bags' ? renderBagsTab() : renderAdminTab()
      )}

      {/* BAG RECEPTION MODAL */}
      {isBagModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-900 text-white px-5 py-4 flex justify-between items-center">
              <h3 className="font-bold flex items-center">
                <Droplet size={18} className="mr-2 text-red-400" />
                Réception d'une Poche
              </h3>
              <button onClick={() => setIsBagModalOpen(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
               <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Type de Produit</label>
                  <select name="blood_product_code" value={bagFormData.blood_product_code} onChange={handleBagInputChange} className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 font-medium">
                     <option value="CGR">C.G.R (Concentré de Globules Rouges)</option>
                     <option value="PFC">P.F.C (Plasma Frais Congelé)</option>
                     <option value="PLAQUETTES">Plaquettes</option>
                     <option value="CRYO">Cryoprécipité</option>
                  </select>
               </div>
               
               <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Numéro de Poche</label>
                  <input type="text" name="bag_number" placeholder="Ex: 00493822" value={bagFormData.bag_number} onChange={handleBagInputChange} className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 font-mono font-bold" />
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Groupe ABO</label>
                    <select name="abo_group" value={bagFormData.abo_group} onChange={handleBagInputChange} className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 font-bold">
                       <option value="O">O</option>
                       <option value="A">A</option>
                       <option value="B">B</option>
                       <option value="AB">AB</option>
                    </select>
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Rhésus</label>
                    <select name="rhesus" value={bagFormData.rhesus} onChange={handleBagInputChange} className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 font-bold">
                       <option value="+">+</option>
                       <option value="-">-</option>
                    </select>
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Volume (ml) *</label>
                    <input type="number" name="volume_ml" placeholder="Obligatoire" value={bagFormData.volume_ml} onChange={handleBagInputChange} className="w-full rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 bg-red-50 border-red-200" required />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Date d'expiration</label>
                    <input type="date" name="expiry_at" value={bagFormData.expiry_at} onChange={handleBagInputChange} className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500" />
                 </div>
               </div>

               <div>
                 <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Note (Optionnel)</label>
                 <textarea name="notes" placeholder="Remarques..." value={bagFormData.notes} onChange={handleBagInputChange} className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-emerald-500 focus:border-emerald-500 h-20 text-sm" />
               </div>
            </div>

            <div className="bg-gray-50 border-t border-gray-200 p-4 flex justify-end space-x-3">
               <button onClick={() => setIsBagModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                 Annuler
               </button>
               <button 
                 onClick={handleSaveBag}
                 disabled={!bagFormData.bag_number || !bagFormData.blood_product_code || !bagFormData.volume_ml}
                 className="px-4 py-2 text-sm font-bold text-white bg-emerald-600 rounded-lg shadow-sm flex items-center hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 <Save size={16} className="mr-2" />
                 Enregistrer
               </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Administration Modal --- */}
      <AdministrationModal
        isOpen={adminModal.isOpen}
        onClose={closeAdminModal}
        onSave={handleSaveAdministration}
        onCancelEvent={handleCancelAdminEvent}
        prescriptionName={adminModal.prescriptionName}
        slotTime={adminModal.slotTime}
        duration={adminModal.duration}
        requiresEndEvent={true}
        activePerfusionEvent={adminModal.activePerfusionEvent}
        historyEvents={adminModal.historyEvents}
        isTransfusion={adminModal.isTransfusion}
        availableBags={bags}
        eventId={adminModal.eventId}
      />

    </div>
  );
};