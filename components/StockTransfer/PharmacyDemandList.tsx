import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../services/api';
import { FileText, AlertTriangle, CheckCircle, Search, X, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ErgonomicDatePicker } from '../ui/ErgonomicDatePicker';

interface Demand {
    id: string;
    demand_ref?: string;
    service_id: string;
    service_name?: string;
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

    // Filter state
    const [searchRef, setSearchRef] = useState('');
    const [filterService, setFilterService] = useState('');
    const [filterRequester, setFilterRequester] = useState('');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');

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

    // Unique services for dropdown
    const uniqueServices = useMemo(() => {
        const map = new Map<string, string>();
        demands.forEach(d => {
            const name = d.service_name || d.service_id;
            if (!map.has(name)) map.set(name, name);
        });
        return Array.from(map.values()).sort();
    }, [demands]);

    // Unique requesters for dropdown
    const uniqueRequesters = useMemo(() => {
        const set = new Set<string>();
        demands.forEach(d => { if (d.requested_by) set.add(d.requested_by); });
        return Array.from(set).sort();
    }, [demands]);

    const hasActiveFilters = searchRef || filterService || filterRequester || filterDateFrom || filterDateTo;

    const clearFilters = () => {
        setSearchRef('');
        setFilterService('');
        setFilterRequester('');
        setFilterDateFrom('');
        setFilterDateTo('');
    };

    const filteredDemands = useMemo(() => {
        return demands
            .filter(d => {
                // Ref search
                if (searchRef) {
                    const q = searchRef.toLowerCase();
                    const ref = (d.demand_ref || '').toLowerCase();
                    if (!ref.includes(q)) return false;
                }
                // Service filter
                if (filterService) {
                    const name = d.service_name || d.service_id;
                    if (name !== filterService) return false;
                }
                // Requester filter
                if (filterRequester && d.requested_by !== filterRequester) return false;
                // Date range
                if (filterDateFrom) {
                    const demandDate = new Date(d.created_at).toISOString().slice(0, 10);
                    if (demandDate < filterDateFrom) return false;
                }
                if (filterDateTo) {
                    const demandDate = new Date(d.created_at).toISOString().slice(0, 10);
                    if (demandDate > filterDateTo) return false;
                }
                return true;
            })
            .sort((a, b) => {
                if (a.priority === 'URGENT' && b.priority !== 'URGENT') return -1;
                if (b.priority === 'URGENT' && a.priority !== 'URGENT') return 1;
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            });
    }, [demands, searchRef, filterService, filterRequester, filterDateFrom, filterDateTo]);

