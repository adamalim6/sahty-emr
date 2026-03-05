
import React, { useState, useEffect } from 'react';
import { PlusCircle, X, Ban, TestTube, Image, Stethoscope, Scan, Droplet } from 'lucide-react';
import { PrescriptionForm } from '../Prescription/PrescriptionForm';
import { BiologyPrescriptionForm } from '../Prescription/BiologyPrescriptionForm';
import { ImageryPrescriptionForm } from '../Prescription/ImageryPrescriptionForm';
import { CarePrescriptionForm } from '../Prescription/CarePrescriptionForm';
import { TransfusionPrescriptionForm } from '../Prescription/TransfusionPrescriptionForm';
import { FormData } from '../Prescription/types';
import { PrescriptionCard } from '../Prescription/PrescriptionCard';
import { api } from '../../services/api';
import { generateDoseSchedule } from '../Prescription/utils';
import { Search, Filter, CalendarCheck, Activity } from 'lucide-react';

interface PrescriptionsProps {
  patientId: string;
}

export const Prescriptions: React.FC<PrescriptionsProps> = ({ patientId }) => {
  const [showModal, setShowModal] = useState(false);
  const [formMode, setFormMode] = useState<'medication' | 'biology' | 'imagery' | 'care' | 'transfusion'>('medication');
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [unitsList, setUnitsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'medication' | 'biology' | 'imagery' | 'care' | 'transfusion'>('all');
  const [showTodayOnly, setShowTodayOnly] = useState(false);
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Load prescriptions from API on component mount
  useEffect(() => {
    const loadPrescriptions = async () => {
      try {
        setLoading(true);
        const [data, unitsData] = await Promise.all([
            api.getPrescriptions(patientId),
            api.getUnits().catch(() => [])
        ]);
        setPrescriptions(data);
        setUnitsList(unitsData);
      } catch (error) {
        console.error('Failed to load prescriptions:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPrescriptions();
  }, [patientId]);

  const handleSavePrescription = async (data: FormData | FormData[]) => {
    try {
      if (Array.isArray(data)) {
        // Batch creation for Biology exams
        const promises = data.map(item => api.createPrescription(patientId, item));
        const newPrescriptions = await Promise.all(promises);
        setPrescriptions(prev => [...prev, ...newPrescriptions]);
      } else {
        // Single creation for Medication
        const newPrescription = await api.createPrescription(patientId, data);
        setPrescriptions(prev => [...prev, newPrescription]);
      }
      setShowModal(false);
    } catch (error) {
      console.error('Failed to save prescription:', error);
      alert('Erreur lors de la sauvegarde de la prescription');
    }
  };

  const handleRemovePrescription = async (id: string, index: number) => {
    try {
      await api.deletePrescription(id);
      setPrescriptions(prev => prev.filter((_, i) => i !== index));
    } catch (error) {
      console.error('Failed to delete prescription:', error);
      alert('Erreur lors de la suppression de la prescription');
    }
  };

  const handlePause = async (id: string, currentStatus: string) => {
    if (currentStatus === 'STOPPED') {
      alert("Impossible de mettre en pause une prescription arrêtée.");
      return;
    }
    try {
      await api.pausePrescription(id);
      setPrescriptions(prev => prev.map(p => p.id === id ? { ...p, derived_status: 'PAUSED', paused_at: new Date().toISOString() } : p));
    } catch (e) {
      console.error(e);
      alert('Erreur lors de la mise en pause');
    }
  };

  const handleResume = async (id: string, currentStatus: string) => {
    if (currentStatus === 'STOPPED') {
      alert("Impossible de reprendre une prescription arrêtée.");
      return;
    }
    try {
      await api.resumePrescription(id);
      setPrescriptions(prev => prev.map(p => p.id === id ? { ...p, derived_status: 'ACTIVE', paused_at: null } : p));
    } catch (e) {
      console.error(e);
      alert('Erreur lors de la reprise');
    }
  };

  const handleStop = async (id: string) => {
    const reason = window.prompt("Raison de l'arrêt (optionnel) :");
    if (reason === null) return; // user clicked cancel
    try {
      await api.stopPrescription(id, reason);
      setPrescriptions(prev => prev.map(p => p.id === id ? { ...p, derived_status: 'STOPPED', stopped_at: new Date().toISOString(), stopped_reason: reason } : p));
    } catch (e) {
      console.error(e);
      alert('Erreur lors de l\'arrêt');
    }
  };

  const handleOpenMedication = () => {
    setFormMode('medication');
    setShowModal(true);
  };

  const handleOpenBiology = () => {
    setFormMode('biology');
    setShowModal(true);
  };

  const handleOpenImagery = () => {
    setFormMode('imagery');
    setShowModal(true);
  };

  const handleOpenCare = () => {
    setFormMode('care');
    setShowModal(true);
  };

  const handleOpenTransfusion = () => {
    setFormMode('transfusion');
    setShowModal(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-transparent">
      <div className="mb-0">
        <h3 className="text-lg font-semibold text-gray-800 mb-6">Prescriptions</h3>

        {/* File-like Tabs Navigation */}
        <div className="flex items-end gap-1">
          {[
            { id: 'all', label: 'Toutes les Pres.' },
            { id: 'medication', label: 'Médicaments' },
            { id: 'biology', label: 'Biologie' },
            { id: 'imagery', label: 'Imagerie' },
            { id: 'care', label: 'Actes & Soins' },
            { id: 'transfusion', label: 'Transfusions' },
          ].map((tab, index) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`relative px-4 py-2 text-sm font-semibold rounded-t-lg border-t border-x transition-all duration-200 
                            ${isActive
                    ? 'bg-white border-slate-200 text-slate-800 -mb-px z-10 pb-3 shadow-[0_-2px_6px_-2px_rgba(0,0,0,0.05)]'
                    : 'bg-slate-50 border-transparent hover:bg-slate-100 text-slate-500 scale-[0.98] origin-bottom hover:scale-100'
                  } ${index === 0 && isActive ? 'border-l-slate-200' : ''}`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content Area (The "Folder") */}
        <div className={`bg-white rounded-b-xl rounded-tr-xl border border-slate-200 p-6 min-h-[400px] shadow-sm relative z-0 ${activeTab === 'all' ? 'rounded-tl-none' : 'rounded-tl-xl'}`}>

          {/* Filter Bar */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6 pb-6 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowTodayOnly(!showTodayOnly)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${showTodayOnly
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
              >
                <CalendarCheck size={16} />
                <span>Prescriptions du jour</span>
              </button>
              <button
                onClick={() => setShowActiveOnly(!showActiveOnly)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${showActiveOnly
                    ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
              >
                <Activity size={16} />
                <span>Prescriptions actives</span>
              </button>
            </div>

            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>
          </div>

          {/* Contextual Action Buttons */}
          <div className="flex justify-end mb-6 animate-in fade-in slide-in-from-top-1">
            {(activeTab === 'all' || activeTab === 'transfusion') && (
              <button
                onClick={handleOpenTransfusion}
                className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors font-medium border border-rose-100 ml-2"
              >
                <Droplet size={18} />
                <span>Transfusion</span>
              </button>
            )}

            {(activeTab === 'all' || activeTab === 'care') && (
              <button
                onClick={handleOpenCare}
                className="flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition-colors font-medium border border-orange-100 ml-2"
              >
                <Stethoscope size={18} />
                <span>Actes & Soins</span>
              </button>
            )}

            {(activeTab === 'all' || activeTab === 'imagery') && (
              <button
                onClick={handleOpenImagery}
                className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors font-medium border border-purple-100 ml-2"
              >
                <Scan size={18} />
                <span>Imagerie</span>
              </button>
            )}

            {(activeTab === 'all' || activeTab === 'biology') && (
              <button
                onClick={handleOpenBiology}
                className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-medium border border-blue-100 ml-2"
              >
                <TestTube size={18} />
                <span>Biologie</span>
              </button>
            )}

            {(activeTab === 'all' || activeTab === 'medication') && (
              <button
                onClick={handleOpenMedication}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors font-medium border border-emerald-100 ml-2"
              >
                <PlusCircle size={18} />
                <span>Médicament</span>
              </button>
            )}
          </div>

          {/* Filtered List */}
          {(() => {
            const filteredPrescriptions = prescriptions.filter(p => {
              // 1. Tab Filter
              let matchesTab = false;
              if (activeTab === 'all') matchesTab = true;
              else if (activeTab === 'medication') matchesTab = p.data.prescriptionType === 'medication' || !p.data.prescriptionType;
              else matchesTab = p.data.prescriptionType === activeTab;

              if (!matchesTab) return false;

              const schedule = p.data.schedule;
              const type = p.data.prescriptionType || 'medication';

              // 2. Today Filter
              if (showTodayOnly) {
                const scheduleResult = generateDoseSchedule(schedule, type);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const hasDoseToday = scheduleResult.cards.some(c => {
                  const d = new Date(c.date);
                  d.setHours(0, 0, 0, 0);
                  return d.getTime() === today.getTime();
                });
                if (!hasDoseToday) return false;
              }

              // 3. Active Filter
              if (showActiveOnly) {
                const scheduleResult = generateDoseSchedule(schedule, type);
                const now = new Date();
                const hasFutureDoses = scheduleResult.cards.some(c => c.date.getTime() > now.getTime());
                if (!hasFutureDoses) return false; // Basic check: inactive if no future doses
                // Note: Could also check if startDate + duration < now, but dose check handles most cases.
              }

              // 4. Search Filter
              if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const searchableText = [
                  p.data.molecule,
                  p.data.commercialName,
                  p.data.schedule_type,
                  p.data.prescriptionType,
                  p.data.conditionComment
                ].filter(Boolean).join(' ').toLowerCase();

                if (!searchableText.includes(q)) return false;
              }

              return true;
            });

            if (filteredPrescriptions.length === 0) {
              if (filteredPrescriptions.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-12 text-center animate-in fade-in zoom-in-95">
                    <div className="w-12 h-12 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-3">
                      <Filter className="w-6 h-6" />
                    </div>
                    <p className="text-slate-500 font-medium">Aucune prescription correspondant aux filtres.</p>
                    <p className="text-sm text-slate-400 mt-1">Essayez de modifier vos critères de recherche.</p>
                  </div>
                );
              }
            }

            return (
              <div className="flex flex-col gap-4 animate-in fade-in duration-300">
                {filteredPrescriptions.map((p, idx) => (
                  <div key={p.id} className="relative group p-4 border border-slate-200 rounded-xl hover:border-blue-200 hover:shadow-md transition-all bg-white">
                    <button
                      onClick={() => handleRemovePrescription(p.id, idx)}
                      className="absolute top-2 right-2 p-1.5 bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-all z-10"
                      title="Supprimer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <PrescriptionCard
                      formData={p.data}
                      prescription={p}
                      unitsList={unitsList}
                      createdBy={
                        (p.createdByFirstName && p.createdByLastName)
                          ? `${p.createdByFirstName} ${p.createdByLastName}`
                          : undefined
                      }
                      extraContent={
                        <div className="flex gap-2 mt-2">
                          {p.derived_status === 'ACTIVE' && (
                            <>
                              <button onClick={() => handlePause(p.id, p.derived_status)} className="px-3 py-1.5 text-xs font-medium bg-orange-50 text-orange-700 hover:bg-orange-100 rounded-lg transition-colors border border-orange-200">Mettre en pause</button>
                              <button onClick={() => handleStop(p.id)} className="px-3 py-1.5 text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 rounded-lg transition-colors border border-red-200">Arrêter</button>
                            </>
                          )}
                          {p.derived_status === 'PAUSED' && (
                            <>
                              <button onClick={() => handleResume(p.id, p.derived_status)} className="px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200">Reprendre</button>
                              <button onClick={() => handleStop(p.id)} className="px-3 py-1.5 text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 rounded-lg transition-colors border border-red-200">Arrêter</button>
                            </>
                          )}
                        </div>
                      }
                    />
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>
      {showModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-hidden animate-in fade-in duration-200">
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col relative animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">
                {formMode === 'transfusion' ? 'Nouvelle Prescription de Transfusion' : 'Nouvelle Prescription'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
                title="Fermer"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
              {formMode === 'biology' ? (
                <BiologyPrescriptionForm onSave={handleSavePrescription} />
              ) : formMode === 'imagery' ? (
                <ImageryPrescriptionForm onSave={handleSavePrescription} />
              ) : formMode === 'care' ? (
                <CarePrescriptionForm onSave={handleSavePrescription} />
              ) : formMode === 'transfusion' ? (
                <TransfusionPrescriptionForm onSave={handleSavePrescription} />
              ) : (
                <PrescriptionForm onSave={handleSavePrescription} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};