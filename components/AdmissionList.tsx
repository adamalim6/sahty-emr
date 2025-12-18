
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MOCK_PATIENTS, calculateDuration } from '../constants';
import { Clock, Activity, FileText, Plus } from 'lucide-react';
import { AdmissionWizard } from './AdmissionWizard';

import { api } from '../services/api';
import { Admission } from '../types';

export const AdmissionList: React.FC = () => {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const navigate = useNavigate();

  React.useEffect(() => {
    api.getAdmissions().then(setAdmissions).catch(console.error);
  }, []);

  const getPatientName = (id: string) => {
    const p = MOCK_PATIENTS.find(pat => pat.id === id);
    return p ? `${p.firstName} ${p.lastName}` : 'Inconnu';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Admissions en Cours</h2>
          <p className="text-gray-500">Suivi des hospitalisations et durées de séjour.</p>
        </div>

        <button
          onClick={() => setIsWizardOpen(true)}
          className="flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-emerald-600/20 active:scale-95 whitespace-nowrap"
        >
          <Plus size={20} />
          <span>Nouvelle Admission</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {admissions.map(admission => (
          <div
            key={admission.id}
            onClick={() => navigate(`/admission/${admission.id}`)}
            className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:border-emerald-200 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-6 cursor-pointer group"
          >

            <div className="flex items-start space-x-4">
              <div className="bg-blue-50 p-3 rounded-lg text-blue-600 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                <FileText size={24} />
              </div>
              <div>
                <div className="flex items-center space-x-3 mb-1">
                  <h3 className="text-lg font-bold text-gray-900">{getPatientName(admission.patientId)}</h3>
                  <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                    {admission.nda}
                  </span>
                </div>
                <div className="text-sm text-gray-600 flex items-center space-x-2">
                  <Activity size={14} />
                  <span>{admission.reason}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 md:gap-8 text-sm">
              <div className="flex flex-col">
                <span className="text-gray-500 text-xs uppercase tracking-wider font-bold">Service</span>
                <span className="font-semibold text-gray-800">{admission.service}</span>
              </div>

              <div className="flex flex-col">
                <span className="text-gray-500 text-xs uppercase tracking-wider font-bold">Médecin</span>
                <span className="font-semibold text-gray-800">{admission.doctorName}</span>
              </div>

              <div className="flex flex-col">
                <span className="text-gray-500 text-xs uppercase tracking-wider font-bold">Date d'entrée</span>
                <span className="font-semibold text-gray-800">{new Date(admission.admissionDate).toLocaleDateString('fr-FR')}</span>
              </div>
            </div>

            <div className="flex items-center">
              <div className="bg-orange-50 text-orange-700 px-4 py-2 rounded-full font-bold text-sm flex items-center shadow-sm">
                <Clock size={16} className="mr-2" />
                {calculateDuration(admission.admissionDate)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Wizard Modal */}
      <AdmissionWizard isOpen={isWizardOpen} onClose={() => setIsWizardOpen(false)} />
    </div>
  );
};
