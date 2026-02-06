import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, Calendar, User, ArrowRight, Loader, AlertTriangle, CheckCircle 
} from 'lucide-react';

export const ReturnReceptionsPage: React.FC = () => {
    const navigate = useNavigate();
    const [returns, setReturns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadReturns();
    }, []);

    const loadReturns = async () => {
        setLoading(true);
        try {
            // Fetch all returns (SUBMITTED, PARTIALLY_RECEIVED, CLOSED)
            const data = await api.getPharmacyReturns();
            setReturns(data);
        } catch (err: any) {
            console.error(err);
            setError("Impossible de charger les retours.");
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('fr-FR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    if (loading) return (
        <div className="flex justify-center items-center h-64">
            <Loader className="animate-spin text-blue-600" size={32} />
        </div>
    );

    if (error) return (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center space-x-2">
            <AlertTriangle size={20} />
            <span>{error}</span>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Réception des Retours</h1>
                    <p className="text-slate-500">Gérer les retours physiques en attente de réception</p>
                </div>
                <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg font-medium">
                    {returns.length} retour(s) en attente
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4 font-semibold text-slate-700">Référence</th>
                            <th className="px-6 py-4 font-semibold text-slate-700">Service Source</th>
                            <th className="px-6 py-4 font-semibold text-slate-700">Demandé par</th>
                            <th className="px-6 py-4 font-semibold text-slate-700">Date Création</th>
                            <th className="px-6 py-4 font-semibold text-slate-700">Statut</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {returns.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                    Aucun retour en attente
                                </td>
                            </tr>
                        ) : (
                            returns.map((ret) => (
                                <tr 
                                    key={ret.id} 
                                    className="hover:bg-blue-50 transition-colors cursor-pointer group"
                                    onClick={() => navigate(`/pharmacy/return-receptions/${ret.id}`)}
                                >
                                    <td className="px-6 py-4 font-medium text-slate-900 group-hover:text-blue-700">
                                        <div className="flex items-center space-x-2">
                                            <FileText size={16} className="text-slate-400 group-hover:text-blue-500" />
                                            <span>{ret.return_reference}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600">
                                        {ret.service_name || 'Service Inconnu'}
                                        {ret.source_service_id ? '' : ' (N/A)'} 
                                    </td>
                                    <td className="px-6 py-4 text-slate-600">
                                        <div className="flex items-center space-x-2">
                                            <User size={16} className="text-slate-400" />
                                            <span className="capitalize">
                                                {ret.prenom} {ret.nom}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600">
                                        <div className="flex items-center space-x-2">
                                            <Calendar size={16} className="text-slate-400" />
                                            <span>{formatDate(ret.created_at)}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                                            {ret.status}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
