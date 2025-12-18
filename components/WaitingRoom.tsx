import React from 'react';
import { MOCK_APPOINTMENTS, MOCK_PATIENTS } from '../constants';
import { Clock, UserCheck, AlertCircle, PlayCircle } from 'lucide-react';

export const WaitingRoom: React.FC = () => {
  const todayStr = new Date().toISOString().split('T')[0];
  
  // Filter for today
  const todaysAppointments = MOCK_APPOINTMENTS.filter(app => app.dateTime.startsWith(todayStr))
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

  const getPatient = (id: string) => MOCK_PATIENTS.find(pat => pat.id === id);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'arrived':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><UserCheck size={12} className="mr-1"/> Arrivé</span>;
      case 'late':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><AlertCircle size={12} className="mr-1"/> En retard</span>;
      case 'in-progress':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"><PlayCircle size={12} className="mr-1"/> En cours</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"><Clock size={12} className="mr-1"/> Prévu</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Salle d'Attente</h2>
          <p className="text-gray-500">Flux des patients pour {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}.</p>
        </div>
        <div className="text-right">
            <p className="text-3xl font-bold text-emerald-600">{todaysAppointments.length}</p>
            <p className="text-sm text-gray-500">RDV Aujourd'hui</p>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Heure</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Médecin</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {todaysAppointments.map((app) => {
              const patient = getPatient(app.patientId);
              return (
                <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                    {new Date(app.dateTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs mr-3">
                         {patient?.firstName[0]}{patient?.lastName[0]}
                      </div>
                      <div className="text-sm font-medium text-gray-900">{patient?.lastName} {patient?.firstName}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {app.service}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {app.doctorName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(app.status)}
                  </td>
                </tr>
              );
            })}
            {todaysAppointments.length === 0 && (
               <tr>
                 <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                   Aucun rendez-vous prévu pour aujourd'hui.
                 </td>
               </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
