import React, { useState, useEffect } from 'react';
import { FileSignature, Users, ChevronLeft, Calendar, User, IdCard, Loader2 } from 'lucide-react';
import { api, PatientWithPrescriptions } from '../../services/api';
import { PrescriptionCard } from '../Prescription/PrescriptionCard';
import { DispensationForm } from '../Prescription/DispensationForm';
import { DispensationHistory } from '../Prescription/DispensationHistory';

type ViewType = 'patient-list' | 'patient-prescriptions';

export const PrescriptionManager: React.FC = () => {
  const [view, setView] = useState<ViewType>('patient-list');
  const [patients, setPatients] = useState<PatientWithPrescriptions[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load patients with prescriptions on mount
  useEffect(() => {
    loadPatientsWithPrescriptions();
  }, []);

  // Load prescriptions when a patient is selected
  useEffect(() => {
    if (selectedPatientId && view === 'patient-prescriptions') {
      loadPatientPrescriptions(selectedPatientId);
    }
  }, [selectedPatientId, view]);

  const loadPatientsWithPrescriptions = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getPatientsWithPrescriptions();
      setPatients(data);
    } catch (err) {
      console.error('Failed to load patients with prescriptions:', err);
      setError('Impossible de charger la liste des patients');
    } finally {
      setLoading(false);
    }
  };

  const loadPatientPrescriptions = async (patientId: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getPrescriptions(patientId);
      const allPrescriptions = Array.isArray(data) ? data : [];
      // Filter out biology prescriptions for Pharmacy view
      const pharmacyPrescriptions = allPrescriptions.filter((p: any) => {
        const pData = p.data || p; // Handle potential wrapped/unwrapped structure
        return pData.prescriptionType !== 'biology';
      });
      setPrescriptions(pharmacyPrescriptions);
    } catch (err) {
      console.error('Failed to load prescriptions:', err);
      setError('Impossible de charger les prescriptions');
    } finally {
      setLoading(false);
    }
  };

  const handlePatientClick = (patientId: string) => {
    setSelectedPatientId(patientId);
    setView('patient-prescriptions');
  };

  const handleBackToList = () => {
    setView('patient-list');
    setSelectedPatientId(null);
    setPrescriptions([]);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  // Refresh trigger for history
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  // Patient List View
  if (view === 'patient-list') {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Prescriptions</h2>
            <p className="text-slate-500 text-sm">Gestion des ordonnances et dispensation patient.</p>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-16 text-center">
            <Loader2 size={48} className="text-slate-300 animate-spin mx-auto mb-4" />
            <p className="text-slate-400">Chargement des patients...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl shadow-sm border border-red-200 p-16 text-center">
            <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileSignature size={32} className="text-red-400" />
            </div>
            <h3 className="text-lg font-medium text-red-900">Erreur</h3>
            <p className="text-red-600 mt-2">{error}</p>
          </div>
        ) : patients.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-16 text-center">
            <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users size={32} className="text-slate-300" />
            </div>
            <h3 className="text-lg font-medium text-slate-900">Aucune prescription</h3>
            <p className="text-slate-400 mt-2">Aucun patient n'a de prescription pour le moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {patients.map((patient) => (
              <button
                key={patient.id}
                onClick={() => handlePatientClick(patient.id)}
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-left hover:border-emerald-300 hover:shadow-md transition-all group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                      <User size={24} className="text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 text-lg">
                        {patient.firstName} {patient.lastName}
                      </h3>
                      <p className="text-sm text-slate-500">IPP: {patient.ipp}</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                    {patient.prescriptionCount} Rx
                  </span>
                </div>

                <div className="space-y-2 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <User size={16} className="text-slate-400" />
                    <span>{patient.gender}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-slate-400" />
                    <span>Né(e) le {formatDate(patient.dateOfBirth)}</span>
                  </div>
                  {patient.cin && (
                    <div className="flex items-center gap-2">
                      <IdCard size={16} className="text-slate-400" />
                      <span>CIN: {patient.cin}</span>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Patient Prescriptions View
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-4">
        <button
          onClick={handleBackToList}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          title="Retour à la liste"
        >
          <ChevronLeft size={24} className="text-slate-600" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Prescriptions - {selectedPatient?.firstName} {selectedPatient?.lastName}
          </h2>
          <p className="text-slate-500 text-sm">
            IPP: {selectedPatient?.ipp} • {selectedPatient?.prescriptionCount} prescription(s)
          </p>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-16 text-center">
          <Loader2 size={48} className="text-slate-300 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Chargement des prescriptions...</p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl shadow-sm border border-red-200 p-16 text-center">
          <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileSignature size={32} className="text-red-400" />
          </div>
          <h3 className="text-lg font-medium text-red-900">Erreur</h3>
          <p className="text-red-600 mt-2">{error}</p>
        </div>
      ) : prescriptions.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-16 text-center">
          <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileSignature size={32} className="text-slate-300" />
          </div>
          <h3 className="text-lg font-medium text-slate-900">Aucune prescription</h3>
          <p className="text-slate-400 mt-2">Ce patient n'a aucune prescription pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-8 max-w-7xl mx-auto pb-10">
          {prescriptions.map((prescription: any) => {
            if (!prescription) return null;
            // Support both wrapped (backend) and unwrapped (local/mock) formats
            const prescriptionData = prescription.data || prescription;

            return (
              <div
                key={prescription.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6"
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* LEFT ZONE: Prescription + History */}
                  <div className="lg:col-span-5 space-y-6">
                    {/* Zone 1: Prescription Details */}
                    <div className="bg-white rounded-lg">
                      <PrescriptionCard formData={prescriptionData} />
                    </div>

                    {/* Zone 3: Dispensation History */}
                    <div className="rounded-xl overflow-hidden pt-4">
                      <h4 className="text-sm font-bold text-slate-800 mb-3 ml-1">Dispensé</h4>
                      <div className="bg-slate-100 rounded-lg p-3">
                        <DispensationHistory
                          prescriptionId={prescription.id}
                          compact={true}
                          lastUpdate={historyRefreshKey}
                        />
                      </div>
                    </div>
                  </div>

                  {/* RIGHT ZONE: Dispensation Form */}
                  <div className="lg:col-span-7">
                    <div className="h-full border border-slate-200 rounded-xl bg-slate-50 overflow-hidden">
                      <DispensationForm
                        prescription={prescription}
                        product={prescriptionData.product || {
                          // Fallback product if not in prescription data (should be improved in real app)
                          id: prescription.productId || 'unknown',
                          isSubdivisable: true,
                          profitMargin: 25,
                          vatRate: 5.5,
                          suppliers: [{ purchasePrice: 10 }]
                        }}
                        onSuccess={() => {
                          setHistoryRefreshKey(prev => prev + 1);
                          if (selectedPatientId) loadPatientPrescriptions(selectedPatientId);
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
