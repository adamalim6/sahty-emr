import React, { useState, useCallback } from 'react';
import { X, Search, Plus, Loader2 } from 'lucide-react';
import { api } from '../../services/api';

interface GlobalActOption {
    id: string;
    code_sih: string;
    libelle_sih: string;
    type_acte?: string;
}

interface AddActModalProps {
    admissionId: string;
    onClose: () => void;
    onAdded: (result: any) => void;
}

export const AddActModal: React.FC<AddActModalProps> = ({ admissionId, onClose, onAdded }) => {
    const [search, setSearch] = useState('');
    const [results, setResults] = useState<GlobalActOption[]>([]);
    const [searching, setSearching] = useState(false);
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const runSearch = useCallback(async (q: string) => {
        setSearch(q);
        if (q.trim().length < 2) { setResults([]); return; }
        setSearching(true);
        try {
            const data = await api.admissionCharges.searchActs(q);
            setResults(data as GlobalActOption[]);
        } catch (e: any) {
            setError(e.message || 'Recherche échouée');
        } finally {
            setSearching(false);
        }
    }, []);

    const handlePick = async (act: GlobalActOption) => {
        if (adding) return;
        setAdding(true);
        setError(null);
        try {
            const result = await api.admissionCharges.add(admissionId, {
                globalActId: act.id,
                quantity: 1
            });
            onAdded(result);
            onClose();
        } catch (e: any) {
            setError(e.message || 'Ajout échoué');
        } finally {
            setAdding(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl animate-in fade-in zoom-in duration-150" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-black text-slate-800">Ajouter un acte</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors" disabled={adding}>
                        <X size={22} />
                    </button>
                </div>

                <div className="relative mb-4">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        autoFocus
                        className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Rechercher par code ou libellé (min. 2 caractères)"
                        value={search}
                        onChange={e => runSearch(e.target.value)}
                        disabled={adding}
                    />
                </div>

                {error && (
                    <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
                )}

                <div className="max-h-72 overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-100">
                    {searching && (
                        <div className="p-4 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
                            <Loader2 size={14} className="animate-spin" /> Recherche...
                        </div>
                    )}
                    {!searching && search.length >= 2 && results.length === 0 && (
                        <div className="p-4 text-center text-sm text-slate-400">Aucun résultat</div>
                    )}
                    {!searching && search.length < 2 && (
                        <div className="p-4 text-center text-sm text-slate-400">Tapez au moins 2 caractères pour rechercher</div>
                    )}
                    {results.map(a => (
                        <button
                            key={a.id}
                            onClick={() => handlePick(a)}
                            disabled={adding}
                            className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 flex items-center justify-between text-sm transition-colors disabled:opacity-50"
                        >
                            <div className="min-w-0 flex-1">
                                <span className="font-mono text-xs text-slate-500 mr-2">{a.code_sih}</span>
                                <span className="font-medium text-slate-700">{a.libelle_sih}</span>
                                {a.type_acte && <span className="ml-2 text-[10px] font-bold uppercase text-slate-400">{a.type_acte}</span>}
                            </div>
                            <Plus size={16} className="text-indigo-500 shrink-0 ml-2" />
                        </button>
                    ))}
                </div>

                {adding && (
                    <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-500">
                        <Loader2 size={14} className="animate-spin" /> Ajout en cours...
                    </div>
                )}
            </div>
        </div>
    );
};
