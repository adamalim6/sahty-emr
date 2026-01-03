
import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Search, Loader2, ChevronLeft, ChevronRight, X, Save, AlertCircle } from 'lucide-react';

export const ActesPage: React.FC = () => {
    const [actes, setActes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    
    // Modal State
    const [selectedActe, setSelectedActe] = useState<any | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1); // Reset page on search
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        loadActes();
    }, [page, debouncedSearch]);

    const loadActes = async () => {
        setLoading(true);
        try {
            const response = await api.getActes({
                page,
                limit: 50,
                search: debouncedSearch
            });
            setActes(response.data);
            setTotalPages(response.totalPages);
        } catch (error) {
            console.error('Failed to load actes:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRowClick = (acte: any) => {
        setSelectedActe({ ...acte }); // Clone to avoid direct mutation
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedActe) return;

        setIsSaving(true);
        try {
            await api.updateActe(selectedActe.code, selectedActe);
            setIsModalOpen(false);
            loadActes(); // Refresh list to reflect changes
        } catch (error) {
            console.error('Failed to update acte:', error);
            alert('Erreur lors de la sauvegarde');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-800">Référentiel des Actes</h1>
                <p className="text-slate-500">Classification Commune des Actes Médicaux (CCAM) et NGAP</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Toolbar */}
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="relative w-full max-w-lg">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Rechercher par Code ou Libellé..." 
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-slate-700"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-slate-500 ml-4">
                        <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap">
                            Total: {actes.length > 0 ? 'Chargé' : '0'}
                        </span>
                    </div>
                </div>

                {/* Simplified List View */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider text-xs border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 w-40">Code SIH</th>
                                <th className="px-6 py-4">Libellé SIH</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={2} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center justify-center text-slate-400">
                                            <Loader2 size={32} className="animate-spin mb-3 text-blue-500" />
                                            <span>Chargement...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : actes.length === 0 ? (
                                <tr>
                                    <td colSpan={2} className="px-6 py-20 text-center text-slate-400">
                                        Aucun acte trouvé.
                                    </td>
                                </tr>
                            ) : (
                                actes.map((acte) => (
                                    <tr 
                                        key={acte.code} 
                                        onClick={() => handleRowClick(acte)}
                                        className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                                    >
                                        <td className="px-6 py-4 font-mono font-medium text-blue-600 group-hover:text-blue-700">
                                            {acte.code}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-slate-800 group-hover:text-blue-900">
                                            {acte.label}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="border-t border-slate-200 p-4 bg-slate-50 flex justify-between items-center">
                    <button 
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1 || loading}
                        className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 disabled:opacity-50 transition-all flex items-center text-slate-600"
                    >
                        <ChevronLeft size={16} className="mr-2" /> Précédent
                    </button>
                    <span className="text-sm font-medium text-slate-600">
                        Page {page} sur {totalPages}
                    </span>
                    <button 
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages || loading}
                        className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 disabled:opacity-50 transition-all flex items-center text-slate-600"
                    >
                        Suivant <ChevronRight size={16} className="ml-2" />
                    </button>
                </div>
            </div>

            {/* Acte Detail Modal */}
            {isModalOpen && selectedActe && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
                        
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50 rounded-t-xl sticky top-0 z-10">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">Détail de l'Acte</h2>
                                <p className="text-sm text-slate-500 font-mono mt-1">{selectedActe.code}</p>
                            </div>
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200 rounded-lg transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Content */}
                        <form id="acte-form" onSubmit={handleSave} className="p-8 space-y-8">
                            
                            {/* Section 1: Identification */}
                            <section>
                                <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-4 pb-2 border-b border-blue-100">
                                    Identification
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Code SIH</label>
                                        <input 
                                            type="text" 
                                            className="w-full border rounded-lg p-2.5 bg-slate-50 font-mono text-slate-600"
                                            value={selectedActe.code}
                                            disabled // Primary Key usually shouldn't be changed easily
                                        />
                                        <p className="text-xs text-slate-400 mt-1 flex items-center">
                                            <AlertCircle size={12} className="mr-1"/> Le code est un identifiant unique
                                        </p>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Libellé SIH</label>
                                        <textarea 
                                            className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[80px]"
                                            value={selectedActe.label}
                                            onChange={e => setSelectedActe({...selectedActe, label: e.target.value})}
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Section 2: Classification */}
                            <section>
                                <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-4 pb-2 border-b border-blue-100">
                                    Classification SIH
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Famille</label>
                                        <input 
                                            type="text" 
                                            className="w-full border rounded-lg p-2.5"
                                            value={selectedActe.family}
                                            onChange={e => setSelectedActe({...selectedActe, family: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Sous-famille</label>
                                        <input 
                                            type="text" 
                                            className="w-full border rounded-lg p-2.5"
                                            value={selectedActe.subFamily}
                                            onChange={e => setSelectedActe({...selectedActe, subFamily: e.target.value})}
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Section 3: NGAP / CCAM */}
                            <section>
                                <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-4 pb-2 border-b border-blue-100">
                                    Correspondances
                                </h3>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    {/* NGAP Column */}
                                    <div className="space-y-4 bg-slate-50 p-4 rounded-xl">
                                        <h4 className="font-bold text-slate-700">NGAP</h4>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Code NGAP</label>
                                            <input type="text" className="w-full border rounded p-2"
                                                value={selectedActe.ngapCode || ''}
                                                onChange={e => setSelectedActe({...selectedActe, ngapCode: e.target.value})}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Libellé NGAP</label>
                                            <input type="text" className="w-full border rounded p-2"
                                                value={selectedActe.ngapLabel || ''}
                                                onChange={e => setSelectedActe({...selectedActe, ngapLabel: e.target.value})}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Cotation</label>
                                            <input type="text" className="w-full border rounded p-2"
                                                value={selectedActe.ngapCoeff || ''}
                                                onChange={e => setSelectedActe({...selectedActe, ngapCoeff: e.target.value})}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Nature Corresp.</label>
                                            <input type="text" className="w-full border rounded p-2"
                                                value={selectedActe.ngapNature || ''}
                                                onChange={e => setSelectedActe({...selectedActe, ngapNature: e.target.value})}
                                            />
                                        </div>
                                    </div>

                                    {/* CCAM Column */}
                                    <div className="space-y-4 bg-slate-50 p-4 rounded-xl">
                                        <h4 className="font-bold text-slate-700">CCAM</h4>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Code CCAM</label>
                                            <input type="text" className="w-full border rounded p-2"
                                                value={selectedActe.ccamCode || ''}
                                                onChange={e => setSelectedActe({...selectedActe, ccamCode: e.target.value})}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Libellé CCAM</label>
                                            <input type="text" className="w-full border rounded p-2"
                                                value={selectedActe.ccamLabel || ''}
                                                onChange={e => setSelectedActe({...selectedActe, ccamLabel: e.target.value})}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Nature Corresp.</label>
                                            <input type="text" className="w-full border rounded p-2"
                                                value={selectedActe.ccamNature || ''}
                                                onChange={e => setSelectedActe({...selectedActe, ccamNature: e.target.value})}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Section 4: Meta */}
                            <section>
                                <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-4 pb-2 border-b border-blue-100">
                                    Paramètres & Durée
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Durée moyenne (min)</label>
                                        <input 
                                            type="number" 
                                            className="w-full border rounded-lg p-2.5"
                                            value={selectedActe.duration}
                                            onChange={e => setSelectedActe({...selectedActe, duration: parseInt(e.target.value) || 0})}
                                        />
                                    </div>
                                    <div className="flex items-center mt-6">
                                        <label className="flex items-center space-x-3 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500"
                                                checked={selectedActe.active !== false}
                                                onChange={e => setSelectedActe({...selectedActe, active: e.target.checked})}
                                            />
                                            <span className="text-slate-700 font-medium">Acte Actif</span>
                                        </label>
                                    </div>
                                </div>
                            </section>

                        </form>

                        {/* Footer */}
                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end space-x-3 rounded-b-xl sticky bottom-0 z-10">
                            <button 
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="px-6 py-2.5 text-slate-600 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg transition-all font-medium"
                            >
                                Annuler
                            </button>
                            <button 
                                form="acte-form"
                                type="submit"
                                disabled={isSaving}
                                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-600/20 flex items-center space-x-2 font-medium disabled:opacity-50 transition-all"
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        <span>Enregistrement...</span>
                                    </>
                                ) : (
                                    <>
                                        <Save size={18} />
                                        <span>Enregistrer les modifications</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
