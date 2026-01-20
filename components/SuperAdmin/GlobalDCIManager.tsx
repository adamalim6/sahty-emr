import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Plus, Search, FlaskConical, Edit2, Trash2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { DCI } from '../../types/pharmacy';
import { DCIModal } from './DCIModal';

export const GlobalDCIManager: React.FC = () => {
    const [dcis, setDcis] = useState<DCI[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeSearchQuery, setActiveSearchQuery] = useState('');
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [totalItems, setTotalItems] = useState(0); 
    const ITEMS_PER_PAGE = 20;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDCI, setEditingDCI] = useState<DCI | null>(null);

    useEffect(() => {
        loadData();
    }, [currentPage, activeSearchQuery]);

    // Auto-search removed. Manual trigger only.

    const handleSearch = () => {
        setActiveSearchQuery(searchQuery);
        setCurrentPage(1);
    };

    const handleReset = () => {
        setSearchQuery('');
        setActiveSearchQuery('');
        setCurrentPage(1);
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const res: any = await api.getGlobalDCIs({
                page: currentPage,
                limit: ITEMS_PER_PAGE,
                q: activeSearchQuery
            });
            
            if (res.data && Array.isArray(res.data)) {
                setDcis(res.data);
                setTotalPages(res.totalPages || 0);
                setTotalItems(res.total || 0);
            } else {
                setDcis(res); // Fallback
            }
        } catch (e) {
            console.error('Failed to load DCIs', e);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (dci?: DCI) => {
        setEditingDCI(dci || null);
        setIsModalOpen(true);
    };

    const handleSuccess = (dci: DCI) => {
       loadData();
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette DCI ?')) return;
        try {
            await api.deleteGlobalDCI(id);
            loadData();
        } catch (e: any) {
            alert(e.message || 'Erreur lors de la suppression');
        }
    };

    // Filter Logic Removed (Server-side)
    // const filteredDCIs = ...

    if (loading) return <div className="p-8 text-center text-slate-500">Chargement...</div>;

    return (
        <div className="p-8 max-w-7xl mx-auto">
             <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FlaskConical className="text-purple-600" />
                        Référentiel DCI Global
                    </h1>
                    <p className="text-slate-500">Gestion des Dénominations Communes Internationales</p>
                </div>
                <button 
                    onClick={() => handleOpenModal()}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors shadow-sm"
                >
                    <Plus size={20} />
                    <span>Nouvelle DCI</span>
                </button>
            </div>

            {/* Search */}
            <div className="mb-6 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                    type="text" 
                    placeholder="Rechercher une DCI (Nom, ATC, Synonymes)..." 
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
                 <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                     {searchQuery && (
                        <button 
                            onClick={handleReset}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    )}
                    <button 
                        onClick={handleSearch}
                        className="p-1.5 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 transition-colors"
                    >
                        <Search size={18} />
                    </button>
                </div>
            </div>

            {/* List */}
             <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4 font-semibold text-slate-700">DCI</th>
                            <th className="px-6 py-4 font-semibold text-slate-700">Code ATC</th>
                            <th className="px-6 py-4 font-semibold text-slate-700">Classification</th>
                            <th className="px-6 py-4 font-semibold text-slate-700">Synonymes</th>
                            <th className="px-6 py-4 font-semibold text-slate-700 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {dcis.map(dci => (
                            <tr key={dci.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-medium text-slate-900">
                                    {dci.name}
                                </td>
                                <td className="px-6 py-4 text-slate-600 font-mono text-xs">
                                    {dci.atcCode || '-'}
                                </td>
                                <td className="px-6 py-4 text-slate-600 text-sm">
                                    {dci.therapeuticClass || '-'}
                                </td>
                                <td className="px-6 py-4 text-slate-500 text-sm">
                                    {dci.synonyms?.join(', ') || '-'}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button 
                                        onClick={() => handleOpenModal(dci)}
                                        className="text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50 transition-colors mr-2"
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(dci.id)}
                                        className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 transition-colors"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {/* Pagination Controls */}
                 <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                    <div className="text-sm text-slate-500">
                        Affichage de <span className="font-medium">{dcis.length}</span> sur <span className="font-medium">{totalItems}</span> DCIs
                    </div>
                    <div className="flex items-center space-x-2">
                        <button 
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-2 rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft size={20} className="text-slate-600" />
                        </button>
                        <span className="text-sm font-medium text-slate-700">
                            Page {currentPage} sur {totalPages || 1}
                        </span>
                        <button 
                             onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                             disabled={currentPage >= totalPages}
                             className="p-2 rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronRight size={20} className="text-slate-600" />
                        </button>
                    </div>
                </div>
            </div>

            <DCIModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={handleSuccess}
                editingDCI={editingDCI}
            />
        </div>
    );
};
