import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Construction } from 'lucide-react';

export const ReceptionDecisionPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    return (
        <div className="max-w-4xl mx-auto mt-10 p-6 bg-white rounded-xl shadow-sm border border-slate-200 text-center">
            <button 
                onClick={() => navigate(-1)} 
                className="mb-6 flex items-center text-slate-500 hover:text-slate-800 transition-colors"
            >
                <ArrowLeft size={20} className="mr-2" />
                Retour
            </button>
            
            <div className="flex justify-center mb-6">
                <div className="bg-amber-100 p-4 rounded-full">
                    <Construction size={48} className="text-amber-600" />
                </div>
            </div>
            
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Gestion de la Réception</h1>
            <p className="text-slate-500 mb-6">
                ID Réception: <span className="font-mono bg-slate-100 px-2 py-1 rounded">{id}</span>
            </p>
            
            <div className="bg-slate-50 p-6 rounded-lg text-left">
                <h3 className="font-semibold text-slate-800 mb-2">Fonctionnalité à venir</h3>
                <p className="text-slate-600">
                    Cette page sera utilisée pour les décisions relatives au stock retourné :
                </p>
                <ul className="list-disc list-inside mt-2 text-slate-600 space-y-1">
                    <li>Réintégration en stock commercial</li>
                    <li>Mise en quarantaine</li>
                    <li>Destruction</li>
                    <li>Don / Stock Caritatif</li>
                </ul>
            </div>
        </div>
    );
};
