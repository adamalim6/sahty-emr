import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { FileText, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DemandList: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [demands, setDemands] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDemands();
    }, []);

    const loadDemands = async () => {
        try {
            const data = await api.getStockDemands();
            setDemands(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'DRAFT': return <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">Brouillon</span>;
            case 'SUBMITTED': return <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-600">Transmis</span>;
            case 'FILLED': return <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-600">Servi</span>;
            case 'PARTIALLY_FILLED': return <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-600">Partiel</span>;
            case 'REJECTED': return <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-600">Rejeté</span>;
            default: return <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{status}</span>;
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-slate-500" />
                    Historique des Demandes
                </h2>
                <button 
                    onClick={loadDemands}
                    className="text-sm text-blue-600 hover:underline"
                >
                    Actualiser
                </button>
            </div>

            {loading ? (
                <div className="p-8 text-center text-slate-400">Chargement...</div>
            ) : demands.length === 0 ? (
                <div className="p-8 text-center text-slate-400 italic">Aucune demande trouvée.</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b">
                            <tr>
                                <th className="p-3 font-semibold text-slate-700">Date</th>
                                <th className="p-3 font-semibold text-slate-700">N° Demande</th>
                                <th className="p-3 font-semibold text-slate-700">Service</th>
                                <th className="p-3 font-semibold text-slate-700">Priorité</th>
                                <th className="p-3 font-semibold text-slate-700">Statut</th>
                                <th className="p-3 font-semibold text-slate-700">Demandeur</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {demands.map((demand) => (
                                <tr 
                                    key={demand.id} 
                                    className="hover:bg-slate-50 cursor-pointer"
                                    onClick={() => navigate(`/service-stock/demands/${demand.id}`)}
                                >
                                    <td className="p-3 text-slate-600">
                                        {new Date(demand.created_at).toLocaleDateString()} {new Date(demand.created_at).toLocaleTimeString().slice(0,5)}
                                    </td>
                                    <td className="p-3 font-mono text-xs text-slate-500">{demand.id.slice(0, 8)}...</td>
                                    <td className="p-3 font-medium">{demand.service_id}</td> {/* TODO: Resolve name */}
                                    <td className="p-3">
                                        {demand.priority === 'URGENT' ? (
                                            <span className="flex items-center gap-1 text-red-600 font-bold text-xs">
                                                <AlertTriangle className="w-3 h-3" /> URGENT
                                            </span>
                                        ) : (
                                            <span className="text-slate-500 text-xs">Normal</span>
                                        )}
                                    </td>
                                    <td className="p-3">{getStatusBadge(demand.status)}</td>
                                    <td className="p-3 text-slate-500 text-xs">{demand.requested_by}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default DemandList;
