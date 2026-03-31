import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../services/api';
import { Search, UserSearch, ArrowRight, Fingerprint, IdCard, Calendar, Activity } from 'lucide-react';
import { calculateAge } from '../../../constants';

export const LimsPatientListPage: React.FC = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const navigate = useNavigate();

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!query || query.length < 2) return;

        setIsSearching(true);
        try {
            const data = await api.limsConfig.execution.searchUniversalPatient(query);
            setResults(data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
            <div className="p-8 border-b border-slate-200 bg-white shrink-0">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-2xl font-black text-slate-800 mb-6 flex items-center">
                        <UserSearch className="mr-3 text-indigo-600" size={28} />
                        Recherche Patient LIMS
                    </h1>
                    
                    <form onSubmit={handleSearch} className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="block w-full pl-11 pr-32 py-4 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium"
                            placeholder="Rechercher par IPP, CIN, Nom, Prénom..."
                            autoFocus
                        />
                        <div className="absolute inset-y-0 right-2 flex items-center">
                            <button
                                type="submit"
                                disabled={isSearching || query.length < 2}
                                className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors uppercase text-xs tracking-widest"
                            >
                                {isSearching ? '...' : 'Chercher'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-4xl mx-auto space-y-4">
                    {results.length > 0 ? (
                        results.map((patient) => (
                            <button
                                key={patient.id}
                                onClick={() => navigate(`/lims/patients/${patient.id}`)}
                                className="w-full bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all text-left flex items-center justify-between group active:scale-[0.99]"
                            >
                                <div className="flex flex-col">
                                    <h3 className="text-lg font-black text-slate-800 group-hover:text-indigo-600 transition-colors uppercase">
                                        {patient.lastName} {patient.firstName}
                                    </h3>
                                    <div className="flex items-center space-x-4 mt-2 text-sm text-slate-500 font-medium">
                                        <div className="flex items-center space-x-1.5"><Fingerprint size={14}/><span>{patient.ipp}</span></div>
                                        {patient.cin && <div className="flex items-center space-x-1.5"><IdCard size={14}/><span>{patient.cin}</span></div>}
                                        {patient.dob && <div className="flex items-center space-x-1.5"><Calendar size={14}/><span>{calculateAge(patient.dob)} ans</span></div>}
                                        {patient.sex && <div className="flex items-center space-x-1.5"><Activity size={14}/><span>{patient.sex}</span></div>}
                                    </div>
                                </div>
                                <div className="h-10 w-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                    <ArrowRight size={20} />
                                </div>
                            </button>
                        ))
                    ) : (
                        query.length >= 2 && !isSearching && (
                            <div className="text-center py-12 text-slate-500">
                                <UserSearch size={48} className="mx-auto mb-4 opacity-20" />
                                <p className="text-lg font-medium">Aucun patient trouvé pour "{query}"</p>
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};
