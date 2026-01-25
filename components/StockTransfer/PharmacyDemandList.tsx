import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { FileText, Clock, AlertTriangle, CheckCircle, ArrowRight, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Demand {
    id: string;
    service_id: string; // Need to map to name
    status: string;
    priority: string;
    created_at: string;
    requested_by: string;
    items?: any[];
}

const PharmacyDemandList: React.FC = () => {
    const navigate = useNavigate();
    const [demands, setDemands] = useState<Demand[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('ALL');

    useEffect(() => {
        loadDemands();
    }, []);

    const loadDemands = async () => {
        setLoading(true);
        try {
            const data = await api.getStockDemands();
            setDemands(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const filteredDemands = demands.filter(d => {
        if (filterStatus === 'ALL') return d.status !== 'FILLED' && d.status !== 'CANCELLED'; // Default view: active
        if (filterStatus === 'HISTORY') return d.status === 'FILLED' || d.status === 'CANCELLED' || d.status === 'REJECTED';
        return d.status === filterStatus;
    }).sort((a, b) => {
        if (a.priority === 'URGENT' && b.priority !== 'URGENT') return -1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'DRAFT': return <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">Brouillon</span>;
            case 'SUBMITTED': return <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-600">À Traiter</span>;
            case 'PARTIALLY_FILLED': return <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-600">En Cours</span>;
            case 'FILLED': return <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-600">Terminé</span>;
            case 'REJECTED': return <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-600">Rejeté</span>;
            default: return <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{status}</span>;
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
                <div className="flex gap-2">
                    <button 
                        onClick={() => setFilterStatus('ALL')}
                        className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${filterStatus === 'ALL' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        À Traiter
                    </button>
                    <button 
                         onClick={() => setFilterStatus('HISTORY')}
                         className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${filterStatus === 'HISTORY' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Historique
                    </button>
                </div>
                <button onClick={loadDemands} className="text-sm text-blue-600 hover:underline">Actualiser</button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b">
                        <tr>
                            <th className="p-4 font-semibold text-slate-700">Priorité</th>
                            <th className="p-4 font-semibold text-slate-700">Service</th>
                            <th className="p-4 font-semibold text-slate-700">Date</th>
                            <th className="p-4 font-semibold text-slate-700">Demandeur</th>
                            <th className="p-4 font-semibold text-slate-700">Statut</th>
                            <th className="p-4 font-semibold text-slate-700 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {loading ? (
                            <tr><td colSpan={6} className="p-8 text-center text-slate-400">Chargement...</td></tr>
                        ) : filteredDemands.length === 0 ? (
                            <tr><td colSpan={6} className="p-8 text-center text-slate-400 italic">Aucune demande à afficher.</td></tr>
                        ) : (
                            filteredDemands.map(demand => (
                                <tr key={demand.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="p-4">
                                        {demand.priority === 'URGENT' ? (
                                            <span className="flex items-center gap-1 text-red-600 font-bold text-xs bg-red-50 px-2 py-1 rounded w-fit">
                                                <AlertTriangle size={14} /> URGENT
                                            </span>
                                        ) : (
                                            <span className="text-slate-500 text-xs px-2">Normal</span>
                                        )}
                                    </td>
                                    <td className="p-4 font-medium text-slate-800">{demand.service_id}</td>
                                    <td className="p-4 text-slate-500 text-xs">
                                        {new Date(demand.created_at).toLocaleDateString()} <br/>
                                        {new Date(demand.created_at).toLocaleTimeString().slice(0,5)}
                                    </td>
                                    <td className="p-4 text-slate-600">{demand.requested_by}</td>
                                    <td className="p-4">{getStatusBadge(demand.status)}</td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            {demand.status === 'SUBMITTED' && (
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(`/pharmacy/processing/${demand.id}`);
                                                    }}
                                                    className="px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1"
                                                >
                                                    <CheckCircle size={14} /> Préparer
                                                </button>
                                            )}
                                        </div>
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

export default PharmacyDemandList;
