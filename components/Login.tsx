import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Activity, Zap } from 'lucide-react';

export const Login: React.FC = () => {
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleDoctorLogin = () => {
        login('DOCTOR');
        navigate('/');
    };

    const handlePharmacistLogin = () => {
        login('PHARMACIST');
        navigate('/pharmacy');
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md space-y-8 text-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Bienvenue</h1>
                    <p className="text-slate-500">Choisir votre portail d'accès</p>
                </div>

                <div className="space-y-4">
                    <button
                        onClick={handleDoctorLogin}
                        className="w-full group relative flex items-center justify-center p-4 border-2 border-emerald-100 hover:border-emerald-500 rounded-xl transition-all hover:shadow-md bg-emerald-50/50 hover:bg-emerald-50"
                    >
                        <div className="flex items-center space-x-4">
                            <div className="bg-emerald-100 p-3 rounded-full group-hover:bg-emerald-200 transition-colors">
                                <Activity className="h-6 w-6 text-emerald-600" />
                            </div>
                            <div className="text-left">
                                <p className="font-bold text-slate-800">Portail Médecin</p>
                                <p className="text-sm text-slate-500">Accès dossiers patients (EMR)</p>
                            </div>
                        </div>
                    </button>

                    <button
                        onClick={handlePharmacistLogin}
                        className="w-full group relative flex items-center justify-center p-4 border-2 border-blue-100 hover:border-blue-500 rounded-xl transition-all hover:shadow-md bg-blue-50/50 hover:bg-blue-50"
                    >
                        <div className="flex items-center space-x-4">
                            <div className="bg-blue-100 p-3 rounded-full group-hover:bg-blue-200 transition-colors">
                                <Zap className="h-6 w-6 text-blue-600" />
                            </div>
                            <div className="text-left">
                                <p className="font-bold text-slate-800">Portail Pharmacie</p>
                                <p className="text-sm text-slate-500">Gestion de stock et ordonnances</p>
                            </div>
                        </div>
                    </button>
                </div>

                <div className="text-xs text-slate-400 mt-8">
                    Système Hospitalier Intégré V2.0
                </div>
            </div>
        </div>
    );
};