    const handleOpenDemand = (demand: Demand) => {
        navigate(`/pharmacy/processing/${demand.id}`);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'DRAFT': return <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">Brouillon</span>;
            case 'SUBMITTED': return <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-600">À Traiter</span>;
            case 'PARTIALLY_FILLED': return <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-600">Partiel</span>;
            case 'FILLED': return <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-600">Terminé</span>;
            case 'REJECTED': return <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-600">Rejeté</span>;
            case 'CANCELLED': return <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-200 text-slate-500">Annulé</span>;
            default: return <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{status}</span>;
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            {/* Header */}
            <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-slate-500" />
                    Demandes de Réapprovisionnement
                </h2>
                <div className="flex items-center gap-2">
                    {hasActiveFilters && (
                        <button
                            onClick={clearFilters}
                            className="px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1"
                        >
                            <X size={12} /> Effacer filtres
                        </button>
                    )}
                    <button onClick={loadDemands} className="text-sm text-blue-600 hover:underline">Actualiser</button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="p-3 border-b bg-slate-50/50 flex flex-wrap gap-2 items-center">
                <Filter size={14} className="text-slate-400" />
                {/* N° Demande */}
                <div className="relative">
                    <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="N° Demande..."
                        value={searchRef}
                        onChange={(e) => setSearchRef(e.target.value)}
                        className="pl-7 pr-2 py-1.5 text-xs border border-slate-200 rounded-lg w-40 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    />
                </div>

                {/* Service */}
                <select
                    value={filterService}
                    onChange={(e) => setFilterService(e.target.value)}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 outline-none min-w-[120px]"
                >
                    <option value="">Tous les services</option>
                    {uniqueServices.map(s => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>

                {/* Demandeur */}
                <select
                    value={filterRequester}
                    onChange={(e) => setFilterRequester(e.target.value)}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 outline-none min-w-[120px]"
                >
                    <option value="">Tous les demandeurs</option>
                    {uniqueRequesters.map(r => (
                        <option key={r} value={r}>{r}</option>
                    ))}
                </select>

                {/* Date Range */}
                <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-400">Du</span>
                    <ErgonomicDatePicker
                        value={filterDateFrom}
                        onChange={(val) => setFilterDateFrom(val)}
                        placeholder="Date début"
                        triggerClassName="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 cursor-pointer hover:border-indigo-400 transition-all flex items-center gap-1 min-w-[120px]"
                    />
                    <span className="text-xs text-slate-400">au</span>
                    <ErgonomicDatePicker
                        value={filterDateTo}
                        onChange={(val) => setFilterDateTo(val)}
                        placeholder="Date fin"
                        triggerClassName="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 cursor-pointer hover:border-indigo-400 transition-all flex items-center gap-1 min-w-[120px]"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b">
                        <tr>
                            <th className="p-4 font-semibold text-slate-700">Priorité</th>
                            <th className="p-4 font-semibold text-slate-700">Service</th>
                            <th className="p-4 font-semibold text-slate-700">N° Demande</th>
                            <th className="p-4 font-semibold text-slate-700">Date</th>
                            <th className="p-4 font-semibold text-slate-700">Demandeur</th>
                            <th className="p-4 font-semibold text-slate-700">Statut</th>
                            <th className="p-4 font-semibold text-slate-700 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {loading ? (
                            <tr><td colSpan={7} className="p-8 text-center text-slate-400">Chargement...</td></tr>
                        ) : filteredDemands.length === 0 ? (
                            <tr><td colSpan={7} className="p-8 text-center text-slate-400 italic">Aucune demande à afficher.</td></tr>
                        ) : (
                            filteredDemands.map(demand => (
                                <tr
                                    key={demand.id}
                                    className="hover:bg-slate-50 transition-colors cursor-pointer group"
                                    onClick={() => handleOpenDemand(demand)}
                                >
                                    <td className="p-4">
                                        {demand.priority === 'URGENT' ? (
                                            <span className="flex items-center gap-1 text-red-600 font-bold text-xs bg-red-50 px-2 py-1 rounded w-fit">
                                                <AlertTriangle size={14} /> URGENT
                                            </span>
                                        ) : (
                                            <span className="text-slate-500 text-xs px-2">Normal</span>
                                        )}
                                    </td>
                                    <td className="p-4 font-medium text-slate-800">{demand.service_name || demand.service_id}</td>
                                    <td className="p-4 font-mono text-xs text-slate-500 font-bold">{demand.demand_ref || demand.id.slice(0, 8)}</td>
                                    <td className="p-4 text-slate-500 text-xs">
                                        {new Date(demand.created_at).toLocaleDateString()} <br/>
                                        {new Date(demand.created_at).toLocaleTimeString().slice(0,5)}
                                    </td>
                                    <td className="p-4 text-slate-600">{demand.requested_by}</td>
                                    <td className="p-4">{getStatusBadge(demand.status)}</td>
                                    <td className="p-4 text-right">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleOpenDemand(demand);
                                            }}
                                            className="px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100"
                                        >
                                            <CheckCircle size={14} />
                                            {demand.status === 'SUBMITTED' ? 'Préparer' :
                                             demand.status === 'PARTIALLY_FILLED' ? 'Continuer' : 'Ouvrir'}
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Count */}
            {!loading && (
                <div className="p-3 border-t bg-slate-50 rounded-b-xl text-xs text-slate-400 flex justify-between">
                    <span>{filteredDemands.length} demande{filteredDemands.length !== 1 ? 's' : ''}</span>
                    {hasActiveFilters && <span className="text-blue-500">{demands.length - filteredDemands.length} masquée{demands.length - filteredDemands.length !== 1 ? 's' : ''} par les filtres</span>}
                </div>
            )}
        </div>
    );
};

export default PharmacyDemandList;
