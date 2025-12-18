import React, { useState } from 'react';
import { MOCK_PATIENTS } from '../constants';
import { X, Bed } from 'lucide-react';

import { api } from '../services/api';
import { Room } from '../types';

export const WardMap: React.FC = () => {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);

  React.useEffect(() => {
    api.getRooms().then(setRooms).catch(console.error);
  }, []);

  const getRoom = (id: string) => rooms.find(r => r.id === id);
  const getPatient = (id?: string) => id ? MOCK_PATIENTS.find(p => p.id === id) : null;

  const selectedRoom = selectedRoomId ? getRoom(selectedRoomId) : null;
  const selectedPatient = selectedRoom?.patientId ? getPatient(selectedRoom.patientId) : null;

  // Group rooms by section
  const sections = Array.from(new Set(rooms.map(r => r.section)));

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col md:flex-row gap-6">
      <div className="flex-1 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Plan du Service</h2>
          <p className="text-gray-500">Visualisation de l'occupation des lits en temps réel.</p>
        </div>

        <div className="space-y-8">
          {sections.map(section => (
            <div key={section} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">{section}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {rooms.filter(r => r.section === section).map(room => (
                  <button
                    key={room.id}
                    onClick={() => setSelectedRoomId(room.id)}
                    className={`
                      relative h-32 rounded-lg border-2 flex flex-col items-center justify-center transition-all duration-200
                      ${room.isOccupied
                        ? 'bg-red-50 border-red-200 hover:bg-red-100 hover:border-red-300'
                        : 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300'
                      }
                      ${selectedRoomId === room.id ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}
                    `}
                  >
                    <div className="absolute top-2 left-2 text-xs font-bold text-gray-500">
                      #{room.number}
                    </div>
                    <Bed size={32} className={`mb-2 ${room.isOccupied ? 'text-red-500' : 'text-emerald-500'}`} />
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${room.isOccupied ? 'bg-red-200 text-red-800' : 'bg-emerald-200 text-emerald-800'}`}>
                      {room.isOccupied ? 'Occupée' : 'Libre'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Details Panel */}
      {selectedRoom && (
        <div className="w-full md:w-80 bg-white border-l border-gray-200 shadow-xl p-6 overflow-y-auto fixed right-0 top-16 bottom-0 md:static md:h-full md:rounded-xl md:border">
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-xl font-bold text-gray-900">Chambre {selectedRoom.number}</h3>
            <button onClick={() => setSelectedRoomId(null)} className="text-gray-400 hover:text-gray-600 md:hidden">
              <X />
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <p className="text-sm text-gray-500">Type de chambre</p>
              <p className="font-medium text-gray-900 capitalize">{selectedRoom.type}</p>
            </div>

            <div>
              <p className="text-sm text-gray-500">Statut</p>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${selectedRoom.isOccupied ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>
                {selectedRoom.isOccupied ? 'Occupée' : 'Disponible'}
              </span>
            </div>

            {selectedRoom.isOccupied && selectedPatient ? (
              <div className="border-t border-gray-100 pt-6">
                <h4 className="font-semibold text-gray-900 mb-4">Patient Occupant</h4>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-lg font-bold text-indigo-700">{selectedPatient.lastName} {selectedPatient.firstName}</p>
                  <p className="text-sm text-gray-600 mt-1">IPP: {selectedPatient.ipp}</p>
                  <p className="text-sm text-gray-600">Né(e) le: {selectedPatient.dateOfBirth}</p>
                </div>
                <button className="mt-4 w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
                  Voir Dossier Médical
                </button>
              </div>
            ) : (
              selectedRoom.isOccupied && (
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 text-yellow-800 text-sm">
                  Chambre marquée occupée mais données patient indisponibles.
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};
