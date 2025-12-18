import React, { useState } from 'react';
import { MOCK_PATIENTS } from '../constants';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalIcon } from 'lucide-react';

type ViewMode = 'day' | 'week' | 'month';

import { api } from '../services/api';
import { Appointment } from '../types';

export const CalendarView: React.FC = () => {
  const [view, setView] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  React.useEffect(() => {
    api.getAppointments().then(setAppointments).catch(console.error);
  }, []);

  const getPatientName = (id: string) => {
    const p = MOCK_PATIENTS.find(pat => pat.id === id);
    return p ? `${p.lastName} ${p.firstName}` : 'Inconnu';
  };

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const totalDays = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month); // 0 = Sun
    // Adjust for Monday start if needed, defaulting to Sunday start for simplicity

    const daysArray = Array.from({ length: 42 }, (_, i) => {
      const dayNum = i - startDay + 1;
      if (dayNum > 0 && dayNum <= totalDays) return dayNum;
      return null;
    });

    return (
      <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden">
        {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map(d => (
          <div key={d} className="bg-gray-50 py-2 text-center text-sm font-semibold text-gray-500 uppercase">
            {d}
          </div>
        ))}
        {daysArray.map((day, idx) => {
          // Filter appointments for this day
          const dayApps = day ? appointments.filter(app => {
            const appDate = new Date(app.dateTime);
            return appDate.getDate() === day && appDate.getMonth() === month && appDate.getFullYear() === year;
          }) : [];

          return (
            <div key={idx} className={`min-h-[120px] bg-white p-2 ${!day ? 'bg-gray-50' : ''} hover:bg-gray-50 transition-colors`}>
              {day && (
                <>
                  <span className={`text-sm font-medium ${day === new Date().getDate() && month === new Date().getMonth()
                    ? 'bg-emerald-600 text-white w-6 h-6 flex items-center justify-center rounded-full'
                    : 'text-gray-700'
                    }`}>
                    {day}
                  </span>
                  <div className="mt-2 space-y-1">
                    {dayApps.map(app => (
                      <div key={app.id} className="text-xs p-1.5 rounded bg-blue-50 border border-blue-100 text-blue-800 truncate cursor-pointer hover:bg-blue-100">
                        <span className="font-bold">{new Date(app.dateTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span> {getPatientName(app.patientId)}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          <CalIcon className="mr-3 text-emerald-600" />
          Calendrier
        </h2>
        <div className="flex items-center space-x-2 bg-white rounded-lg shadow-sm p-1 border border-gray-200">
          <button
            onClick={() => setView('day')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md ${view === 'day' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            Jour
          </button>
          <button
            onClick={() => setView('week')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md ${view === 'week' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            Semaine
          </button>
          <button
            onClick={() => setView('month')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md ${view === 'month' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            Mois
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <button className="p-2 hover:bg-gray-100 rounded-full" onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}>
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <h3 className="text-lg font-bold text-gray-800 capitalize">
              {currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </h3>
            <button className="p-2 hover:bg-gray-100 rounded-full" onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}>
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </button>
          </div>
          <button className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm text-sm font-medium">
            <Plus size={16} />
            <span>Nouveau RDV</span>
          </button>
        </div>

        {view === 'month' ? renderMonthView() : (
          <div className="h-96 flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <p className="text-gray-500">Vue {view === 'day' ? 'journalière' : 'hebdomadaire'} en construction. Veuillez utiliser la vue mensuelle.</p>
          </div>
        )}
      </div>
    </div>
  );
};
