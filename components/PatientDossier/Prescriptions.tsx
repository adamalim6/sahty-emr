import React, { useState, useEffect } from 'react';
import { PlusCircle, X, Ban } from 'lucide-react';
import { PrescriptionForm } from '../Prescription/PrescriptionForm';
import { FormData } from '../Prescription/types';
import { PrescriptionCard } from '../Prescription/PrescriptionCard';
import { api } from '../../services/api';

interface PrescriptionsProps {
  patientId: string;
}

export const Prescriptions: React.FC<PrescriptionsProps> = ({ patientId }) => {
  const [showModal, setShowModal] = useState(false);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Load prescriptions from API on component mount
  useEffect(() => {
    const loadPrescriptions = async () => {
      try {
        setLoading(true);
        const data = await api.getPrescriptions(patientId);
        setPrescriptions(data);
      } catch (error) {
        console.error('Failed to load prescriptions:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPrescriptions();
  }, [patientId]);

  const handleSavePrescription = async (data: FormData) => {
    try {
      const newPrescription = await api.createPrescription(patientId, data);
      setPrescriptions(prev => [...prev, newPrescription]);
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

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 min-h-[400px] flex items-center justify-center">
        <div className="text-gray-400">Chargement des prescriptions...</div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 min-h-[400px]">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-800">Prescriptions</h3>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors font-medium border border-emerald-100"
        >
          <PlusCircle size={20} />
          <span>Médicament</span>
        </button>
      </div>

      {prescriptions.length === 0 ? (
        <div className="text-gray-400 italic">Aucune donnée disponible pour le moment.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-300">
          {prescriptions.map((p, idx) => (
            <div key={p.id} className="relative group p-4 border border-slate-200 rounded-xl hover:border-emerald-200 hover:shadow-md transition-all">
              <button
                onClick={() => handleRemovePrescription(p.id, idx)}
                className="absolute top-2 right-2 p-1.5 bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-all z-10"
                title="Supprimer"
              >
                <X className="w-4 h-4" />
              </button>
              <PrescriptionCard formData={p.data} />
              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                <button
                  className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm active:scale-95"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Placeholder action
                    console.log("Ne pas dispenser:", p);
                  }}
                >
                  <Ban className="w-4 h-4" />
                  <span>Ne pas dispenser</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-hidden animate-in fade-in duration-200">
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col relative animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">Nouvelle Prescription</h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
                title="Fermer"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
              <PrescriptionForm onSave={handleSavePrescription} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};