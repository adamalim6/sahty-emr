import React, { useState } from 'react';
import { 
    useLimsSectionTree, 
    useLimsConfigDictionaries, 
    useCreateSectionTree, 
    useUpdateSectionTree,
    useSetSectionTreeStatus 
} from './useLimsConfig';
import { Plus, CheckCircle2, XCircle, Search, Save, X, Edit2, Check } from 'lucide-react';
import { SearchableSelect } from '../ui/SearchableSelect';

export const SectionTreePage = () => {
    const { data: treeList = [], isLoading: isTreeLoading } = useLimsSectionTree();
    const { sousFamilles, sections, isLoading: isDictLoading } = useLimsConfigDictionaries();
    const createMutation = useCreateSectionTree();
    const updateMutation = useUpdateSectionTree();
    const statusMutation = useSetSectionTreeStatus();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [formData, setFormData] = useState({
        sous_famille_id: '',
        section_id: '',
        sort_order: 0,
        actif: true
    });
    
    // Inline edit state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editData, setEditData] = useState<any>(null);

    const isLoading = isTreeLoading || isDictLoading;

    const filteredTree = treeList.filter(t => 
        (t.section_label || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.sous_famille_label || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const sousFamilleOptions = sousFamilles.map(sf => ({ value: sf.id, label: `${sf.libelle} [${sf.code}]`, searchString: `${sf.libelle} ${sf.code}` }));
    const sectionOptions = sections.map(s => ({ value: s.id, label: `${s.libelle} [${s.code}]`, searchString: `${s.libelle} ${s.code}` }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.sous_famille_id || !formData.section_id) return;
        
        await createMutation.mutateAsync(formData);
        setIsModalOpen(false);
        setFormData({ sous_famille_id: '', section_id: '', sort_order: 0, actif: true });
    };

    const toggleStatus = async (id: string, currentStatus: boolean, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        await statusMutation.mutateAsync({ id, actif: !currentStatus });
    };

    const startEdit = (item: any) => {
        setEditingId(item.id);
        setEditData({ ...item });
    };

    const cancelEdit = (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setEditingId(null);
        setEditData(null);
    };

    const saveEdit = async (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (!editData || !editData.sous_famille_id || !editData.section_id) return;
        await updateMutation.mutateAsync({ id: editData.id, data: editData });
        setEditingId(null);
        setEditData(null);
    };

    if (isLoading) {
        return <div className="p-8 text-center text-slate-500">Chargement...</div>;
    }

    return (
        <div className="flex flex-col h-full bg-slate-50/50">
            {/* Header */}
            <div className="bg-white px-8 py-5 border-b border-slate-200 flex justify-between items-center shrink-0 shadow-sm z-10">
                <div>
                    <h1 className="text-xl font-bold text-slate-800">Chapitres (Sections)</h1>
                    <p className="text-sm text-slate-500 mt-1">Assigner des chapitres aux disciplines</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
                >
                    <Plus size={18} />
                    <span>Nouveau Chapitre</span>
                </button>
            </div>

            {/* List Engine */}
            <div className="flex-1 overflow-auto p-8">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                        <div className="relative w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Rechercher par discipline ou chapitre..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            />
                        </div>
                        <div className="text-sm text-slate-500 font-medium bg-white px-3 py-1 rounded-full border border-slate-200">
                            {filteredTree.length} associations
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                                    <th className="px-6 py-4">Discipline (Sous-famille)</th>
                                    <th className="px-6 py-4">Chapitre (Section)</th>
                                    <th className="px-6 py-4 w-24">Ordre</th>
                                    <th className="px-6 py-4 w-32">Statut</th>
                                    <th className="px-6 py-4 text-right w-48">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm divide-y divide-slate-100">
                                {filteredTree.map((item) => {
                                    const isEditing = editingId === item.id;
                                    
                                    return (
                                        <tr 
                                            key={item.id} 
                                            className={`transition-colors group ${isEditing ? 'bg-blue-50/50' : 'hover:bg-slate-50 cursor-pointer'}`}
                                            onClick={() => { if (!isEditing) startEdit(item); }}
                                        >
                                            <td className="px-6 py-4">
                                                {isEditing ? (
                                                    <div onClick={e => e.stopPropagation()}>
                                                        <SearchableSelect
                                                            options={sousFamilleOptions}
                                                            value={editData.sous_famille_id}
                                                            onChange={val => setEditData({ ...editData, sous_famille_id: val })}
                                                            placeholder="Sélectionner une discipline..."
                                                        />
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="font-medium text-slate-800">{item.sous_famille_label}</div>
                                                        <div className="text-xs text-slate-500">[{item.sous_famille_code}]</div>
                                                    </>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {isEditing ? (
                                                    <div onClick={e => e.stopPropagation()}>
                                                        <SearchableSelect
                                                            options={sectionOptions}
                                                            value={editData.section_id}
                                                            onChange={val => setEditData({ ...editData, section_id: val })}
                                                            placeholder="Sélectionner un chapitre..."
                                                        />
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="font-medium text-slate-800">{item.section_label}</div>
                                                        <div className="text-xs text-slate-500">[{item.section_code}]</div>
                                                    </>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {isEditing ? (
                                                    <input
                                                        type="number"
                                                        value={editData.sort_order}
                                                        onChange={e => setEditData({ ...editData, sort_order: parseInt(e.target.value) || 0 })}
                                                        onClick={e => e.stopPropagation()}
                                                        className="w-16 px-2 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                                    />
                                                ) : (
                                                    <span className="font-mono bg-slate-100 px-2 py-1 rounded text-slate-600 text-xs">
                                                        {item.sort_order}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={(e) => isEditing ? setEditData({ ...editData, actif: !editData.actif }) : toggleStatus(item.id, item.actif, e)}
                                                    className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors ${
                                                        (isEditing ? editData.actif : item.actif) 
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                                                            : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                                    }`}
                                                >
                                                    {(isEditing ? editData.actif : item.actif) ? <CheckCircle2 size={14} className="mr-1" /> : <XCircle size={14} className="mr-1" />}
                                                    {(isEditing ? editData.actif : item.actif) ? 'Actif' : 'Inactif'}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {isEditing ? (
                                                    <div className="flex items-center justify-end space-x-2">
                                                        <button 
                                                            onClick={cancelEdit}
                                                            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-md transition-colors"
                                                            title="Annuler"
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                        <button 
                                                            onClick={saveEdit}
                                                            disabled={updateMutation.isPending || !editData.sous_famille_id || !editData.section_id}
                                                            className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded-md transition-colors disabled:opacity-50"
                                                            title="Enregistrer"
                                                        >
                                                            <Check size={16} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button className="flex items-center space-x-1 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 transition-colors shadow-sm">
                                                            <Edit2 size={14} />
                                                            <span>Éditer</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredTree.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                            Aucun chapitre configuré.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Creation Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="font-bold text-slate-800 text-lg">Nouveau Chapitre</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Discipline (Sous-famille) *</label>
                                <select
                                    required
                                    value={formData.sous_famille_id}
                                    onChange={e => setFormData({ ...formData, sous_famille_id: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                                >
                                    <option value="">Sélectionner une discipline...</option>
                                    {sousFamilles.map(sf => (
                                        <option key={sf.id} value={sf.id}>{sf.libelle} [{sf.code}]</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Chapitre LIMS (Section) *</label>
                                <select
                                    required
                                    value={formData.section_id}
                                    onChange={e => setFormData({ ...formData, section_id: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                                >
                                    <option value="">Sélectionner un chapitre...</option>
                                    {sections.map(s => (
                                        <option key={s.id} value={s.id}>{s.libelle} [{s.code}]</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Ordre d'affichage</label>
                                    <input
                                        type="number"
                                        value={formData.sort_order}
                                        onChange={e => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    />
                                </div>
                                <div className="flex items-center pt-7">
                                    <label className="flex items-center space-x-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.actif}
                                            onChange={e => setFormData({ ...formData, actif: e.target.checked })}
                                            className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                        />
                                        <span className="text-sm font-medium text-slate-700">Actif immédiatement</span>
                                    </label>
                                </div>
                            </div>
                            
                            <div className="pt-4 border-t border-slate-100 flex justify-end space-x-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-transparent"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    disabled={!formData.sous_famille_id || !formData.section_id || createMutation.isPending}
                                    className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm disabled:bg-blue-300 flex items-center space-x-2"
                                >
                                    {createMutation.isPending ? 'Enregistrement...' : (
                                        <>
                                            <Save size={16} />
                                            <span>Enregistrer</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
