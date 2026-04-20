import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Search, Building, CheckCircle, XCircle } from 'lucide-react';

export const OrganismesReadOnlyPage: React.FC = () => {
    const [organismes, setOrganismes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        (async () => {
            try {
                const data = await api.getSettingsOrganismes();
                setOrganismes(data);
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        })();
    }, []);

    const filtered = organismes.filter(o =>
        o.designation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.category?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-800">Organismes</h1>
                <p className="text-slate-500">Assurances, Mutuelles et Organismes Conventionnés (lecture seule)</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input type="text" placeholder="Rechercher un organisme..."
                            className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg w-full md:w-80 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-10 text-slate-500">Chargement...</div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Désignation</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Catégorie</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Sous-Type</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase">Coeff. B</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Statut</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.map(org => (
                                <tr key={org.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600"><Building size={16} /></div>
                                            <span className="font-medium text-slate-900">{org.designation}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            org.category === 'ASSURANCE' ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'
                                        }`}>{org.category}</span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">{org.sub_type || '-'}</td>
                                    <td className="px-6 py-4 text-right">
                                        {org.coefficient_b ? <span className="font-mono font-bold text-sm text-slate-800">{parseFloat(org.coefficient_b).toFixed(2)}</span> : <span className="text-slate-300">-</span>}
                                    </td>
                                    <td className="px-6 py-4">
                                        {org.active ? (
                                            <div className="flex items-center text-emerald-600 text-sm font-medium"><CheckCircle size={16} className="mr-1.5" />Actif</div>
                                        ) : (
                                            <div className="flex items-center text-slate-400 text-sm font-medium"><XCircle size={16} className="mr-1.5" />Inactif</div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">Aucun organisme trouvé</td></tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};
